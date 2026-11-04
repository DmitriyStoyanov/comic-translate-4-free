// Pixel bus: binary pixel payloads travel between the service worker and the
// offscreen document via IndexedDB, NOT chrome.runtime messaging.
//
// Why: chrome.runtime.sendMessage silently drops ArrayBuffers sent from an
// extension service worker — the receiver gets an empty object ({}) instead
// of the pixels. Verified empirically: a 6.4MB ArrayBuffer sent SW->offscreen
// arrived as {bytes:0, mean:0}. IndexedDB structured-clones binary data
// reliably, so payloads go through IDB and only the lookup key travels in
// the message. Keys are namespaced 'px:'.
// Deletion rule: OUTPUTS are deleted on read (pixelTake, single-use — the
// service worker takes each result once). INPUTS are only read (pixelPeek):
// a worker attempt that fails (crash, OOM, timeout) must not consume the
// input, or the fallback/retry's read fails with "not found" (1.3.0
// Firefox bug: the worker took the detect input, failed, and the
// in-process fallback re-ran the handler on the deleted key). Inputs are
// dropped by the pipeline finally (pxKeys) after the stage settles, so
// peeking leaks nothing.
//
// Large payloads (>8MB) are chunked: a single huge IDB value can hit
// QuotaExceeded (e.g. 4000x6000x4 = 96MB). Chunks live at `px:key#i` with a
// manifest at `px:key` ({chunks, bytes}). Small payloads use one record.
import { openDb, idbGet, idbPut, idbDel, idbKeys } from './contracts.js';

let dbPromise = null;
function db() {
  // Reset on reject: a failed openDb (e.g. onblocked during a version upgrade)
  // must not poison every later call until the extension reloads.
  if (!dbPromise) dbPromise = openDb().catch(e => { dbPromise = null; throw e; });
  return dbPromise;
}

const prefix = key => 'px:' + key;
const chunkId = (key, i) => `${prefix(key)}#${i}`;
const CHUNK_BYTES = 8 * 1024 * 1024;

/** Store an ArrayBuffer (or view) under key for the other side to take. */
export async function pixelPut(key, buffer) {
  const d = await db();
  let ab;
  if (buffer instanceof ArrayBuffer) {
    ab = buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    // Slice views so a byteOffset/larger backing store can't leak through.
    ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } else {
    throw new Error('pixelPut expects an ArrayBuffer or typed-array view');
  }
  if (ab.byteLength <= CHUNK_BYTES) {
    await idbPut(d, { id: prefix(key), data: ab });
    return;
  }
  // Chunked: manifest at px:key, chunks at px:key#i.
  const n = Math.ceil(ab.byteLength / CHUNK_BYTES);
  const u8 = new Uint8Array(ab);
  for (let i = 0; i < n; i++) {
    const start = i * CHUNK_BYTES;
    const end = Math.min(ab.byteLength, start + CHUNK_BYTES);
    // slice() copies — each chunk is an independent ArrayBuffer.
    await idbPut(d, { id: chunkId(key, i), data: u8.slice(start, end).buffer });
  }
  await idbPut(d, { id: prefix(key), chunks: n, bytes: ab.byteLength });
}

/** Read the payload for key WITHOUT deleting it. See the header note. */
async function pixelRead(key) {
  const d = await db();
  const rec = await idbGet(d, prefix(key));
  if (!rec) throw new Error(`pixel payload "${key}" not found in transfer store`);
  if (rec.chunks) {
    // Chunked payload: read ALL chunks first and verify size matches the
    // manifest. Deleting as we go would destroy the payload on a mid-read
    // failure, making retry impossible.
    const parts = [];
    let total = 0;
    for (let i = 0; i < rec.chunks; i++) {
      const cre = await idbGet(d, chunkId(key, i));
      if (!cre || !cre.data) throw new Error(`pixel payload "${key}" is missing chunk ${i} of ${rec.chunks}`);
      const u8 = new Uint8Array(cre.data);
      parts.push(u8);
      total += u8.length;
    }
    if (total !== rec.bytes) throw new Error(`pixel payload "${key}" reassembled to ${total} bytes but should be ${rec.bytes}`);
    const buf = new Uint8Array(rec.bytes);
    let off = 0;
    for (const u8 of parts) { buf.set(u8, off); off += u8.length; }
    return { buffer: buf.buffer, chunks: rec.chunks };
  }
  return { buffer: rec.data, chunks: 0 };
}

/**
 * Read the payload for key WITHOUT deleting it. For INPUTS (worker
 * handlers): a failed attempt must leave the input for the fallback or
 * retry. Throws if missing, same as pixelTake.
 */
export async function pixelPeek(key) {
  return (await pixelRead(key)).buffer;
}

/**
 * Read + delete the payload for key. For OUTPUTS (service worker takes
 * each result once). Throws if missing — a missing payload means the
 * handoff broke, and failing loud beats feeding zeros downstream.
 */
export async function pixelTake(key) {
  const { buffer, chunks } = await pixelRead(key);
  // Verified complete — now delete chunks + manifest (best-effort; a
  // failed delete must not lose the payload we just read).
  const d = await db();
  for (let i = 0; i < chunks; i++) {
    try { await idbDel(d, chunkId(key, i)); } catch { /* best effort */ }
  }
  try { await idbDel(d, prefix(key)); } catch { /* best effort */ }
  return buffer;
}

/**
 * 1.4.0 (m5): delete every staged pixel payload belonging to one dead
 * run. Called by orphan recovery (failOrphanedRun) after background
 * death, where the pipeline finally never ran. Keys are matched by
 * prefix 'px:' AND containing the runId — that covers manifests
 * (px:key, where the key embeds the runId) and chunk records
 * (px:key#i, which also contain it). Model records (non-px: ids in the
 * same models store) are never touched, and the page-cache is a
 * separate store, also untouched. Best-effort, never throws.
 */
export async function pixelPruneRun(runId) {
  if (!runId) return;
  let d;
  try { d = await db(); } catch { return; }
  let keys;
  try { keys = await idbKeys(d); } catch { return; }
  for (const k of keys) {
    if (typeof k === 'string' && k.startsWith('px:') && k.includes(runId)) {
      try { await idbDel(d, k); } catch { /* best effort */ }
    }
  }
}

/** Best-effort delete (cleanup after a failed/cancelled run). Deletes chunks too. */
export async function pixelDrop(key) {
  let d;
  try { d = await db(); } catch { return; }
  try {
    const rec = await idbGet(d, prefix(key));
    if (rec && rec.chunks) {
      for (let i = 0; i < rec.chunks; i++) {
        try { await idbDel(d, chunkId(key, i)); } catch { /* already gone */ }
      }
    }
  } catch { /* best effort */ }
  try { await idbDel(d, prefix(key)); } catch { /* best effort */ }
}
