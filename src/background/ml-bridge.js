// ML host bridge: how the pipeline reaches the ONNX sessions.
// - Chrome: an offscreen document hosts the sessions; calls go over
//   chrome.runtime messaging (pixel bytes travel via the IDB pixel bus).
// - Firefox: no offscreen API — ML runs on a dedicated worker (ml-worker.js)
//   hosting the same handlers, so the background page (main thread) stays
//   free to monitor and restart it. In-process handlers registered by
//   background-ff.js (globalThis.__ctMlHandlers) remain only as a fallback
//   when the worker itself cannot start.
import { MSG } from '../shared/contracts.js';

export function directHandlers() {
  return (typeof globalThis !== 'undefined' && globalThis.__ctMlHandlers) || null;
}

export async function mlHostAlive() {
  const direct = directHandlers();
  if (direct) {
    try {
      const r = await direct[MSG.ML_PING]({});
      return !!(r && r.ok);
    } catch { return false; }
  }
  // Bounded: a doc blocked on hung WASM can never answer a ping, and an
  // unbounded sendMessage would hang ensure/restart with it. A blocked doc
  // reads as dead, so the caller closes + recreates it instead of waiting.
  try {
    const r = await Promise.race([
      chrome.runtime.sendMessage({ type: MSG.ML_PING }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('ping timeout')), 3000)),
    ]);
    return !!(r && r.ok);
  } catch { return false; }
}

// Serializes offscreen-document creation: two concurrent callMl()s can both
// see !alive and both call createDocument; the second throws "Only one
// offscreen document". The loser waits for (or reaps) the winner's document.
let creatingPromise = null;
export async function ensureMlHost() {
  if (await mlHostAlive()) return;
  if (directHandlers()) return; // Firefox: the host is this page; handlers are ready.
  if (typeof chrome.offscreen === 'undefined') {
    throw new Error('this browser does not support offscreen documents — ML cannot run');
  }
  // Two concurrent callMl()s can both see !alive and both call createDocument;
  // the second throws "Only one offscreen document". Serialize creation so the
  // loser waits for (or reaps the benefit of) the winner's document.
  if (!creatingPromise) {
    creatingPromise = (async () => {
      try {
        await chrome.offscreen.createDocument({
          url: 'src/offscreen/offscreen.html',
          reasons: ['WORKERS'],
          justification: 'Host ONNX Runtime Web (WASM) sessions for manga translation models',
        });
      } catch (e) {
        // "Only one offscreen document" / "already exists" means someone else
        // won the race — treat as success and verify below.
        if (!/already|only one/i.test(String((e && e.message) || e))) throw e;
      }
      // Poll for readiness: creation resolves before the document's scripts run.
      for (let i = 0; i < 10; i++) {
        if (await mlHostAlive()) return;
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error('ML host failed to start');
    })().finally(() => { creatingPromise = null; });
  }
  await creatingPromise;
}

// ORT's wasm backend aborts with "Aborted(InternalError: out of memory)"
// when its linear memory can't grow, which InferenceSession.create reports
// as "no available backend found". The raw text means nothing to a user, so
// translate that signature into an actionable message. `type` names the model
// group that was running so the message says which stage ran out of memory.
const ML_GROUP_FOR_TYPE = {
  [MSG.ML_DETECT]: 'text detector',
  [MSG.ML_OCR]: 'OCR',
  [MSG.ML_INPAINT]: 'inpainter',
  [MSG.ML_ENSURE]: 'model',
};
const OOM_RE = /out of memory|no available backend|aborted\s*\(/i;
function mlHostError(type, raw) {
  const m = String((raw && raw.message) || raw || '');
  // DIAGNOSTIC (temporary): print the FULL message as plain text. The
  // user-facing error below truncates to 160 chars, and thrown objects
  // cannot be expanded in the console, so without this line the cause
  // is unreadable. Keep this log in the real fix too.
  console.error('[ct] ML failure:', m);
  if (OOM_RE.test(m)) {
    const group = ML_GROUP_FOR_TYPE[type] || 'translation engine';
    // Both browsers run ML off the main thread now (Chrome offscreen
    // document, Firefox worker), and a failure here restarts that thread —
    // so the next run starts clean. No browser restart is needed.
    return new Error(`Out of memory while running the ${group} — the ML thread was restarted automatically. Try again.`);
  }
  return new Error('ML host error: ' + m.slice(0, 160));
}

// Per-stage timeouts for ML calls (ms). A hung WASM session or dead
// offscreen document would otherwise wedge the run forever — the await
// never resolves, the run entry leaks, pixel payloads accumulate, and
// Cancel can't help because runPipeline's finally never runs.
const ML_TIMEOUT_MS = {
  [MSG.ML_DETECT]: 30 * 1000,
  [MSG.ML_OCR]: 60 * 1000,
  [MSG.ML_INPAINT]: 120 * 1000,
};
const ML_TIMEOUT_DEFAULT_MS = 90 * 1000;

// Attempt tracking per (runId, type, key): if a callMl times out and the
// caller retries the same ML op, the retry must not reuse the timed-out
// call's pixel keys — a late completion could otherwise clobber the retry's
// payload (notably inpaint's `:out` result keys). The attempt number rides
// along in msg.attempt; handlers namespace their output keys when > 1.
const mlAttempts = new Map(); // `${runId}::${type}::${key}` -> count
function nextAttempt(msg) {
  const k = `${msg.runId || ''}::${msg.type}::${msg.key || ''}`;
  const n = (mlAttempts.get(k) || 0) + 1;
  mlAttempts.set(k, n);
  // Bound the map: runs are short-lived; drop the oldest entry first
  // (Maps iterate in insertion order).
  if (mlAttempts.size > 512) mlAttempts.delete(mlAttempts.keys().next().value);
  return n;
}

// ---------------------------------------------------------------- Firefox ML worker
// ALL ML compute on Firefox runs on this worker (detect, OCR, inpaint,
// ensure, cancel) — never on the background page. The background page is
// the main thread: it must always stay free to monitor, time, and restart
// the worker. Any ML type left in-process can block the page's own thread,
// and then callMl's timeout (which lives on that same thread) can never
// fire: silent hang, no message. In the worker, the page's timer fires
// while the worker computes, so a stuck ML op becomes a timeout error and
// the worker is terminated — the next run gets a fresh worker, no browser
// restart. The worker reuses the offscreen handlers verbatim (same module,
// same IDB pixel bus and models) — only the thread changes. Chrome never
// reaches this: directHandlers() is null there and ML keeps going through
// the offscreen document.
//
// The worker is CLASSIC (not module): ort.min.js is UMD, and its top-level
// `var ort` only becomes a global via a classic script load. A module
// worker kept `ort` module-scoped, so offscreen.js threw at import and the
// worker never started (1018p bug — silent fallback, same hang). The
// worker importScripts ort, dynamically imports the handlers, then posts
// 'ml-ready'; no job is posted before that, and a missing ready (5s)
// falls back to in-process compute instead of hanging.
//
// Replies are keyed by callId (not runId): a run's cancel can overlap its
// own compute call, and a runId-keyed map would drop one of them.
// Progress (inpaint only) is routed by runId to __ctInpaintProgress.
let mlWorker = null;
let mlWorkerReady = null; // Promise<Worker> once 'ml-ready' arrives
let mlCallSeq = 0;
const mlPending = new Map(); // callId -> {resolve, reject, runId}
const ML_WORKER_FALLBACK = 'ML worker unavailable — falling back to in-process';

function mlWorkerFallbackError() {
  return Object.assign(new Error(ML_WORKER_FALLBACK), { mlWorkerFallback: true });
}

function killMlWorker() {
  try { mlWorker?.terminate(); } catch {}
  mlWorker = null;
  mlWorkerReady = null;
}

function failMlPending(errFactory) {
  const pend = [...mlPending.values()];
  mlPending.clear();
  for (const p of pend) {
    try { p.reject(errFactory()); } catch {}
  }
}

function routeMlMessage(e) {
  const d = e.data;
  if (!d) return;
  if (d.type === 'inpaint-progress') {
    try { globalThis.__ctInpaintProgress?.(d.runId, d.frac); } catch {}
    return;
  }
  if (d.callId == null) return;
  const p = mlPending.get(d.callId);
  if (!p) return;
  mlPending.delete(d.callId);
  if (d.ok) p.resolve(d.res);
  // A handler error is the handler's answer, not a worker failure: surface
  // it — except out-of-memory, where the main thread's memory pool may
  // still have room and a direct retry is worth one attempt.
  else if (OOM_RE.test(String(d.error || ''))) p.reject(mlWorkerFallbackError());
  else p.reject(new Error(d.error || 'ML worker failed'));
}

function ensureMlWorker() {
  if (mlWorker) return mlWorkerReady;
  const w = new Worker(chrome.runtime.getURL('src/background/ml-worker.js')); // classic worker
  mlWorker = w;
  mlWorkerReady = new Promise((resolve, reject) => {
    let settled = false;
    const to = setTimeout(() => {
      if (settled) return;
      settled = true;
      killMlWorker();
      reject(mlWorkerFallbackError());
    }, 5000);
    w.onmessage = (e) => {
      if (settled) return;
      if (e.data && e.data.type === 'ml-ready') {
        settled = true;
        clearTimeout(to);
        w.onmessage = routeMlMessage;
        w.onerror = (ev) => {
          if (mlWorker !== w) return; // stale worker (already replaced)
          // DIAGNOSTIC (temporary): log the worker error as plain text
          // (the event object itself cannot be expanded usefully).
          console.error('[ct] ML worker error:', String((ev && ev.message) || ev || ''));
          // Mid-run crash: fall back to in-process handlers — re-running
          // from the still-staged originals is safe.
          failMlPending(mlWorkerFallbackError);
          killMlWorker();
        };
        resolve(w);
      }
      // Any other pre-ready message is ignored (no job posts before ready).
    };
    w.onerror = (ev) => {
      if (settled) return;
      settled = true;
      clearTimeout(to);
      console.error('[ct] ML worker error before ready:', String((ev && ev.message) || ev || ''));
      killMlWorker();
      reject(mlWorkerFallbackError());
    };
  });
  return mlWorkerReady;
}

async function runMlViaWorker(msg) {
  let w;
  try {
    w = await ensureMlWorker();
  } catch (e) {
    throw mlWorkerFallbackError();
  }
  const callId = ++mlCallSeq;
  return await new Promise((resolve, reject) => {
    mlPending.set(callId, { resolve, reject, runId: msg.runId });
    try {
      w.postMessage({ ...msg, callId });
    } catch (e) {
      failMlPending(mlWorkerFallbackError);
      killMlWorker();
    }
  });
}

// Hard-restart the Chrome ML host: close the offscreen document and
// recreate it, so a stuck host never poisons future runs. No-op on
// Firefox (no offscreen document; worker termination covers it there).
// Concurrent restarts share one promise; a creation already in flight is
// awaited before closing so a fresh document isn't killed mid-start.
// Failures are swallowed — the next callMlInner ensureMlHost() retries.
let restartingPromise = null;
export async function restartMlHost() {
  if (directHandlers()) return;
  if (typeof chrome.offscreen === 'undefined') return;
  if (!restartingPromise) {
    restartingPromise = (async () => {
      try { await creatingPromise; } catch {}
      try { await chrome.offscreen.closeDocument(); } catch {}
      try { await ensureMlHost(); } catch (e) {
        console.warn('[ct] ML host restart failed, next call will retry:', String((e && e.message) || e).slice(0, 120));
      }
    })().finally(() => { restartingPromise = null; });
  }
  return restartingPromise;
}

// Best-effort abort of a run's in-flight ML work. Used when callMl times out:
// the inner op keeps running past the Promise.race, so without this a late
// completion could still burn CPU / write pixel payloads for a dead run.
// Timeout path: the host is stuck by definition, so it is restarted, not
// just asked nicely — a cancel message would queue behind blocked WASM
// forever. Firefox: terminate the worker (next run recreates it). Chrome:
// close + recreate the offscreen document (next run gets a fresh host).
// Either way no browser restart is needed.
function cancelMlRun(runId) {
  if (!runId) return;
  if (mlWorker && [...mlPending.values()].some(p => p.runId === runId)) {
    // A stuck worker must die — a cancel message would queue behind the
    // blocked WASM run and never be processed. Pending runs on the shared
    // worker fail fast with a message (they can retry on a fresh worker).
    killMlWorker();
    failMlPending(() => new Error('ML worker stopped'));
  }
  restartMlHost().catch(() => {});
  try {
    const direct = directHandlers();
    if (direct && direct[MSG.ML_CANCEL]) {
      direct[MSG.ML_CANCEL]({ runId });
      return;
    }
  } catch { /* fall through to messaging */ }
  try {
    chrome.runtime.sendMessage({ type: MSG.ML_CANCEL, runId }).catch(() => {});
  } catch { /* host unreachable */ }
}

// Cancel a run's in-flight ML work on user cancel (called from
// abortRunResources). Broadcasts the cancel flag to every host that could
// be running it — worker, in-process handlers, offscreen document —
// because compute and cancel must reach the SAME handler instance
// (the worker has its own cancelled-runs set; sending the flag only to
// the main thread would not stop worker compute at all).
// If this run is the worker's only pending caller, the worker is also
// terminated so Cancel takes effect at once even when WASM is blocked;
// its pending calls fail with a marked cancelled error. Otherwise
// (other runs share the worker) only the graceful flag is sent, so their
// work survives and the cancelled run ends at its next stage boundary
// (the run catch treats a user-cancelled run as 'cancelled' regardless
// of what the ML call later throws).
export function cancelMlForRun(runId) {
  if (!runId) return;
  try {
    if (mlWorker) {
      try { mlWorker.postMessage({ type: MSG.ML_CANCEL, runId, callId: ++mlCallSeq }); } catch {}
    }
  } catch {}
  try {
    const direct = directHandlers();
    if (direct && direct[MSG.ML_CANCEL]) direct[MSG.ML_CANCEL]({ runId });
  } catch {}
  try {
    chrome.runtime.sendMessage({ type: MSG.ML_CANCEL, runId }).catch(() => {});
  } catch {}
  // Fast path: no other run shares the worker — terminate it now.
  if (mlWorker && mlPending.size > 0 && [...mlPending.values()].every(p => p.runId === runId)) {
    killMlWorker();
    failMlPending(() => Object.assign(new Error('cancelled'), { cancelled: true }));
  }
}

// FIX1: alarm-recovery hook. service-worker.js registers a handler that
// fails the run cleanly to the tab (pill error + panel log) and clears the
// persisted run record. When no hook is set, the onAlarm listener keeps
// its legacy behavior (pill error + ML host restart).
let mlAlarmRecoveryHook = null;
export function setMlAlarmRecoveryHook(fn) {
  mlAlarmRecoveryHook = (typeof fn === 'function') ? fn : null;
}

// Call one ML_* handler. Mirrors the old callOffscreen contract: resolves
// with the handler's payload, throws a human message on failure.
export async function callMl(msg, opts = {}) {
  const timeoutMs = ML_TIMEOUT_MS[msg.type] || ML_TIMEOUT_DEFAULT_MS;
  const attempt = nextAttempt(msg);
  const effMsg = attempt > 1 ? { ...msg, attempt } : msg;
  // FIX1: the note below is outdated. This backup now also serves Firefox
  // (a 6-minute inpaint freeze proved the background page can die or stall
  // with its timers), wherever chrome.alarms exists. It is inert on Firefox
  // until the "alarms" permission is added to manifest.firefox.json — that
  // permission is the blocker, not the code. The onAlarm listener below
  // calls the pipeline recovery hook when one is registered.
  // Alarm backup (Chrome only: chrome.alarms exists only with the "alarms"
  // permission, which only the Chrome manifest declares — Firefox's
  // persistent background page never loses its timers, so it needs none).
  // The setTimeout below dies with the service worker, so a worker killed
  // mid-call (idle ~30s, or the 5-minute per-event cap) would otherwise
  // hang forever with no error. The alarm survives the worker's death and
  // wakes a fresh worker, which recovers from the storage entry (see the
  // onAlarm listener below). Alarms clamp to a 1-minute minimum, so for
  // 30s timeouts the backup fires later than the timer — late is fine,
  // never is not. Cancel calls need none (they are fast, and a dead worker
  // means the run is dead anyway).
  const alarmName = (typeof chrome !== 'undefined' && chrome.alarms && msg.runId && msg.type !== MSG.ML_CANCEL)
    ? `ct-ml:${msg.runId}:${msg.type}:${Date.now()}`
    : null;
  const storageKey = alarmName ? `ct-ml-pending:${alarmName}` : null;
  if (alarmName) {
    const deadline = Date.now() + Math.max(timeoutMs, 60000);
    try {
      await chrome.storage.local.set({ [storageKey]: {
        runId: msg.runId, tabId: opts.tabId != null ? opts.tabId : null,
        type: msg.type, timeoutMs, deadline,
      } });
      await chrome.alarms.create(alarmName, { when: deadline });
    } catch { /* best-effort: the setTimeout still covers the awake case */ }
  }
  let timer = null;
  const timeoutP = new Promise((_, reject) => {
    timer = setTimeout(() => {
      // Stop the runaway op first: without this it keeps running past the
      // race and could complete late (stale pixelPut, double resource use).
      // DIAGNOSTIC (temporary): proves whether the timeout ever fired —
      // a silent stall with no timeout line means the timeout died too.
      console.error('[ct-diag] ML timeout fired type ' + msg.type + ' run ' + msg.runId + ' after ' + (timeoutMs / 1000) + 's');
      cancelMlRun(msg.runId);
      const group = ML_GROUP_FOR_TYPE[msg.type] || 'ML';
      const err = new Error(`ML host timed out during ${group} after ${timeoutMs / 1000}s — the ML thread was restarted automatically. Try again.`);
      err.mlTimeout = true;
      err.mlType = msg.type;
      reject(err);
    }, timeoutMs);
  });
  try {
    return await Promise.race([callMlInner(effMsg), timeoutP]);
  } catch (e) {
    // Out-of-memory poisons the host's memory pool: restart it so the
    // next run starts clean (timeouts restart via cancelMlRun above).
    // Firefox: the worker's pool is exhausted, so terminate it too.
    if (OOM_RE.test(String((e && e.message) || e))) {
      if (mlWorker) {
        killMlWorker();
        failMlPending(() => new Error('ML worker stopped'));
      }
      restartMlHost().catch(() => {});
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (alarmName) {
      try { await chrome.alarms.clear(alarmName); } catch {}
      try { await chrome.storage.local.remove(storageKey); } catch {}
    }
  }
}

// Alarm backup recovery (Chrome): fires when the worker was killed mid-ML-call
// and its setTimeout died with it. This runs in a FRESH worker (in-memory run
// state is gone), so the storage entry is the only source of truth: if the
// call already settled, its entry was removed and this is a no-op. Otherwise
// the tab's pill gets the same timeout error the timer would have produced,
// and the ML host is restarted (close + recreate works even when the old doc
// is blocked on WASM) so the next run starts clean.
if (typeof chrome !== 'undefined' && chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm || !alarm.name || !alarm.name.startsWith('ct-ml:')) return;
    const key = `ct-ml-pending:${alarm.name}`;
    let entry = null;
    try { entry = (await chrome.storage.local.get(key))[key] || null; } catch {}
    if (!entry) return;
    try { await chrome.storage.local.remove(key); } catch {}
    const group = ML_GROUP_FOR_TYPE[entry.type] || 'ML';
    const msg = `ML host timed out during ${group} after ${entry.timeoutMs / 1000}s — the ML thread was restarted automatically. Try again.`;
    // FIX1: pipeline-owned recovery first. When set, the pipeline fails
    // the run cleanly (pill + panel log + run-record cleanup) and the
    // legacy pill/restart below is skipped.
    if (mlAlarmRecoveryHook) {
      try { await mlAlarmRecoveryHook(entry, msg); } catch {}
      return;
    }
    if (entry.tabId != null) {
      try {
        await chrome.tabs.sendMessage(entry.tabId, { type: MSG.RUN_PROGRESS, runId: entry.runId, stage: 'error', error: msg, direct: true });
      } catch { /* tab closed — nothing to tell */ }
    }
    try { await restartMlHost(); } catch {}
  });
}

// ML compute types that run on the Firefox worker (never in-process):
// detect, OCR, inpaint, model ensure, cancel. Ping/download/reset stay on
// the direct/messaging path — they are fast management calls, not WASM
// compute, and ping must work even when the worker is down.
const ML_WORKER_TYPES = new Set([MSG.ML_DETECT, MSG.ML_OCR, MSG.ML_INPAINT, MSG.ML_ENSURE, MSG.ML_CANCEL]);

async function callMlInner(msg) {
  const direct = directHandlers();
  if (direct && ML_WORKER_TYPES.has(msg.type)) {
    // Firefox ML goes to the worker (see above). Worker failure
    // (startup, crash, OOM reply) falls back to the in-process handlers
    // — except termination, which only happens on timeout/cancel, where
    // falling back would defeat the timeout. The in-process fallback is
    // emergency-only (worker mechanism broken): it can block the main
    // thread, so it is never used for a timed-out or cancelled call.
    try {
      const res = await runMlViaWorker(msg);
      if (!res || res.ok === false) throw new Error('ML worker did not respond');
      return res;
    } catch (e) {
      if (e && e.mlWorkerFallback) {
        // Fall through to in-process handlers below.
      } else {
        throw mlHostError(msg.type, e);
      }
    }
  }
  if (direct) {
    const fn = direct[msg.type];
    if (!fn) throw new Error('ML host has no handler for ' + msg.type);
    let res;
    try {
      res = await fn(msg);
    } catch (e) {
      throw mlHostError(msg.type, e);
    }
    if (!res) throw new Error('ML host did not respond');
    if (res.ok === false) throw mlHostError(msg.type, res.error);
    return res;
  }
  await ensureMlHost();
  let res;
  try {
    res = await chrome.runtime.sendMessage(msg);
  } catch (e) {
    throw new Error('ML host unreachable: ' + String(e).slice(0, 120));
  }
  if (!res) throw new Error('ML host did not respond');
  if (res.ok === false) throw mlHostError(msg.type, res.error);
  return res;
}

// Canvas that works in a service worker (OffscreenCanvas) and in a
// background page (regular <canvas> — e.g. Firefox).
export function makeCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob(quality === undefined ? { type } : { type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), type, quality);
  });
}
// WebP for cache/transport: browsers' canvas API only produces lossy WebP
// (no lossless mode), but at 0.95 it's visually indistinguishable from PNG
// on manga art, ~60% smaller, and faster to encode than PNG's deflate.
export const WEBP_TYPE = 'image/webp';
export const WEBP_QUALITY = 0.95;
