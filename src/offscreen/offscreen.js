// Offscreen ML host: owns ALL onnxruntime-web sessions (detector,
// Baberu OCR, LaMa inpainter). The service worker orchestrates; this document only runs
// inference. Models are read from the shared IndexedDB ('ct-db'/'models').
// Verified: ort 1.30 threaded WASM runs here with numThreads=1 and no COOP/COEP
// (chrome-extension: pages get SharedArrayBuffer without crossOriginIsolated).
import { MSG, openDb, idbGet } from '../shared/contracts.js';
import { ALL_FILES, downloadFileToIdb, readChunked, ocrEngineForLang, BABERU_VOCAB_ASSET } from '../shared/model-specs.js';
import { Detector } from './ml/detector.js';
import { BaberuOCR } from './ml/baberu.js';
import { meanBrightness } from '../shared/image-ops.js';
import { Inpainter } from './ml/inpaint.js';
import { pixelPut, pixelPeek } from '../shared/pixel-bus.js';

// Worker-safe: a Firefox inpaint worker imports this module, and a worker
// may not have chrome.runtime. Fall back to a path relative to this script:
// both offscreen.html and background/ml-worker.js sit one level under
// src/, so ../offscreen/vendor/ resolves to the same dir in both.
try {
  ort.env.wasm.wasmPaths = chrome.runtime.getURL('src/offscreen/vendor/');
} catch {
  ort.env.wasm.wasmPaths = new URL('../offscreen/vendor/', self.location.href).href;
}
// WASM threads ON (up to 8 cores). Correction to the 1.2.10 note: 1.2.8
// (threads on, full-res inpaint) works — threads are proven safe. 1.2.9
// stalled because of half-res inpaint, not threads, so threads are back
// and half-res is removed (see inpaint.js). Set before any session is
// created (ensureModel below).
ort.env.wasm.numThreads = Math.max(1, Math.min(8, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4));

const detector = new Detector();
const baberu = new BaberuOCR();
const inpainter = new Inpainter();

// Drop loaded ORT sessions so the next inference re-reads model files from
// IndexedDB. group: 'detector' | 'ocr-baberu' | 'inpaint' | '*'.
async function resetGroup(group) {
  if (group === 'detector' || group === '*') await detector.reset();
  if (group === 'ocr-baberu' || group === '*') await baberu.reset();
  if (group === 'inpaint' || group === '*') await inpainter.reset();
}

// WASM OOM signatures from ORT/Emscripten. Matches ml-bridge.js's OOM_RE.
const OOM_RE = /out of memory|no available backend|aborted\s*\(/i;
const isOom = e => OOM_RE.test(String((e && e.message) || e || ''));

let db = null;
async function getDb() {
  if (!db) db = await openDb();
  return db;
}

async function modelBuffer(id) {
  const db = await getDb();
  const rec = await idbGet(db, id);
  if (!rec) throw new Error(`model "${id}" not in local cache — download it from the popup first`);
  const spec = ALL_FILES.find(f => f.id === id);
  if (spec && spec.bytes && rec.bytes !== spec.bytes) {
    throw new Error(
      `cached model "${id}" is ${rec.bytes} bytes but should be ${spec.bytes} — ` +
      `it is the wrong file or a truncated download. Delete it in the popup and download it again.`);
  }
  if (rec.data) return rec.data; // single-record format (older builds)
  if (rec.chunks) return readChunked(db, id, rec); // chunked format
  throw new Error(`cached model "${id}" is corrupt — delete it in the popup and download it again`);
}

async function assetText(path) {
  return (await (await fetch(chrome.runtime.getURL(path))).text());
}

// WebGPU, per model, with automatic WASM fallback — 1.3.3, narrowed 1.3.5.
// History: 1.3.0 ran WebGPU for every model and OOM'd the detector on
// both browsers; 1.3.2 reverted to WASM-only; 1.3.4 fixed the real
// causes (missing asyncify files, dispose() no-op — see release()).
// Current assignment:
// - Detector: WASM only. It OOM'd on WebGPU on both browsers, and it is
//   only ~1s on WASM anyway, so there is nothing to gain by retrying it.
// - Baberu: WASM only (1.3.5). It is an autoregressive decoder (prefill
//   + a step loop with a KV cache that grows every step). On WebGPU
//   that pattern deadlocks mid-run with no error thrown, so an
//   error-only fallback cannot catch it — it stuck OCR at 38% on
//   1.3.4. No hang watchdog exists yet, so Baberu stays on CPU.
// - LaMa: WebGPU ALONE first. It is feedforward with fixed tile
//   shapes, one pass per tile — no loop, no growing KV cache — so it
//   is the model WebGPU suits. If session creation fails
//   (unsupported op, no GPU), fall back to WASM. If a WebGPU RUN
//   throws OOM, downgrade to WASM, reload, and retry once (see the
//   inpaint OOM catch). The downgrade sticks for the host lifetime.
// A missing navigator.gpu (old browser, or a worker without WebGPU)
// skips straight to WASM — no doomed attempt.
const WEBGPU_KINDS = new Set(['inpaint']);
const HAS_WEBGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
const webgpuDowngraded = new Set(); // kinds that fell back to WASM
function providersFor(kind) {
  if (!WEBGPU_KINDS.has(kind) || !HAS_WEBGPU || webgpuDowngraded.has(kind)) return ['wasm'];
  return ['webgpu'];
}
const loading = {};
async function loadBaberu(providers) {
  // Fetch + attach one graph at a time so the three buffers (121MB)
  // are never all resident at once. All three share providers, so
  // vision→prefill tensors never cross providers.
  await baberu.loadVis(await modelBuffer('ocr-baberu-vision-v12'), providers);
  await baberu.loadPre(await modelBuffer('ocr-baberu-prefill-v12'), providers);
  await baberu.loadStep(await modelBuffer('ocr-baberu-step-v12'), providers);
}
async function loadWithWebgpuFallback(kind, loadFn) {
  // Try WebGPU alone; on creation failure, fall back to WASM once and
  // remember it for this host lifetime. Throws only if WASM also fails.
  const providers = providersFor(kind);
  try {
    await loadFn(providers);
  } catch (e) {
    if (providers[0] !== 'webgpu') throw e;
    webgpuDowngraded.add(kind);
    // Dispose any half-loaded WebGPU sessions before the WASM retry,
    // or they leak GPU resources (and a later load would mix providers).
    await resetGroup(kind);
    try { await loadFn(['wasm']); } catch (e2) { await resetGroup(kind); throw e2; }
  }
}
async function ensureModel(kind) {
  // Await any in-flight load so inference never runs on a null session.
  if (loading[kind]) { await loading[kind]; return; }
  const p = (async () => {
    if (kind === 'detector' && !detector.loaded) {
      await detector.load(await modelBuffer('detector'), ['wasm']);
    } else if (kind === 'ocr-baberu' && !baberu.loaded) {
      const vocabJson = await assetText(BABERU_VOCAB_ASSET);
      try {
        await loadWithWebgpuFallback(kind, loadBaberu);
      } catch (e) { await baberu.reset(); throw e; }
      baberu.setVocab(vocabJson);
    } else if (kind === 'inpaint' && !inpainter.loaded) {
      await loadWithWebgpuFallback(kind, async (providers) => {
        await inpainter.load(await modelBuffer('inpaint'), providers);
      });
    }
  })();
  loading[kind] = p;
  try { await p; } finally { delete loading[kind]; }
}

// (pixel payloads now travel via the IDB pixel bus — see pixel-bus.js)

// Run ids whose ML work must stop ASAP (see ML_CANCEL). Checked between
// units of work. An entry is dropped when a handler finishes for a run that
// was NOT cancelled; a cancelled run keeps its flag so the NEXT ML stage of
// the same run aborts immediately instead of silently running to completion.
const cancelledRuns = new Set();
function throwIfCancelled(runId) {
  if (runId && cancelledRuns.has(runId)) throw new Error('cancelled');
}
function releaseRun(runId) {
  if (runId && !cancelledRuns.has(runId)) cancelledRuns.delete(runId);
}

// Fast-path inpaint for uniform backgrounds: if the unmasked pixels have low
// variance, fill masked pixels with the median background color instead of
// running LaMa. Returns Uint8ClampedArray RGBA, or null if background is not
// uniform (caller falls back to LaMa).
function uniformBackgroundFill(rgba, mask, w, h) {
  // Sample unmasked pixels (stride to keep it fast)
  const rs = [], gs = [], bs = [];
  const stride = Math.max(1, Math.floor(Math.sqrt((w * h) / 2000)));
  let maskedCount = 0;
  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const i = y * w + x;
      if (mask[i]) { maskedCount++; continue; }
      const o = i * 4;
      rs.push(rgba[o]); gs.push(rgba[o + 1]); bs.push(rgba[o + 2]);
    }
  }
  if (rs.length < 10) return null;
  if (maskedCount === 0) return rgba; // nothing to inpaint — skip LaMa entirely
  // Median (robust to outliers)
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const mr = med(rs), mg = med(gs), mb = med(bs);
  // Std dev; uniform if low
  let vr = 0, vg = 0, vb = 0;
  for (let i = 0; i < rs.length; i++) {
    vr += (rs[i] - mr) ** 2; vg += (gs[i] - mg) ** 2; vb += (bs[i] - mb) ** 2;
  }
  const sr = Math.sqrt(vr / rs.length), sg = Math.sqrt(vg / rs.length), sb = Math.sqrt(vb / rs.length);
  if (sr > 12 || sg > 12 || sb > 12) return null; // not uniform
  // Fill masked pixels with median background color
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) {
      const o = i * 4;
      out[o] = mr; out[o + 1] = mg; out[o + 2] = mb; out[o + 3] = 255;
    }
  }
  return out;
}

const handlers = {
  [MSG.ML_PING]() {
    return { ok: true, loaded: { detector: detector.loaded, baberu: baberu.loaded, inpaint: inpainter.loaded } };
  },

  async [MSG.ML_ENSURE]({ model }) {
    await ensureModel(model);
    return { ok: true };
  },

  // Downloads run here (not the SW) so a long 197MB fetch can't be killed
  // mid-stream by service-worker shutdown.
  async [MSG.ML_DOWNLOAD]({ fileId }) {
    const spec = ALL_FILES.find(f => f.id === fileId);
    if (!spec) throw new Error('unknown model file ' + fileId);
    // Broadcast completion one-way: the SW's request/response channel does
    // not survive a service worker restart during a multi-minute download,
    // so the UI must not depend on this handler's return value.
    const announce = payload => chrome.runtime.sendMessage(
      { type: MSG.MODEL_PROGRESS, fileId, ...payload }).catch(() => {});
    try {
      const total = await downloadFileToIdb(spec.id, spec.url, (loaded, totalBytes) => {
        chrome.runtime.sendMessage({
          type: MSG.MODEL_PROGRESS, id: spec.group, fileId: spec.id,
          loaded, total: totalBytes,
        }).catch(() => {});
      });
      // Drop any session built from the old bytes so the fresh file is used.
      await resetGroup(spec.group);
      announce({ done: true });
      return { ok: true, bytes: total };
    } catch (e) {
      console.error('[ct-dl] download failed for', fileId + ':',
        String((e && e.message) || e).slice(0, 200));
      announce({ error: String((e && e.message) || e) });
      throw e;
    }
  },

  // ML_RESET {group} — drop loaded sessions for a model group (used after
  // model delete / download so stale bytes are never reused).
  async [MSG.ML_RESET]({ group }) {
    await resetGroup(group || '*');
    return { ok: true };
  },

  // ML_CANCEL {runId} — mark a run's in-flight ML work for abortion. The
  // detect/ocr/inpaint handlers check this flag between units of work and
  // throw, so a cancelled run stops burning CPU instead of finishing a page
  // the user already left.
  [MSG.ML_CANCEL]({ runId }) {
    if (runId) {
      cancelledRuns.add(runId);
      // Bound the set: a run cancelled between ML stages keeps its flag (so
      // the next stage aborts) and would otherwise never be released. Sets
      // iterate in insertion order, so this drops the oldest entries first.
      while (cancelledRuns.size > 64) cancelledRuns.delete(cancelledRuns.values().next().value);
    }
    return { ok: true };
  },

  async [MSG.ML_DETECT]({ key, width, height, threshold, runId, noStrip }) {
    throwIfCancelled(runId);
    const t0 = performance.now();
    // Pixel bytes arrive via the IDB pixel bus (see pixel-bus.js) — they do
    // not survive chrome.runtime messaging from the service worker.
    const raw = await pixelPeek(key);
    const buf = new Uint8ClampedArray(raw);
    let boxes;
    const runDetect = async () => {
      await ensureModel('detector');
      throwIfCancelled(runId);
      return detector.detect(buf, width, height, threshold, {
        shouldAbort: () => cancelledRuns.has(runId),
        noStrip: !!noStrip,
      });
    };
    try {
      boxes = await runDetect();
    } catch (e) {
      // OOM recovery: on Firefox all models share one WASM heap. If a previous
      // run left Baberu/LaMa loaded (~330MB), the detector can OOM even on a
      // small image — during model load or inference. Drop the heavy models
      // we don't need for detection and retry once; they reload on demand.
      if (!isOom(e)) throw e;
      await resetGroup('ocr-baberu');
      await resetGroup('inpaint');
      boxes = await runDetect();
    } finally {
      releaseRun(runId);
    }
    throwIfCancelled(runId);
    return { ok: true, boxes, ms: Math.round(performance.now() - t0), inputMean: +meanBrightness(buf).toFixed(4) };
  },

  async [MSG.ML_OCR]({ crops, runId, sourceLang }) {
    throwIfCancelled(runId);
    // OCR engine follows the source language — all languages use Baberu.
    const engine = ocrEngineForLang(sourceLang || 'ja');
    await ensureModel(engine);
    throwIfCancelled(runId);
    const t0 = performance.now();
    const results = [];
    // Stddev of a crop's grayscale pixels, sampled every 4th pixel. A
    // near-uniform crop (detector false positive on flat background) scores
    // ~1-2 from JPEG noise alone; real text — even faint — scores 30+ from
    // stroke contrast, so 3.0 is far below any readable text.
    const cropStddev = (u8) => {
      let n = 0, mean = 0, m2 = 0;
      for (let i = 0; i < u8.length; i += 16) {
        const g = (u8[i] + u8[i + 1] + u8[i + 2]) / 3;
        n++;
        const d = g - mean;
        mean += d / n;
        m2 += d * (g - mean);
      }
      return n > 1 ? Math.sqrt(m2 / (n - 1)) : 0;
    };
    try {
      for (const c of crops) {
        throwIfCancelled(runId);
        const raw = await pixelPeek(c.key);
        const u8 = new Uint8ClampedArray(raw);
        // Skip the model on blank crops: ~1ms variance check vs ~1s of
        // vision+prefill+autoregressive steps. Empty text flows downstream
        // exactly as if OCR had returned ''.
        if (cropStddev(u8) < 3.0) {
          results.push({ id: c.id, text: '', chars: 0, chunks: 0, hitCeiling: false, stopped: 'eos', skipped: true });
          continue;
        }
        // Baberu v1.1 reads up to ~256 chars; the chunked path is a rare
        // fallback for over-long crops, re-OCR'd in overlapping pieces.
        let r;
        try {
          r = await baberu.ocrChunked(u8, c.width, c.height, {
            lang: sourceLang || 'ja',
            shouldAbort: () => cancelledRuns.has(runId),
          });
        } catch (e) {
          // OOM recovery: drop the inpainter (206MB, not needed for OCR)
          // first to free memory. If Baberu is on WebGPU, downgrade it
          // to WASM and reload (the WebGPU run blew the heap) — the
          // downgrade sticks, so this model never retries WebGPU again
          // this session. Retry this crop once.
          if (!isOom(e) || c._oomRetried) throw e;
          await resetGroup('inpaint');
          if (providersFor('ocr-baberu')[0] === 'webgpu') {
            webgpuDowngraded.add('ocr-baberu');
            await baberu.reset();
            await ensureModel('ocr-baberu');
          }
          c._oomRetried = true;
          r = await baberu.ocrChunked(u8, c.width, c.height, {
            lang: sourceLang || 'ja',
            shouldAbort: () => cancelledRuns.has(runId),
          });
        }
        results.push({ id: c.id, text: r.text, chars: r.text.length, chunks: r.chunks, hitCeiling: r.hitCeiling, stopped: r.stopped });
      }
    } finally {
      releaseRun(runId);
    }
    // Guard against late completion after timeout/cancel: don't deliver
    // stale results if the run was cancelled while we were working.
    throwIfCancelled(runId);
    return { ok: true, results, ms: Math.round(performance.now() - t0), engine };
  },

  async [MSG.ML_INPAINT]({ patches, runId, attempt }) {
    // `attempt` (from ml-bridge.js): if this is a retry after a timed-out
    // call, namespace the `:out` result keys (`key:out#a2`) so a late
    // completion of the timed-out attempt can't clobber this retry's output.
    // The SW reads resKey from the response, so this is transparent to it.
    const outSuffix = attempt > 1 ? `#a${attempt}` : '';
    throwIfCancelled(runId);
    await ensureModel('inpaint');
    throwIfCancelled(runId);
    const t0 = performance.now();
    const results = [];
    // Long inpaints report progress: the Firefox background page sets
    // globalThis.__ctInpaintProgress (same module scope there — see
    // background-ff.js/service-worker.js). The Chrome offscreen document sets
    // it via offscreen-progress.js (forwarded to the service worker). Without
    // it a multi-minute tiled inpaint looks exactly like a stall.
    const reportInpaint = (frac) => {
      try { if (globalThis.__ctInpaintProgress) globalThis.__ctInpaintProgress(runId, frac); } catch { /* never break inpaint */ }
    };
    try {
      for (const [pi, p] of patches.entries()) {
        throwIfCancelled(runId);
        const rgbaRaw = await pixelPeek(p.key);
        const maskRaw = await pixelPeek(p.maskKey);
        const rgba = new Uint8ClampedArray(rgbaRaw);
        const mask = new Uint8Array(maskRaw);
        // Fast path: if the unmasked background is uniform, fill masked pixels
        // with the background color instead of running LaMa. Faster and
        // cleaner for white/paper backgrounds (common in manga bubbles).
        // Falls back to LaMa for textured/variegated backgrounds.
        const bgFill = uniformBackgroundFill(rgba, mask, p.width, p.height);
        let out;
        if (bgFill) {
          out = bgFill;
        } else {
          try {
            out = await inpainter.inpaintPatch(
              rgba, mask, p.width, p.height,
              () => cancelledRuns.has(runId),
              (done, total) => reportInpaint((pi + done / total) / patches.length));
          } catch (e) {
            // WebGPU run failure recovery: if LaMa is on WebGPU, ANY
            // run failure downgrades it to WASM, reloads, and retries
            // once — not just OOM. WebGPU can fail other ways too
            // (e.g. buffer_manager.cc WGPUBuffer errors, shader or
            // device errors), and those must also fall back instead
            // of failing the page. The downgrade sticks for this
            // session. Cancelled runs are never retried. If LaMa is
            // already on WASM, only an OOM gets the drop-others +
            // retry (as before). _oomRetried guards the single retry.
            if (p._oomRetried) throw e;
            const msg = String((e && e.message) || e || '');
            if (/cancel/i.test(msg)) throw e;
            const onWebgpu = providersFor('inpaint')[0] === 'webgpu';
            if (!onWebgpu && !isOom(e)) throw e;
            await resetGroup('detector');
            await resetGroup('ocr-baberu');
            if (onWebgpu) {
              webgpuDowngraded.add('inpaint');
              await inpainter.reset();
              await ensureModel('inpaint');
            }
            p._oomRetried = true;
            out = await inpainter.inpaintPatch(
              rgba, mask, p.width, p.height,
              () => cancelledRuns.has(runId),
              (done, total) => reportInpaint((pi + done / total) / patches.length));
          }
        }
        const resKey = p.key + ':out' + outSuffix;
        await pixelPut(resKey, out.buffer);
        results.push({ id: p.id, key: resKey, width: p.width, height: p.height });
        reportInpaint((pi + 1) / patches.length);
      }
    } finally {
      releaseRun(runId);
    }
    return { ok: true, results, ms: Math.round(performance.now() - t0) };
  },
};

// Exported for the Firefox background page, which hosts the ML sessions
// in-process instead of in an offscreen document (see background-ff.js and
// ml-bridge.js). Chrome keeps using the message listener below.
export const mlHandlers = handlers;

// Guarded: a worker importing this module may not have chrome.runtime.
// (Chrome offscreen doc and Firefox background page both have it, so their
// listener registers exactly as before.)
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage?.addListener) {
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const fn = handlers[msg && msg.type];
  if (!fn) return false; // not ours
  (async () => {
    try {
      sendResponse(await fn(msg));
    } catch (e) {
      console.error('[offscreen]', e);
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // async response
});
}
