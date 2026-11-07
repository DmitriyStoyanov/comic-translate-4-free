// Model inventory: exact HuggingFace artifacts (verified 2026-09-27).
// Downloaded on first use into IndexedDB ('ct-db'/'models'), never bundled.
import { openDb, idbGet, idbPut, idbDel, MSG } from './contracts.js';

const hf = (repo, file) => `https://huggingface.co/${repo}/resolve/main/${file}`;

export const MODEL_GROUPS = [
  {
    id: 'detector', labelKey: 'model_detector', label: 'Bubble/text detector (RT-DETR-v2)', required: true,
    files: [
      { id: 'detector', file: 'detector-v4-s_int8.onnx', bytes: 11120765,
        url: hf('ogkalu/comic-text-and-bubble-detector', 'detector-v4-s_int8.onnx') },
    ],
  },
  {
    id: 'inpaint', labelKey: 'model_inpaint', label: 'LaMa manga inpainter', required: true,
    files: [
      { id: 'inpaint', file: 'lama-manga-dynamic.onnx', bytes: 206291843,
        url: hf('ogkalu/lama-manga-onnx-dynamic', 'lama-manga-dynamic.onnx') },
    ],
  },
  {
    id: 'ocr-baberu', labelKey: 'model_baberu', label: 'Baberu OCR (Japanese + English + Chinese Simplified/Traditional, manga-trained)',
    files: [
      // v1.2 (2026-10-26): retrained with Manga109-s human labels (sound
      // effects 50%->74%, handwriting 60%->67%). All three files change,
      // but sizes are IDENTICAL to v1.1 (quantization fixes them) — so the
      // IDs bump (-v12): the downloader skips files whose cached size
      // matches, and same IDs would silently keep v1.1 weights.
      { id: 'ocr-baberu-vision-v12', file: 'vision_int4.onnx', bytes: 52293486,
        url: hf('genshiai-daichi/baberu-ocr', 'onnx/vision_int4.onnx') },
      { id: 'ocr-baberu-prefill-v12', file: 'decoder_prefill_int8.onnx', bytes: 35133596,
        url: hf('genshiai-daichi/baberu-ocr', 'onnx/decoder_prefill_int8.onnx') },
      { id: 'ocr-baberu-step-v12', file: 'decoder_step_int8.onnx', bytes: 34715466,
        url: hf('genshiai-daichi/baberu-ocr', 'onnx/decoder_step_int8.onnx') },
    ],
  },
  {
    id: 'ocr-ppocr-latin', labelKey: 'model_ppocr_latin',
    label: 'PP-OCRv6 Latin OCR (Italian + German + French + Spanish + Portuguese + Dutch + Danish + Norwegian)',
    files: [
      // Latin-script languages only: Baberu reads ja/en/zh and hallucinates
      // English gibberish on Italian/German/etc. bubbles, so pinned Latin
      // sources route here (ocrEngineForLang). rec-only — the detector's
      // text boxes become crops, split into lines in ml/ppocr.js.
      // PP-OCRv6 small rec (PaddlePaddle official ONNX, 2026-11-07) replaces
      // the PP-OCRv5 latin mobile rec (7.9MB). Its 18.7k-entry dict covers
      // all Latin accents (è í ü ñ ç ø å ß) and it read 4/4 accented it/de/
      // fr/da test lines exactly at ~100-170ms/line in WASM. Medium (76MB)
      // also 4/4 at ~450ms; tiny (4.5MB) mangled spaces/accents. The earlier
      // PP-OCRv5 SERVER rec was rejected: its dict lacks è/í, it dropped
      // characters, and cost ~25s per line.
      // New file ID (-v6s): size changed, and the old ID must not be reused.
      { id: 'ocr-ppocr-latin-v6s', file: 'inference.onnx', bytes: 21159378,
        url: hf('PaddlePaddle/PP-OCRv6_small_rec_onnx', 'inference.onnx') },
    ],
  },
];

// Latin-script source languages served by PP-OCRv6 small. nb = Norwegian
// Bokmål, da = Danish — both verified on this model (2026-11-07).
export const LATIN_LANGS = new Set(['it', 'de', 'fr', 'es', 'pt', 'nl', 'da', 'nb']);

// OCR engine routing by source language (LANGS in shared/settings.js):
//   ja/en/zh-CN/zh-TW/auto -> Baberu ('ocr-baberu' group; manga-trained)
//   Latin (it/de/fr/es/pt/nl/da/nb) -> PP-OCRv6 small ('ocr-ppocr-latin')
// 'auto' stays Baberu: detection needs the OCR'd text, and Baberu is the
// only engine that reads CJK/kana — a Latin page under 'auto' reads as
// English gibberish, so pin the Latin language for the latin engine.
// (manga-ocr removed 2026-09-29: superseded by Baberu for Japanese.
// Pororo + PP-OCRv5 en/chinese models removed 2026-09-28: superseded.
// PP-OCRv6 small removed 2026-09-29: Baberu covers Traditional Chinese.
// PP-OCRv5 Korean removed 2026-09-29: OCR quality too low for translation.)
export function ocrEngineForLang(lang) {
  return LATIN_LANGS.has(lang) ? 'ocr-ppocr-latin' : 'ocr-baberu';
}

// Baberu character vocab, bundled (JSON array; id>=4 -> charset[id-4]).
// From genshiai-daichi/baberu-ocr tokenizer/vocab.json.
export const BABERU_VOCAB_ASSET = 'src/offscreen/ml/dicts/baberu-vocab.json';

// PP-OCR CTC dictionaries, bundled (one line per class; class 0 = blank).
export const PPOCR_DICT_ASSET = {
  'ocr-ppocr-latin': 'src/offscreen/ml/dicts/ppocrv6-latin.txt',
};

export const ALL_FILES = MODEL_GROUPS.flatMap(g =>
  g.files.map(f => ({ ...f, group: g.id, groupLabel: g.label })));

export async function getModelStatus() {
  const db = await openDb();
  const out = [];
  for (const g of MODEL_GROUPS) {
    const files = [];
    let done = true, sizeMismatch = false;
    for (const f of g.files) {
      const rec = await idbGet(db, f.id);
      const bytesOk = !!rec && rec.bytes === f.bytes;
      files.push({
        id: f.id, file: f.file, bytes: rec ? rec.bytes : 0,
        expectedBytes: f.bytes, downloaded: !!rec, bytesOk,
      });
      if (!rec) { done = false; continue; }
      if (!bytesOk) { done = false; sizeMismatch = true; }
    }
    out.push({ id: g.id, label: g.label, labelKey: g.labelKey, required: !!g.required, downloaded: done, sizeMismatch, files });
  }
  return out;
}

export async function deleteModelGroup(groupId) {
  const db = await openDb();
  const g = MODEL_GROUPS.find(x => x.id === groupId);
  if (!g) return;
  for (const f of g.files) {
    const rec = await idbGet(db, f.id).catch(() => null);
    if (rec && rec.chunks) await deleteChunks(db, f.id, rec.chunks);
    await idbDel(db, f.id);
  }
}

// One-time cleanup for model files whose groups were removed from
// MODEL_GROUPS (Latin/Russian PP-OCRv5, 2026-09-28; Pororo + PP-OCRv5
// en/chinese, superseded 2026-09-28; manga-ocr encoder/decoder, superseded
// 2026-09-29 by Baberu): with no group row left in the UI
// there'd be no way to delete them otherwise.
// Baberu v1.0 decoders (2026-10-06): superseded by v1.1 (-v11 IDs); pruned
// before the v1.1 download so users don't carry ~70MB of stale weights.
// Baberu v1.1 files (2026-10-26): superseded by v1.2 (-v12 IDs); pruned
// before the v1.2 download so users don't carry ~122MB of stale weights.
// 'ocr-ppocr-latin' (PP-OCRv5 latin mobile rec file ID) is pruned again:
// superseded by 'ocr-ppocr-latin-v6s' (PP-OCRv6 small), so users don't keep
// ~7.9MB of stale weights. The GROUP id 'ocr-ppocr-latin' is unchanged.
const PRUNED_MODEL_IDS = ['ocr-ppocr-latin', 'ocr-ppocr-eslav', 'ocr-pororo', 'ocr-ppocr-en', 'ocr-ppocr-chinese', 'ocr-ppocrv6', 'ocr-ppocr-ko', 'ocr-encoder', 'ocr-decoder-init', 'ocr-decoder-step', 'ocr-baberu-prefill', 'ocr-baberu-step', 'ocr-baberu-vision', 'ocr-baberu-prefill-v11', 'ocr-baberu-step-v11'];
export { PRUNED_MODEL_IDS };
// Fingerprint of the model list (group + file IDs + expected sizes).
// URLs are excluded on purpose: a URL-only change needs no re-download
// (the downloader skips on matching size), while an ID or size change
// means a new or changed file must be downloaded. Used by the SW's
// onInstalled handler to lead the user to the models section only when
// an update actually makes a download necessary.
export function computeModelFingerprint() {
  return JSON.stringify(MODEL_GROUPS.map(g => [g.id, g.files.map(f => [f.id, f.bytes])]));
}
export async function pruneModelIds(ids) {
  const db = await openDb();
  for (const id of ids) {
    try {
      const rec = await idbGet(db, id).catch(() => null);
      if (!rec) continue;
      if (rec.chunks) await deleteChunks(db, id, rec.chunks);
      await idbDel(db, id);
    } catch { /* best effort */ }
  }
}

// ---- chunked model storage ----
// A model file is stored as N fixed-size IDB records plus a small manifest:
//   { id: fileId, bytes, chunks, downloadedAt }   <- manifest (written last)
//   { id: `${fileId}#${i}`, data: ArrayBuffer }    <- chunk i (8 MB each)
// A single IDB value as large as a model file (200+ MB) fails: the put
// throws UnknownError in a page and kills an offscreen document outright.
// Single-record files written by older builds ({ id, data, bytes }) are
// still read and deleted, so already-downloaded models keep working.
const IDB_CHUNK = 8 * 1024 * 1024;
const chunkKey = (fileId, i) => `${fileId}#${i}`;

async function deleteChunks(db, fileId, n) {
  for (let i = 0; i < n; i++) {
    try { await idbDel(db, chunkKey(fileId, i)); } catch { /* already gone */ }
  }
}

export async function readChunked(db, fileId, manifest) {
  const buf = new Uint8Array(manifest.bytes);
  let off = 0;
  for (let i = 0; i < manifest.chunks; i++) {
    const rec = await idbGet(db, chunkKey(fileId, i));
    if (!rec || !rec.data) {
      throw new Error(`model "${fileId}" is missing chunk ${i} of ${manifest.chunks} — delete it in the popup and download again`);
    }
    const u8 = new Uint8Array(rec.data);
    buf.set(u8, off);
    off += u8.length;
  }
  if (off !== manifest.bytes) {
    throw new Error(`model "${fileId}" reassembled to ${off} bytes but should be ${manifest.bytes} — delete it in the popup and download again`);
  }
  return buf.buffer;
}

// Download one file with progress. Runs in the offscreen document (a service
// worker can be killed mid-download); progress is broadcast to the UI.
// Bytes stream straight into 8 MB IDB chunks — the file is never held whole
// in memory and no single IDB value is large. The byte size is verified
// against the spec — a truncated or wrong file is rejected instead of being
// cached silently.
export async function downloadFileToIdb(fileId, url, onProgress) {
  const spec = ALL_FILES.find(f => f.id === fileId);
  const db = await openDb();
  // Already cached (either storage format) with the right size? Skip.
  const existing = await idbGet(db, fileId);
  if (existing && spec && spec.bytes && existing.bytes === spec.bytes) return existing.bytes;
  // Clear any stale or partial records before writing.
  if (existing) {
    if (existing.chunks) await deleteChunks(db, fileId, existing.chunks);
    await idbDel(db, fileId);
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download failed (${resp.status}) for ${fileId}`);
  const total = parseInt(resp.headers.get('content-length') || '0', 10);
  const reader = resp.body.getReader();
  let idx = 0, loaded = 0;
  let pending = [], pendingLen = 0;
  const flushChunk = async () => {
    if (!pendingLen) return;
    const buf = new Uint8Array(pendingLen);
    let off = 0;
    for (const c of pending) { buf.set(c, off); off += c.length; }
    pending = []; pendingLen = 0;
    await idbPut(db, { id: chunkKey(fileId, idx++), data: buf.buffer });
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending.push(value);
    pendingLen += value.length;
    loaded += value.length;
    onProgress && onProgress(loaded, total);
    if (pendingLen >= IDB_CHUNK) await flushChunk();
    // Some proxies/middleboxes deliver every byte but never terminate the
    // stream — without this, the download hangs at 100% forever. Once we
    // hold the advertised content-length, stop waiting for {done: true}.
    if (total > 0 && loaded >= total) break;
    // yield so progress messages flush
    await new Promise(r => setTimeout(r, 0));
  }
  try { await reader.cancel(); } catch { /* stream already closed */ }
  await flushChunk();
  if (spec && spec.bytes && loaded !== spec.bytes) {
    await deleteChunks(db, fileId, idx); // don't leave a bad partial file
    throw new Error(
      `downloaded ${fileId} is ${loaded} bytes but should be ${spec.bytes} — ` +
      `the download was truncated or is the wrong file. Please try again.`);
  }
  await idbPut(db, { id: fileId, bytes: loaded, chunks: idx, downloadedAt: Date.now() });
  return loaded;
}

export { MSG };
