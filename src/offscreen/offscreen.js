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
import { Inpainter, tileOrigins } from './ml/inpaint.js';
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
// WASM threads ON, all detected cores, no cap (Chrome 2.0.3).
// Correction to the 1.2.10 note: 1.2.8 (threads on, full-res inpaint)
// works — threads are proven safe. 1.2.9 stalled because of half-res
// inpaint, not threads, so threads are back and half-res is removed
// (see inpaint.js). Set before any session is created (ensureModel
// below). Other users may have more cores than this Mac's 10, so the
// old 10 cap is removed: a 16-core machine uses 16 threads, a 4-core
// machine uses 4. Firefox is unaffected in practice:
// SharedArrayBuffer is off there, so ORT still runs single-threaded
// (thread-info numThreads 1) regardless of core count.
ort.env.wasm.numThreads = Math.max(1, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4);

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

// WebGPU PARKED (1.3.7) — all models WASM. It failed every way:
// detector OOM (1.3.0/1.3.1), Baberu hang at OCR 38% (1.3.4), LaMa
// buffer error (1.3.5), LaMa stall at inpaint 71% (1.3.6). A hang
// throws no error, so no error-only fallback can catch it — only a
// hang watchdog (per-run timeout + downgrade + retry) could, and no
// watchdog can be verified here (no GPU in this VM), so no more GPU
// guesses. 1.3.7 shipped no GPU code at all.
// GPU1 RETURN (LaMa only, dedicated GPU worker realm only): the
// missing pieces from 1.3.6 are now built — a background-side hang
// watchdog (ml-bridge.js runGpuInpaint, 60s no-progress), a separate
// GPU worker realm (ml-gpu-worker.js, terminated to reclaim GPU
// buffers), FIX1 recovery, keep-alives, and the panel log, so a GPU
// failure is observed in full and fails cleanly instead of freezing.
// Detector stays WASM-only (it hardcodes ['wasm'] below), Baberu
// stays WASM-only ('ocr-baberu' is never in this set). Only LaMa
// inpaint ever touches GPU, and only in the GPU worker realm: the
// flag below is set by ml-gpu-worker.js before importing this module,
// and unset everywhere else (shared worker, background page,
// offscreen document), where this set stays empty and all models
// stay WASM. Chrome GPU1: the offscreen document spawns the GPU worker
// (ML_GPU_INPAINT handler) but never sets the flag itself, so its own
// sessions stay WASM — only the spawned worker realm runs GPU. A WebGPU session still runs inside a WASM instance and
// shares its realm's heap (1.3.4 finding) — that is why GPU LaMa
// must never share a realm with WASM sessions.
const WEBGPU_KINDS = (typeof globalThis !== 'undefined' && globalThis.__ctGpuInpaintWorker) ? new Set(['inpaint']) : new Set([]);
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
  // 1.4.0 (m2): NO in-worker WASM fallback. Try WebGPU alone; on
  // creation failure, reset the group once (dispose any half-loaded
  // WebGPU sessions, or they leak GPU resources) and THROW the original
  // error, so the service worker downgrades to shared WASM and logs it
  // truthfully as "gpu failed". The old in-worker fallback made the
  // service worker log "gpu done" while WASM actually ran inside the
  // GPU worker — and stacked WASM attempts on OOM (in-worker retry,
  // then the service-worker retry). This branch only ever runs in the
  // GPU worker realm (WEBGPU_KINDS is empty elsewhere), and the
  // service-worker downgrade path already handles GPU failure cleanly.
  const providers = providersFor(kind);
  try {
    await loadFn(providers);
  } catch (e) {
    if (providers[0] !== 'webgpu') throw e;
    await resetGroup(kind);
    throw e;
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

// Chrome GPU1: GPU jobs owned by the offscreen document (document realm
// only — the document spawns the GPU worker; the service worker cannot
// spawn workers). Map runId -> {worker, pending, terminated}. The GPU
// worker has its own cancelledRuns set, so the document's flag alone
// cannot stop it: cancel paths terminate the job here (see ML_CANCEL
// and ML_GPU_CANCEL below). Registry stays empty in worker realms —
// workers never run ML_GPU_INPAINT (document guard in that handler),
// so terminating here is a no-op there.
const chromeGpuJobs = new Map();
function terminateChromeGpuJob(runId, err) {
  const job = chromeGpuJobs.get(runId);
  if (!job) return;
  chromeGpuJobs.delete(runId);
  job.terminated = true;
  try { job.pending?.reject(err || new Error('GPU worker terminated')); } catch {}
  job.pending = null;
  try { job.worker.terminate(); } catch {}
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
      // Chrome GPU1: also terminate this run's GPU worker. The worker has
      // its own cancelledRuns set, so the flag above cannot stop it, and
      // a blocked GPU run would otherwise keep burning after cancel.
      // No-op in worker realms (their registry is always empty).
      terminateChromeGpuJob(runId, Object.assign(new Error('cancelled'), { cancelled: true }));
    }
    return { ok: true };
  },

  // ML_GPU_CANCEL {runId} — Chrome GPU1: terminate this run's GPU worker
  // (same termination as ML_CANCEL, but without touching cancelledRuns —
  // used by the SW watchdog, which downgrades rather than cancels).
  [MSG.ML_GPU_CANCEL]({ runId }) {
    if (runId) terminateChromeGpuJob(runId, Object.assign(new Error('cancelled'), { cancelled: true }));
    return { ok: true };
  },

  // ML_GPU_INPAINT {patches, runId} — Chrome GPU1: offscreen-document
  // only. The SW cannot spawn workers, so the document spawns the
  // dedicated GPU worker (ml-gpu-worker.js, __ctGpuInpaintWorker flag set
  // there, WEBGPU_KINDS ['inpaint'] in that realm only), forwards this
  // run's ML_INPAINT to it, forwards its progress through
  // __ctInpaintProgress (offscreen-progress.js throttles to 500ms, plus
  // the final 1.0), and terminates the worker after the reply. The
  // document realm itself never runs a GPU session: its own WEBGPU_KINDS
  // stays empty, so its WASM sessions are untouched. Results are pixel
  // keys in IDB, not worker memory, so terminating after a reply loses
  // nothing. Errors are prefixed GPU_SKIPPED when the failure is absence
  // (no navigator.gpu, worker creation/ready failure) rather than a GPU
  // run failure — the SW logs those as "skipped", not "failed", and falls
  // back to the single WASM path either way. Any other error is a GPU
  // run failure and the SW downgrades (once) to WASM.
  async [MSG.ML_GPU_INPAINT]({ patches, runId }) {
    if (typeof document === 'undefined') throw new Error('GPU_SKIPPED: ml/gpu-inpaint is offscreen-document-only');
    if (typeof navigator === 'undefined' || !navigator.gpu) throw new Error('GPU_SKIPPED: no navigator.gpu in the offscreen document realm, using WASM path');
    if (!patches || !patches.length) return { ok: true, results: [], ms: 0, totalTiles: 0 };
    throwIfCancelled(runId);
    // A stale job for this run (one inpaint per run, so this should not
    // happen) dies first rather than running alongside the new one.
    terminateChromeGpuJob(runId, new Error('replaced by a new GPU job'));
    let worker;
    try {
      worker = new Worker(chrome.runtime.getURL('src/background/ml-gpu-worker.js'));
    } catch (e) {
      throw new Error('GPU_SKIPPED: GPU worker creation failed: ' + String((e && e.message) || e));
    }
    const job = { worker, pending: null, terminated: false };
    chromeGpuJobs.set(runId, job);
    // 1.4.0 (m9): ready latency is measured so the panel log can tell
    // slow-start GPU from missing GPU. The ready window is 15 s (was
    // 5 s): a slow/cold start used to be marked "skipped", so GPU was
    // never used and every run paid 5 s + WASM time.
    let readyMs = 0;
    const readyT0 = performance.now();
    try {
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => {
          reject(new Error('GPU_SKIPPED: GPU worker did not become ready after 15s'));
        }, 15000);
        worker.onmessage = (e) => {
          const d = e && e.data;
          if (!d) return;
          if (d.type === 'ml-ready') {
            clearTimeout(to);
            readyMs = Math.round(performance.now() - readyT0);
            worker.onmessage = (ev) => {
              const m = ev && ev.data;
              if (!m) return;
              if (m.type === 'inpaint-progress') {
                try { if (globalThis.__ctInpaintProgress) globalThis.__ctInpaintProgress(runId, m.frac); } catch {}
                return;
              }
              if (m.callId == null || !job.pending) return;
              const p = job.pending; job.pending = null;
              if (m.ok) p.resolve(m.res);
              else p.reject(new Error(m.error || 'GPU worker failed'));
            };
            worker.onerror = (ev) => {
              try { job.pending?.reject(new Error('GPU worker failed: ' + String((ev && ev.message) || ev || ''))); } catch {}
              job.pending = null;
            };
            resolve();
          }
        };
        worker.onerror = (ev) => {
          clearTimeout(to);
          reject(new Error('GPU worker failed to start: ' + String((ev && ev.message) || ev || '')));
        };
      });
      throwIfCancelled(runId);
      const res = await new Promise((resolve, reject) => {
        job.pending = { resolve, reject };
        try {
          worker.postMessage({ type: MSG.ML_INPAINT, runId, callId: 1, patches });
        } catch (e) {
          job.pending = null;
          reject(e);
        }
      });
      return { ok: true, results: (res && res.results) || [], ms: (res && res.ms) || 0, totalTiles: (res && res.totalTiles) || 0, readyMs };
    } finally {
      // If cancel already deleted the job, this is a no-op (the worker is
      // already terminated). Otherwise terminate now: results are IDB
      // keys, so terminating after a reply loses nothing, and it is the
      // GPU-buffer reclaim on every path (success, error, hang-by-SW).
      if (chromeGpuJobs.get(runId) === job) terminateChromeGpuJob(runId, null);
    }
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
          // first to free memory, then retry this crop once. Baberu is
          // WASM-only by design (1.3.4 Baberu hang on GPU), so there is
          // deliberately no GPU downgrade path here — the old branch
          // checking providersFor('ocr-baberu') for 'webgpu' could never
          // run and was removed in 1.4.0 (m11).
          if (!isOom(e) || c._oomRetried) throw e;
          await resetGroup('inpaint');
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

  // MEASURE1 diagnostic: report the WASM thread facts of the realm
  // actually running ML (Firefox classic worker or Chrome offscreen
  // document — same module, both hosts). No model load, no session use,
  // so it cannot disturb a run. SharedArrayBuffer is what ORT needs for
  // threads; without it ORT silently runs 1 thread. `context` tells
  // which realm answered: 'worker' (no document) vs 'document'.
  [MSG.ML_DIAG]() {
    let numThreads = null;
    try { numThreads = (typeof ort !== 'undefined' && ort.env && ort.env.wasm) ? ort.env.wasm.numThreads : null; } catch { numThreads = null; }
    let sharedArrayBuffer = false;
    try { sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'; } catch { sharedArrayBuffer = false; }
    let crossOriginIsolated = null;
    try { crossOriginIsolated = (typeof globalThis !== 'undefined' && 'crossOriginIsolated' in globalThis) ? globalThis.crossOriginIsolated : null; } catch { crossOriginIsolated = null; }
    let hardwareConcurrency = null;
    try { hardwareConcurrency = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || null; } catch { hardwareConcurrency = null; }
    const context = (typeof document !== 'undefined') ? 'document' : 'worker';
    return { ok: true, sharedArrayBuffer, crossOriginIsolated, hardwareConcurrency, numThreads, context };
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
    // MEASURE1: total LaMa tiles across all patches, by the same
    // tileOrigins math inpaintPatch uses (a patch fitting TILE_MAX is
    // 1 tile, otherwise xs * ys). Fast-path patches still count: this
    // is the tiling shape of the page, not a LaMa-run counter.
    let totalTiles = 0;
    try {
      for (const p of patches) totalTiles += tileOrigins(p.width).length * tileOrigins(p.height).length;
    } catch { totalTiles = 0; }
    // DIAGNOSTIC (temporary): total work, so the log shows how many
    // patches the run had (not a guessed count).
    console.error('[ct-diag] inpaint start run ' + runId + ' patches ' + patches.length);
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
            // GPU1: in the dedicated GPU worker realm, do NOT retry
            // inside the worker on a GPU run failure. The background
            // terminates this worker (reclaiming GPU buffers) and
            // retries once on the preloaded shared WASM worker, which
            // is faster than loading WASM here and avoids a second
            // retry (handler retry + background retry would be two).
            // WASM OOM logic below is untouched: it only runs when
            // the provider is already WASM (shared worker, offscreen
            // document, or a GPU worker without navigator.gpu).
            if (providersFor('inpaint')[0] === 'webgpu' && globalThis.__ctGpuInpaintWorker) throw e;
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
    return { ok: true, results, ms: Math.round(performance.now() - t0), totalTiles };
  },
};

// Exported for the Firefox background page, which hosts the ML sessions
// in-process instead of in an offscreen document (see background-ff.js and
// ml-bridge.js). Chrome keeps using the message listener below.
export const mlHandlers = handlers;

// Guarded: a worker importing this module may not have chrome.runtime.
// Document realm only (Chrome offscreen doc, Firefox background page —
// both have a document, so their listeners register exactly as before).
// The document guard is load-bearing for Chrome GPU1: a Dedicated Worker
// in Chrome may expose chrome.runtime.onMessage, and without it the GPU
// worker realm would ALSO receive the SW's runtime messages (ML_INPAINT,
// ML_CANCEL, ...) and run them a second time in the GPU realm —
// shadowing the document's reply and clobbering pixel outputs. Workers
// never used this listener anyway (they use self.onmessage), so
// excluding them changes nothing for Firefox.
if (typeof document !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime?.onMessage?.addListener) {
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
