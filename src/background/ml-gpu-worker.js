// Firefox GPU ML worker — CLASSIC worker (not module), see ml-bridge.js.
// GPU1: dedicated worker for LaMa inpainting on WebGPU ONLY. It runs
// no other model: detector and Baberu stay on the shared WASM worker.
// Separate realm from the shared worker on purpose: a WebGPU session
// still runs inside a WASM instance and shares that realm's heap
// (1.3.4 finding), so GPU LaMa must never share a realm with WASM
// sessions. 2.0.6: the worker is KEPT ALIVE across runs (Chrome doc
// owns one shared instance) so the LaMa session loads once; it dies
// only on GPU failure/hang, worker error, or 10 idle minutes. On a
// failure the doc terminates it and the SW retries once on the shared
// WASM worker. User cancel stops the run's loop but keeps the worker.
// Reuses the offscreen handlers verbatim: same module, same IDB pixel
// bus and models, only the thread and the provider flag change.
//
// Why classic: ort.min.js is UMD, and its top-level `var ort` only
// becomes a global via a classic script load. A module worker kept `ort`
// module-scoped, so offscreen.js threw at import and the worker never
// started (1018p bug). importScripts gives the worker a real `self.ort`
// global; the ESM handler module then loads via dynamic import.
// Relative URLs resolve against this worker's own URL.
//
// Firefox workers have no `chrome` global, but the handler module loads
// model assets (Baberu vocab) via chrome.runtime.getURL — without this
// shim every OCR load fails with "chrome is not defined". Provide the
// minimal equivalent: getURL takes an extension-root-relative path, so
// resolve it against this worker's own origin (moz-extension://<id>/).
// The wasmPaths use and the message listener are already guarded, and
// downloads (the only sendMessage user) never run on the worker, so
// getURL is the only piece the worker needs.
if (typeof chrome === 'undefined') {
  globalThis.chrome = {
    runtime: {
      getURL: (path) => new URL(path, new URL('/', self.location.href)).href,
    },
  };
}

importScripts('../offscreen/vendor/ort.min.js');
importScripts('../offscreen/vendor/ort.webgpu.min.js'); // GPU1: WebGPU EP addon (requires ort.min.js first, not a replacement).

// GPU1 realm flag: set BEFORE dynamically importing offscreen.js, so
// that module's WEBGPU_KINDS is ['inpaint'] in THIS realm only. Every
// other realm (shared worker, background page, offscreen document)
// leaves the flag unset and stays WASM-only. Detector and Baberu are
// WASM-only even here: detector hardcodes ['wasm'], and 'ocr-baberu'
// is not in WEBGPU_KINDS.
globalThis.__ctGpuInpaintWorker = true;

Promise.all([
  import('../offscreen/offscreen.js'),
  import('../shared/contracts.js'),
]).then(([offscreen, contracts]) => {
  const mlHandlers = offscreen.mlHandlers;
  const MSG = contracts.MSG;
  // The inpaint handler reports progress through this hook — forward it
  // to the page (only inpaint reports progress; other handlers never call it).
  globalThis.__ctInpaintProgress = (runId, frac) => {
    try { self.postMessage({ type: 'inpaint-progress', runId, frac }); } catch {}
  };
  self.onmessage = async (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;
    try {
      const fn = mlHandlers[msg.type];
      if (!fn) throw new Error('ML worker has no handler for ' + msg.type);
      const res = await fn(msg);
      self.postMessage({ callId: msg.callId, runId: msg.runId, ok: true, res });
    } catch (err) {
      self.postMessage({ callId: msg.callId, runId: msg.runId, ok: false, error: String((err && err.message) || err) });
    }
  };
  // DIAGNOSTIC (temporary): log errors that escape the handler
  // try/catch (async callbacks, device callbacks) as plain text, so
  // the message survives even when the thrown value is an object the
  // console cannot expand.
  self.addEventListener('error', (ev) => {
    try { console.error('[ct-worker] uncaught error:', String((ev && ev.message) || ev || '')); } catch {}
  });
  self.addEventListener('unhandledrejection', (ev) => {
    try { console.error('[ct-worker] unhandled rejection:', String(((ev && ev.reason && ev.reason.message) || (ev && ev.reason) || ev || ''))); } catch {}
  });
  self.postMessage({ type: 'ml-ready' });
}).catch(() => {
  // Import failed (e.g. dynamic import unsupported): the page side falls
  // back to in-process compute on the ready timeout. Nothing else to do —
  // without the handlers this worker cannot run jobs.
});
