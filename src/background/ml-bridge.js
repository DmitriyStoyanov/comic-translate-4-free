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
  [MSG.ML_DIAG]: 'thread diagnostic',
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
  [MSG.ML_DIAG]: 10 * 1000,
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
const ML_WORKER_TYPES = new Set([MSG.ML_DETECT, MSG.ML_OCR, MSG.ML_INPAINT, MSG.ML_ENSURE, MSG.ML_CANCEL, MSG.ML_DIAG]);
// MEASURE1: ML_DIAG must ride with the compute types. Without it, the
// Firefox direct path would answer from the background page's in-process
// handlers, and the line would describe the background page's realm —
// not the worker realm that actually runs WASM. (Worker failure still
// falls back to in-process handlers below; the context field in the
// reply then says 'document', so a fallback answer is recognisable.)

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

// ---------------------------------------------------------------- Firefox inpaint pool (POOL1)
// Firefox WASM threads are OFF (MEASURE1: SharedArrayBuffer no,
// crossOriginIsolated false, numThreads 1; SAB is impossible in a Firefox
// extension, Mozilla bug 1673477). The only multi-core route left is
// several Dedicated Workers, each running single-threaded WASM on its
// own core. This pool is CPU-only and WASM-only: providers stay ['wasm'],
// no WebGPU, no GPU code, and numThreads handling is untouched (each
// worker's WASM is single-threaded because SAB is off, so there is no
// thread budget to split).
//
// Why separate workers, not two concurrent calls to the shared worker:
// the shared worker (ensureMlWorker above) runs ONE handler module with
// ONE singleton inpainter session, ONE cancelledRuns set, and ONE
// progress stream per runId. Two concurrent ML_INPAINT calls into it
// would share that session (concurrent session.run calls are not proven
// safe here) and their progress fractions would collide on the same
// runId. A pool worker is a fresh ml-worker.js instance: its own module,
// its own inpainter, its own cancelledRuns, its own progress stream.
// Pixel keys are per-patch and disjoint across groups, and IDB is shared
// safely, so groups never clobber each other.
//
// Pool calls deliberately bypass callMl/callMlInner and the shared
// worker: the shared worker's timeout path (cancelMlRun) kills the shared
// worker and fails ALL its pending calls, which would be wrong for one
// pool group. Each pool group gets its own 120s timer that terminates
// only that group's worker. FIX1 orphan recovery still covers a dead
// background page (persisted run record); the pool alarm backup does
// not cover pool calls, because pool calls never create ct-ml alarm
// entries — the per-group timer covers the background-alive case and
// orphan recovery covers the background-dead case.
// Pure helpers (splitPatchesByArea, aggregateGroupProgress) are exported
// so the Node harness imports the exact production code, not a copy.

// Greedy balanced split by patch area (LPT scheduling): largest patch
// first, each patch to the currently-lightest group. Area is the cost
// proxy (LaMa time scales with tile pixels; tile counts follow area).
// Returns only non-empty groups, patches in original order within each
// group. Patch-level balance is coarse on few-patch pages (a single
// huge patch cannot be split) — that limit is reported, not hidden.
export function splitPatchesByArea(patches, k = 2) {
  if (!patches || !patches.length) return [];
  const n = Math.max(1, Math.min(k || 2, patches.length));
  const groups = Array.from({ length: n }, () => ({ patches: [], area: 0 }));
  const sorted = [...patches].sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
  for (const p of sorted) {
    let gi = 0;
    for (let i = 1; i < groups.length; i++) if (groups[i].area < groups[gi].area) gi = i;
    groups[gi].patches.push(p);
    groups[gi].area += (p.width || 0) * (p.height || 0);
  }
  const order = new Map(patches.map((p, i) => [p, i]));
  for (const g of groups) g.patches.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return groups.filter(g => g.patches.length > 0);
}

// 1.4.0 (m8): share of total patch area held by the largest patch.
// The service worker skips the pool when this exceeds 0.6: the largest
// patch cannot be split and will dominate either way, so pool only
// adds 2x model load for no gain. Pure, exported for the Node harness.
export function largestPatchAreaShare(patches) {
  if (!patches || !patches.length) return 0;
  let total = 0;
  let largest = 0;
  for (const p of patches) {
    const a = (p.width || 0) * (p.height || 0);
    total += a;
    if (a > largest) largest = a;
  }
  return total > 0 ? largest / total : 0;
}

// Weighted progress: each group's fraction (0..1 within its subset)
// weighted by its share of total patch area. Group fractions are
// monotonic (sequential handler loop), weights are positive, so the
// aggregate is monotonic and reaches exactly 1 when all groups finish.
export function aggregateGroupProgress(fracs, weights) {
  let s = 0;
  for (let i = 0; i < fracs.length; i++) s += (weights[i] || 0) * (fracs[i] || 0);
  return Math.max(0, Math.min(1, s));
}

function poolCreationError(cause) {
  return Object.assign(new Error('inpaint pool creation failed: ' + String((cause && cause.message) || cause || '')), { poolCreationFailed: true });
}
function poolCancelledError() {
  return Object.assign(new Error('cancelled'), { cancelled: true });
}
function poolTimeoutError(timeoutMs) {
  const err = new Error(`ML host timed out during inpainter after ${timeoutMs / 1000}s — the ML thread was restarted automatically. Try again.`);
  err.mlTimeout = true;
  err.mlType = MSG.ML_INPAINT;
  return err;
}

function createPoolSlot(createWorker, readyTimeoutMs) {
  const worker = createWorker();
  const slot = { worker, pending: new Map(), seq: 0, dead: false, terminated: false, onProgress: null, readyPromise: null, _rejectReady: null };
  // 1.4.0 (m10 follow-up): a slot's readyPromise must never reject
  // unhandled. If pool creation throws before the Promise.all await
  // (e.g. a later Worker constructor throws), finally closes the pool
  // and terminatePoolSlot rejects this slot's still-pending
  // readyPromise — with no awaiter attached, that is an unhandled
  // rejection in the background. A no-op catch branch marks it handled;
  // awaiting the original readyPromise still throws for its awaiter.
  // (Same guard in createGpuSlot below, for the same reason.)
  slot.readyPromise = new Promise((resolve, reject) => {
    slot._rejectReady = reject;
    const to = setTimeout(() => {
      slot.dead = true;
      try { worker.terminate(); } catch {}
      reject(new Error('pool worker did not become ready'));
    }, readyTimeoutMs);
    worker.onmessage = (e) => {
      const d = e && e.data;
      if (!d) return;
      if (d.type === 'ml-ready') {
        clearTimeout(to);
        worker.onmessage = (ev) => routePoolSlotMessage(slot, ev);
        worker.onerror = (ev) => {
          slot.dead = true;
          rejectPoolSlotPending(slot, new Error('ML worker failed: ' + String((ev && ev.message) || ev || '')));
        };
        resolve();
      }
    };
    worker.onerror = (ev) => {
      clearTimeout(to);
      slot.dead = true;
      reject(new Error('pool worker failed to start: ' + String((ev && ev.message) || ev || '')));
    };
  });
  slot.readyPromise.catch(() => {}); // 1.4.0 (m10): never an unhandled rejection (see comment above).
  return slot;
}

function rejectPoolSlotPending(slot, err) {
  const pend = [...slot.pending.values()];
  slot.pending.clear();
  for (const p of pend) {
    try { p.reject(err); } catch {}
  }
}

function routePoolSlotMessage(slot, e) {
  const d = e && e.data;
  if (!d) return;
  if (d.type === 'inpaint-progress') {
    try { slot.onProgress?.(d.frac); } catch {}
    return;
  }
  if (d.callId == null) return;
  const p = slot.pending.get(d.callId);
  if (!p) return;
  slot.pending.delete(d.callId);
  if (d.ok) p.resolve(d.res);
  else p.reject(new Error(d.error || 'ML worker failed'));
}

function terminatePoolSlot(slot, err) {
  if (slot.terminated) return;
  slot.terminated = true;
  slot.dead = true;
  try { slot._rejectReady?.(err || new Error('pool worker terminated')); } catch {}
  rejectPoolSlotPending(slot, err || new Error('pool worker terminated'));
  slot.onProgress = null;
  try { slot.worker.terminate(); } catch {}
}

function terminatePoolSlots(slots, err) {
  for (const s of slots || []) {
    try { terminatePoolSlot(s, err); } catch {}
  }
}

// Active pools by runId, so user cancel (from the service worker's abort
// path) can kill a pool from outside the awaiting runPooledInpaint call.
const activePools = new Map();
export function cancelPooledInpaint(runId) {
  const pool = activePools.get(runId);
  if (!pool) return;
  try { pool.close(poolCancelledError()); } catch {}
}

// Run one ML_INPAINT group on one pool worker with its own timeout.
// The timer terminates ONLY this group's worker (never the shared
// worker); termination rejects the pending call with the timeout error.
async function callPoolSlotWithTimeout(slot, msg, onProgress, timeoutMs) {
  if (slot.dead || slot.terminated) throw new Error('pool worker is dead');
  const timer = setTimeout(() => terminatePoolSlot(slot, poolTimeoutError(timeoutMs)), timeoutMs);
  try {
    return await new Promise((resolve, reject) => {
      const callId = ++slot.seq;
      slot.pending.set(callId, { resolve, reject });
      slot.onProgress = onProgress;
      try {
        slot.worker.postMessage({ ...msg, callId });
      } catch (e) {
        slot.pending.delete(callId);
        reject(e);
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

// Firefox-first inpaint pool. opts: {runId, patches, k=2,
// onProgress(frac 0..1), diag(line), isCancelled(), createWorker,
// timeoutMs=120000, readyTimeoutMs=5000}. Returns {results, ms, totalTiles}
// in the same shape as a single ML_INPAINT call, so the caller's merge
// code is unchanged. Group failure retries once on a FRESH worker
// (terminated workers never run a retry: their heap may be poisoned);
// a second failure fails the run cleanly. Pool creation failure throws
// with poolCreationFailed (caller falls back to the single call).
// Cancel: cancelPooledInpaint(runId) closes the pool; in-flight groups
// reject as cancelled and never retry (closed check below prevents
// post-close worker creation and late writes).
export async function runPooledInpaint(opts) {
  const {
    runId, patches,
    k = 2,
    onProgress = () => {},
    diag = () => {},
    isCancelled = () => false,
    createWorker = () => new Worker(chrome.runtime.getURL('src/background/ml-worker.js')),
    timeoutMs = 120 * 1000,
    readyTimeoutMs = 5000,
  } = opts || {};
  const groups = splitPatchesByArea(patches || [], k);
  if (!groups.length) return { results: [], ms: 0, totalTiles: 0 };
  const totalArea = groups.reduce((a, g) => a + g.area, 0);
  const weights = totalArea > 0 ? groups.map(g => g.area / totalArea) : groups.map(() => 1 / groups.length);
  diag('inpaint pool groups K=' + groups.length + ' ' + groups.map((g, i) =>
    `group${i} patches [${g.patches.map(p => p.id).join(',')}] area ${g.area}`).join(' '));
  const pool = {
    slots: [],
    closed: false,
    close(err) {
      if (this.closed) return;
      this.closed = true;
      terminatePoolSlots(this.slots, err);
    },
  };
  activePools.set(runId, pool);
  try {
    try {
      // 1.4.0 (m10): append each slot immediately, so a mid-creation
      // throw still leaves already-created slots in pool.slots for
      // finally to terminate (the old map assignment never completed,
      // so pool.slots stayed empty and created workers leaked).
      pool.slots = [];
      for (let i = 0; i < groups.length; i++) pool.slots.push(createPoolSlot(createWorker, readyTimeoutMs));
      await Promise.all(pool.slots.map(s => s.readyPromise));
    } catch (e) {
      throw poolCreationError(e);
    }
    const fracs = groups.map(() => 0);
    const report = () => {
      try { onProgress(aggregateGroupProgress(fracs, weights)); } catch {}
    };
    const runAttempt = async (gi, attempt) => {
      if (pool.closed) throw new Error('pool worker terminated');
      if (isCancelled()) throw poolCancelledError();
      const slot = pool.slots[gi];
      const subset = groups[gi].patches.map(({ id, key, maskKey, width, height }) => ({ id, key, maskKey, width, height }));
      return await callPoolSlotWithTimeout(slot,
        { type: MSG.ML_INPAINT, runId, attempt, patches: subset },
        (f) => { fracs[gi] = f; report(); },
        timeoutMs);
    };
    const runGroup = async (gi) => {
      try {
        return await runAttempt(gi, 1);
      } catch (e) {
        if (pool.closed || isCancelled() || (e && e.cancelled)) throw e;
        diag('inpaint pool group ' + gi + ' failed, retrying once: ' + String((e && e.message) || e).slice(0, 120));
        try {
          const old = pool.slots[gi];
          try { terminatePoolSlot(old); } catch {}
          const replacement = createPoolSlot(createWorker, readyTimeoutMs);
          pool.slots[gi] = replacement;
          await replacement.readyPromise;
        } catch (re) {
          throw e;
        }
        return await runAttempt(gi, 2);
      }
    };
    const groupResults = await Promise.all(groups.map((_, gi) => runGroup(gi)));
    const allResults = groupResults.flatMap(r => r.results || []);
    const ms = Math.max(0, ...groupResults.map(r => r.ms || 0));
    const totalTiles = groupResults.reduce((a, r) => a + (r.totalTiles || 0), 0);
    diag('inpaint pool done groups ms [' + groupResults.map(r => r.ms || 0).join(',') + '] totalTiles ' + totalTiles);
    return { results: allResults, ms, totalTiles };
  } finally {
    activePools.delete(runId);
    try { pool.close(); } catch {}
  }
}

// ---------------------------------------------------------------- Firefox GPU inpaint (GPU1, LaMa only)
// The missing piece from 1.3.6 was a hang watchdog: a GPU stall throws
// nothing, so error-only fallback can never catch it. This section is
// that watchdog, plus the separate GPU worker it watches.
//
// Why a separate worker, not the shared worker: a WebGPU session still
// runs inside a WASM instance and shares its realm's heap (1.3.4
// finding). Running GPU LaMa in the shared worker would mix GPU
// buffers with WASM sessions in one heap. The GPU worker
// (ml-gpu-worker.js) is a fresh realm whose only GPU model is LaMa
// (detector hardcodes WASM, Baberu is never in WEBGPU_KINDS). Detector
// and Baberu never touch this worker: they keep going through callMl
// and the shared worker, exactly as today.
//
// Why the retry lives in the service worker, not in the GPU worker:
// offscreen.js deliberately does NOT retry a GPU run failure inside
// the GPU worker realm (see its GPU1 early throw). The background
// terminates the GPU worker first (reclaiming GPU buffers, and
// preventing any late GPU write from clobbering the retry), then
// retries once on the shared WASM worker, which was preloaded at run
// start and is therefore faster than loading WASM in the GPU worker.
// Total WASM retries for a GPU run failure is one. The service worker
// also marks the run downgraded, so GPU is never retried again in
// that run. Across runs GPU is retried fresh (per-run stick only, per
// spec); if hangs prove deterministic, a session stick is a one-line
// follow-up, not assumed here.
//
// Watchdog window, two-phase (1.4.0 m3): 120 s with no progress AND no
// reply from send (the load window — a fresh GPU worker pays full model
// load with no progress until the first patch completes), then 60 s of
// inactivity after the first progress event. Justification: a GPU tile
// should complete in seconds (Chrome GPU inpaint is 24s total for 11
// tiles, about 2s per tile; even a huge 512 tile on GPU is well under
// 60s), so 60s with no tile completing and no reply after progress
// started is hang evidence, not slowness. No total cap is imposed: a
// slow-but-progressing GPU run (progress arriving regularly) is allowed
// to exceed 120s total, because killing it would be a false positive,
// and the WASM retry still has its own 120s callMl timeout. A false
// positive costs time (load window + WASM retry), never correctness:
// the run still completes on WASM. The watchdog is inactivity-only, so
// it catches the 1.3.6
// pattern (progress stops at 71%, then silence) as well as a
// no-progress-from-start hang.
//
// Alarm note: GPU calls bypass callMl (like pool calls), so they
// create no ct-ml alarm entries. The watchdog covers the
// background-alive case; FIX1 orphan recovery covers the
// background-dead case. Firefox only reaches this section: the
// service worker only calls it on the Firefox directHandlers path.
// Chrome GPU has its own section below (runChromeGpuInpaint): same
// watchdog and downgrade, forwarded through the offscreen document,
// which is the only context that can spawn the GPU worker there.
//
// Slot code below mirrors the pool slots on purpose (same ready,
// routing, and termination shape) but is kept separate so pool
// behavior cannot regress from GPU changes, and vice versa.
export const GPU_WATCHDOG_INACTIVITY_MS = 60 * 1000;
// 1.4.0 (m3): first-progress window. A fresh GPU worker pays full model
// load (206 MB IDB read + session creation) with no progress until the
// first patch completes, so arming the 60 s inactivity window at send
// could kill a progressing-but-silent cold run. The load window is 120 s
// (matching the inpaint callMl timeout): a load hang is still caught,
// at 120 s, not never — and once progress arrives, the window drops to
// the 60 s inactivity window. loadWindowMs is an opts override so the
// Node harness can use short windows; production always uses 120 s.
export const GPU_LOAD_WINDOW_MS = 120 * 1000;
const GPU_READY_TIMEOUT_MS = 5 * 1000;

function gpuHangError(watchdogMs) {
  const err = new Error(`GPU inpaint hang: no progress or reply for ${watchdogMs / 1000}s — the GPU worker was terminated automatically. Downgrading to WASM for this run.`);
  err.gpuHang = true;
  err.mlType = MSG.ML_INPAINT;
  return err;
}
function gpuCancelledError() {
  return Object.assign(new Error('cancelled'), { cancelled: true });
}

const activeGpuJobs = new Map();
export function cancelGpuInpaint(runId) {
  const job = activeGpuJobs.get(runId);
  if (!job) return;
  try { job.close(gpuCancelledError()); } catch {}
}

function createGpuSlot(createWorker, readyTimeoutMs) {
  const worker = createWorker();
  const slot = { worker, pending: new Map(), seq: 0, dead: false, terminated: false, onProgress: null, readyPromise: null, _rejectReady: null };
  // 1.4.0 (m10): same no-op-catch guard as createPoolSlot — a
  // terminateGpuSlot before the readyPromise is awaited must never
  // surface as an unhandled rejection. (The catch branch is added
  // after the promise is assigned, below.)
  slot.readyPromise = new Promise((resolve, reject) => {
    slot._rejectReady = reject;
    const to = setTimeout(() => {
      slot.dead = true;
      try { worker.terminate(); } catch {}
      reject(new Error('GPU worker did not become ready'));
    }, readyTimeoutMs);
    worker.onmessage = (e) => {
      const d = e && e.data;
      if (!d) return;
      if (d.type === 'ml-ready') {
        clearTimeout(to);
        worker.onmessage = (ev) => routeGpuSlotMessage(slot, ev);
        worker.onerror = (ev) => {
          slot.dead = true;
          rejectGpuSlotPending(slot, new Error('GPU worker failed: ' + String((ev && ev.message) || ev || '')));
        };
        resolve();
      }
    };
    worker.onerror = (ev) => {
      clearTimeout(to);
      slot.dead = true;
      reject(new Error('GPU worker failed to start: ' + String((ev && ev.message) || ev || '')));
    };
  });
  slot.readyPromise.catch(() => {}); // 1.4.0 (m10): never an unhandled rejection (see comment above).
  return slot;
}

function rejectGpuSlotPending(slot, err) {
  const pend = [...slot.pending.values()];
  slot.pending.clear();
  for (const p of pend) {
    try { p.reject(err); } catch {}
  }
}

function routeGpuSlotMessage(slot, e) {
  const d = e && e.data;
  if (!d) return;
  if (d.type === 'inpaint-progress') {
    try { slot.onProgress?.(d.frac); } catch {}
    return;
  }
  if (d.callId == null) return;
  const p = slot.pending.get(d.callId);
  if (!p) return;
  slot.pending.delete(d.callId);
  if (d.ok) p.resolve(d.res);
  else p.reject(new Error(d.error || 'GPU worker failed'));
}

function terminateGpuSlot(slot, err) {
  if (slot.terminated) return;
  slot.terminated = true;
  slot.dead = true;
  try { slot._rejectReady?.(err || new Error('GPU worker terminated')); } catch {}
  rejectGpuSlotPending(slot, err || new Error('GPU worker terminated'));
  slot.onProgress = null;
  try { slot.worker.terminate(); } catch {}
}

// Firefox GPU inpaint. opts: {runId, patches, onProgress(frac 0..1),
// diag(line), isCancelled(), createWorker,
// watchdogInactivityMs=60000, readyTimeoutMs=5000}. Returns
// {results, ms, totalTiles} in the same shape as a single ML_INPAINT
// call, so the caller's merge code is unchanged. Throws once on any
// GPU failure (error, hang, creation failure); it never retries
// internally — the service worker downgrades and retries once on WASM.
// Cancel rejects as cancelled and never retries. The GPU worker is
// terminated on every path (success, failure, cancel, hang): results
// are pixel keys in IDB, not worker memory, so terminating after a
// reply loses nothing, and termination is the GPU-buffer reclaim.
export async function runGpuInpaint(opts) {
  const {
    runId, patches,
    onProgress = () => {},
    diag = () => {},
    isCancelled = () => false,
    createWorker = () => new Worker(chrome.runtime.getURL('src/background/ml-gpu-worker.js')),
    watchdogInactivityMs = GPU_WATCHDOG_INACTIVITY_MS,
    loadWindowMs = GPU_LOAD_WINDOW_MS,
    readyTimeoutMs = GPU_READY_TIMEOUT_MS,
  } = opts || {};
  if (!patches || !patches.length) return { results: [], ms: 0, totalTiles: 0 };
  if (isCancelled()) throw gpuCancelledError();
  const slot = createGpuSlot(createWorker, readyTimeoutMs);
  let watchdogTimer = null;
  let watchdogFired = false;
  let seenProgress = false;
  let lastWindowMs = loadWindowMs;
  const clearWatchdog = () => { if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; } };
  const fireWatchdog = () => {
    if (watchdogFired || slot.terminated) return;
    watchdogFired = true;
    try { diag('inpaint gpu watchdog fired: no progress or reply for ' + (lastWindowMs / 1000) + 's, terminating GPU worker'); } catch {}
    terminateGpuSlot(slot, gpuHangError(lastWindowMs));
  };
  // 1.4.0 (m3): two-phase arming. No arg means "use the phase window":
  // load window until the first progress event, inactivity window after.
  const armWatchdog = (windowMs) => {
    const w = windowMs != null ? windowMs : (seenProgress ? watchdogInactivityMs : loadWindowMs);
    lastWindowMs = w;
    clearWatchdog();
    if (!slot.terminated && !watchdogFired) watchdogTimer = setTimeout(fireWatchdog, w);
  };
  const noteActivity = () => { if (!slot.terminated && !watchdogFired) { seenProgress = true; armWatchdog(); } };
  const job = { close(err) { clearWatchdog(); terminateGpuSlot(slot, err || gpuCancelledError()); } };
  activeGpuJobs.set(runId, job);
  try {
    await slot.readyPromise;
    if (isCancelled()) throw gpuCancelledError();
    slot.onProgress = (frac) => {
      noteActivity();
      try { onProgress(frac); } catch {}
    };
    const res = await new Promise((resolve, reject) => {
      const callId = ++slot.seq;
      slot.pending.set(callId, { resolve, reject });
      // Arm at send: silence from here counts as inactivity. Progress
      // events re-arm (noteActivity); the reply clears (below).
      armWatchdog();
      try {
        slot.worker.postMessage({
          type: MSG.ML_INPAINT, runId, callId,
          patches: patches.map(({ id, key, maskKey, width, height }) => ({ id, key, maskKey, width, height })),
        });
      } catch (e) {
        slot.pending.delete(callId);
        reject(e);
      }
    });
    clearWatchdog();
    return { results: (res && res.results) || [], ms: (res && res.ms) || 0, totalTiles: (res && res.totalTiles) || 0, loadMs: (res && res.loadMs) || 0 };
  } finally {
    clearWatchdog();
    if (activeGpuJobs.get(runId) === job) activeGpuJobs.delete(runId);
    try { terminateGpuSlot(slot, null); } catch {}
  }
}

// ---------------------------------------------------------------- Chrome GPU inpaint (GPU1-Chrome, LaMa only)
// Same rules as Firefox GPU1, different forwarding: the Chrome service
// worker cannot spawn workers, so the GPU worker is spawned by the
// offscreen document (offscreen.js ML_GPU_INPAINT handler), which the SW
// reaches over the existing runtime message channel (the same channel
// callMl uses: ensureMlHost + chrome.runtime.sendMessage -> the doc's
// onMessage listener). Detector and Baberu never touch this path: they
// keep going through callMl, and the doc's own WEBGPU_KINDS stays empty
// — only the spawned worker realm has ['inpaint'].
//
// Watchdog: background-side (this module, SW thread), two-phase like
// Firefox GPU1 (1.4.0 m3): 120 s load window from send, then 60 s of no
// progress AND no reply after the first progress event. Progress
// arrives one-way from the doc via ML_INPAINT_PROGRESS (offscreen-
// progress.js, throttled 500ms + final 1.0); the SW's progress branch
// forwards it here via notifyChromeGpuProgress, which re-arms the
// watchdog. No total cap: a slow-but-progressing GPU run is not killed.
// On watchdog fire, this module sends ML_GPU_CANCEL to the doc (which
// terminates the GPU worker) and throws a hang error; the service
// worker downgrades once to WASM, exactly like Firefox. On any GPU
// failure except user cancel (error, hang), the SW downgrades once;
// on GPU_SKIPPED (no navigator.gpu in the doc realm, worker creation /
// ready failure), the SW logs "skipped" and falls back to the single
// WASM path. Cancel never falls back: cancelChromeGpuInpaint rejects
// as cancelled and sends ML_CANCEL, which stops the run's GPU loop
// but KEEPS the shared worker alive for the next run (2.0.6 reuse);
// the ML_CANCEL broadcast to the doc does the same thing (belt and
// suspenders, idempotent).
//
// Alarm note: like pool and Firefox GPU calls, Chrome GPU calls bypass
// callMl, so they create no ct-ml alarm entries. The watchdog covers
// the SW-alive case. The SW-dead case is NOT covered by the callMl
// alarm backup for GPU calls (no entry exists to fire); progress
// messages keep the SW alive during progressing runs, and the doc
// keeps the shared GPU worker alive across runs (2.0.6), so a dead SW
// leaves a worker that ends on its own (idle timeout) rather than a
// leak — but the run itself is lost, same as any SW-death without an
// alarm entry. Reported as a known limit, not hidden.
//
// The offscreen doc's runtime listener is document-guarded (see
// offscreen.js): without that guard a Chrome Dedicated Worker exposing
// chrome.runtime.onMessage would also receive the SW's messages and
// run them a second time in the GPU realm.
const chromeGpuProgressHooks = new Map();
export function notifyChromeGpuProgress(runId, frac) {
  try { chromeGpuProgressHooks.get(runId)?.(frac); } catch {}
}
const activeChromeGpuJobs = new Map();
export function cancelChromeGpuInpaint(runId) {
  const job = activeChromeGpuJobs.get(runId);
  if (!job) return;
  try { job.close(gpuCancelledError()); } catch {}
}
function chromeGpuSkippedError(message) {
  return Object.assign(new Error(message), { gpuSkipped: true });
}

// Chrome GPU inpaint. opts: {runId, patches, onProgress(frac 0..1),
// diag(line), isCancelled(), ensureHost, sendGpuMessage, cancelGpuMessage,
// watchdogInactivityMs=60000}. Returns {results, ms, totalTiles} in the
// same shape as a single ML_INPAINT call, so the caller's merge code is
// unchanged. Throws once on any GPU failure (error, hang, skipped);
// it never retries internally — the service worker downgrades (or falls
// back on skipped) once to WASM. Cancel rejects as cancelled and never
// retries. sendGpuMessage/cancelGpuMessage/ensureHost are injectable so
// the Node harness can mock the offscreen doc without a browser.
export async function runChromeGpuInpaint(opts) {
  const {
    runId, patches,
    onProgress = () => {},
    diag = () => {},
    isCancelled = () => false,
    ensureHost = () => ensureMlHost(),
    sendGpuMessage = (msg) => chrome.runtime.sendMessage(msg),
    cancelGpuMessage = (msg) => { try { const p = chrome.runtime.sendMessage(msg); if (p && p.catch) p.catch(() => {}); } catch {} },
    watchdogInactivityMs = GPU_WATCHDOG_INACTIVITY_MS,
    loadWindowMs = GPU_LOAD_WINDOW_MS,
  } = opts || {};
  if (!patches || !patches.length) return { results: [], ms: 0, totalTiles: 0 };
  if (isCancelled()) throw gpuCancelledError();
  let watchdogTimer = null;
  let watchdogFired = false;
  let seenProgress = false;
  let lastWindowMs = loadWindowMs;
  let cancelReject = null;
  const clearWatchdog = () => { if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; } };
  const fireWatchdog = () => {
    if (watchdogFired) return;
    watchdogFired = true;
    try { diag('inpaint gpu watchdog fired: no progress or reply for ' + (lastWindowMs / 1000) + 's, terminating GPU worker'); } catch {}
    try { cancelGpuMessage({ type: MSG.ML_GPU_CANCEL, runId }); } catch {}
    try { cancelReject?.(gpuHangError(lastWindowMs)); } catch {}
  };
  const armWatchdog = (windowMs) => {
    const w = windowMs != null ? windowMs : (seenProgress ? watchdogInactivityMs : loadWindowMs);
    lastWindowMs = w;
    clearWatchdog();
    if (!watchdogFired) watchdogTimer = setTimeout(fireWatchdog, w);
  };
  const noteActivity = () => { if (!watchdogFired) { seenProgress = true; armWatchdog(); } };
  const job = {
    close(err) {
      clearWatchdog();
      // 2.0.6: user cancel sends ML_CANCEL, not ML_GPU_CANCEL — the doc
      // stops this run's GPU loop but keeps the shared worker (and its
      // loaded session) alive for the next run. ML_GPU_CANCEL is the
      // watchdog hang path only, and it terminates the worker.
      try { cancelGpuMessage({ type: MSG.ML_CANCEL, runId }); } catch {}
      try { cancelReject?.(err || gpuCancelledError()); } catch {}
    },
  };
  activeChromeGpuJobs.set(runId, job);
  chromeGpuProgressHooks.set(runId, (frac) => {
    noteActivity();
    try { onProgress(frac); } catch {}
  });
  try {
    await ensureHost();
    if (isCancelled()) throw gpuCancelledError();
    const res = await new Promise((resolve, reject) => {
      cancelReject = reject;
      armWatchdog();
      let reply;
      try {
        reply = sendGpuMessage({ type: MSG.ML_GPU_INPAINT, runId, patches: patches.map(({ id, key, maskKey, width, height }) => ({ id, key, maskKey, width, height })) });
      } catch (e) {
        reject(e);
        return;
      }
      Promise.resolve(reply).then((r) => {
        if (!r) { reject(new Error('ML host did not respond')); return; }
        if (r.ok === false) {
          const m = String(r.error || 'GPU worker failed');
          if (m.startsWith('GPU_SKIPPED:')) reject(chromeGpuSkippedError(m));
          else reject(new Error(m));
          return;
        }
        resolve(r);
      }, (e) => reject(e));
    });
    clearWatchdog();
    return { results: (res && res.results) || [], ms: (res && res.ms) || 0, totalTiles: (res && res.totalTiles) || 0, readyMs: (res && res.readyMs), loadMs: (res && res.loadMs) || 0 };
  } finally {
    clearWatchdog();
    if (activeChromeGpuJobs.get(runId) === job) activeChromeGpuJobs.delete(runId);
    if (chromeGpuProgressHooks.get(runId)) chromeGpuProgressHooks.delete(runId);
  }
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
