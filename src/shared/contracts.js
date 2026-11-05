// Message + data contracts between the extension's four contexts.
// Image pixels travel as ArrayBuffer (RGBA Uint8ClampedArray backing store).
// Masks travel as ArrayBuffer (Uint8Array, values 0/1 unless noted).

export const MSG = {
  // popup -> SW
  TRANSLATE_PAGE: 'ct/translate-page',   // {} -> {ok, runId} | {ok:false, error}
  CANCEL_RUN: 'ct/cancel-run',           // {} -> {ok}
  GET_STATUS: 'ct/get-status',           // {} -> {state, progress, runId, stage}
  GET_MODELS: 'ct/get-models',           // {} -> {models:[{id,label,sizeMb,downloaded,bytes}]}
  DOWNLOAD_MODEL: 'ct/download-model',   // {id} -> {ok} (progress via MODEL_PROGRESS)
  DELETE_MODEL: 'ct/delete-model',       // {id} -> {ok}
  CHECK_AZURE: 'ct/check-azure',         // {} -> {ok, detail} | {ok:false, error}
  CHECK_LMSTUDIO: 'ct/check-lmstudio',   // {} -> {ok, detail} | {ok:false, error}
  PAGE_CACHE_STATS: 'ct/page-cache-stats', // {} -> {ok, count, bytes}
  CLEAR_PAGE_CACHE: 'ct/clear-page-cache', // {} -> {ok, count, bytes}
  GRANT_IMAGE_HOST: 'ct/grant-image-host', // {host} -> {ok} | {ok:false} (pill "Allow" button; re-runs the pipeline on grant)
  // SW -> popup (broadcast)
  MODEL_PROGRESS: 'ct/model-progress',   // {id, loaded, total}
  RUN_PROGRESS: 'ct/run-progress',       // {runId, stage, progress}
  // SW -> offscreen
  // Pixel bytes never travel in these messages: they go through the IDB pixel
  // bus (shared/pixel-bus.js) and only the lookup key crosses here.
  ML_PING: 'ml/ping',                    // {} -> {ok, loaded:{detector,baberu,inpaint}}
  ML_ENSURE: 'ml/ensure',                // {model:'detector'|'ocr-baberu'|'inpaint'} -> {ok} | {ok:false,error}
  ML_DETECT: 'ml/detect',                // {key,width,height,threshold,runId} -> {ok, boxes:[{xyxy,label,score}], ms, inputMean}
  ML_OCR: 'ml/ocr',                      // {crops:[{id,key,width,height}], sourceLang, runId} -> {ok, results:[{id,text,chars,chunks,hitCeiling}], ms, engine}
  ML_INPAINT: 'ml/inpaint',              // {patches:[{id,key,maskKey,width,height}], runId} -> {ok, results:[{id,key,width,height}], ms}
  ML_DOWNLOAD: 'ml/download',            // {fileId} -> {ok, bytes} (progress via MODEL_PROGRESS)
  ML_RESET: 'ml/reset',                  // {group} -> {ok} (drop loaded sessions)
  ML_CANCEL: 'ml/cancel',                // {runId} -> {ok} (abort in-flight ML work for a run)
  ML_DIAG: 'ml/diag',                    // MEASURE1 {runId} -> {ok, sharedArrayBuffer, crossOriginIsolated, hardwareConcurrency, numThreads, context} (realm thread facts, no model load)
  ML_INPAINT_PROGRESS: 'ml/inpaint-progress', // offscreen -> SW (one-way) {runId, frac} (pill progress + worker keep-alive)
  ML_GPU_INPAINT: 'ml/gpu-inpaint',      // Chrome GPU1: SW -> offscreen doc {patches, runId} -> {ok, results, ms, totalTiles} (doc owns one shared dedicated GPU worker across runs; doc realm itself never runs GPU sessions)
  ML_GPU_WARMUP: 'ml/gpu-warmup',        // Chrome GPU1: SW -> offscreen doc {runId} -> {ok} (pipeline start: create the shared GPU worker and load LaMa now, so the load overlaps detect/OCR/translate)
  ML_GPU_CANCEL: 'ml/gpu-cancel',        // Chrome GPU1: SW -> offscreen doc {runId} -> {ok} (watchdog hang only: terminate the shared GPU worker; idempotent)
  ML_BENCH_THREADS: 'ml/bench-threads',  // Chrome 2.0.13: SW -> offscreen doc {} -> {ok} (after a successful run: measure the best WASM thread count once, in the background; fire-and-forget)
  ML_BENCH_RESULT: 'ml/bench-result',    // Chrome 2.0.13: offscreen doc -> SW one-way {line} (benchmark progress/result lines for the panel log; no reply)
  // SW -> content (tabs.sendMessage)
  RUN_STARTED: 'ct/run-started',         // {runId} (marks the tab's current run; stale renders are ignored)
  RENDER: 'ct/render',                   // {runId, mode, imageDataUrl, width, height, blocks, timings, debug, srcUrl?}
  DEBUG_STAGE: 'ct/debug-stage',          // {runId, stage, payload, debug}
  PILL_NOTICE: 'ct/pill-notice',         // {text, sticky} (custom pill message, e.g. fallback status)
};

// IndexedDB: db 'ct-db', store 'models' (keyPath 'id').
// Record: {id, data:ArrayBuffer, bytes, downloadedAt}
// v2 adds store 'page-cache' (keyPath 'id') for translated pages; see
// shared/page-cache.js for its record shape.
const IDB_NAME = 'ct-db';
const IDB_STORE = 'models';
export const PAGE_CACHE_STORE = 'page-cache';

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PAGE_CACHE_STORE)) {
        db.createObjectStore(PAGE_CACHE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // A version upgrade (v1 -> v2) blocks until every other context closes its
    // connection. Without this the promise would never settle and the caller
    // would hang with no error — the offscreen document keeps its connection
    // cached for its whole lifetime, so this is reachable in practice.
    req.onblocked = () => reject(new Error(
      'another extension context is still holding the model database open — close other tabs of this extension and retry'));
  });
}

export async function idbGet(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(id);
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror = () => reject(rq.error);
  });
}

export async function idbPut(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    // An aborted transaction (quota exceeded, storage evicted mid-write) fires
    // neither oncomplete nor onerror, so without this the promise hangs
    // forever and the pipeline stalls with no message.
    tx.onabort = () => reject(tx.error || new DOMException('storage write aborted (quota?)', 'AbortError'));
  });
}

export async function idbDel(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException('storage delete aborted', 'AbortError'));
  });
}

// 1.4.0 (m5): list every key in the models store. Used by
// pixelPruneRun (shared/pixel-bus.js) to find a dead run's staged pixel
// payloads after background death (the pipeline finally never ran).
export async function idbKeys(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).getAllKeys();
    rq.onsuccess = () => resolve(rq.result || []);
    rq.onerror = () => reject(rq.error);
  });
}
