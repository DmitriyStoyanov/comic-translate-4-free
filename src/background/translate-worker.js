// Web Worker for translation (Firefox).
// Runs on its own thread, so the network I/O and response processing are not
// blocked when the main thread is hogged by WASM inpaint.
import { translateBlocks } from './translators.js';

self.onmessage = async (e) => {
  const { blocks, settings } = e.data;
  // Deadline signal: the worker used to pass null, so Google/Azure fetch
  // had no abort signal and no timeout — a stalled backend hung the pill
  // forever. Abort at 120s, matching the Chrome path's abortController.
  // The abort is a failover trigger now, not a kill: translateBlocks
  // rescues onto a fresh signal when the abort wasn't a user cancel.
  // The deadlineMs arg only caps LM Studio; this signal caps Google/Azure
  // too. The message below derives from DEADLINE_MS so it can't drift
  // from the value again.
  const DEADLINE_MS = Math.min(600, Math.max(30, Number(settings?.translateTimeoutSec) || 120)) * 1000;
  const ctrl = new AbortController();
  const deadlineId = setTimeout(() => ctrl.abort(), DEADLINE_MS);
  try {
    // Forward failover notices so the SW can show a pill.
    const onProgress = (p) => {
      if (p && p.failoverFrom && p.failoverTo) {
        self.postMessage({ type: 'failover-notice', failoverFrom: p.failoverFrom, failoverTo: p.failoverTo });
      }
    };
    const translated = await translateBlocks(blocks, settings, onProgress, ctrl.signal, DEADLINE_MS);
    clearTimeout(deadlineId);
    self.postMessage({ ok: true, translated, backendUsed: blocks[0]?.backendUsed });
  } catch (err) {
    clearTimeout(deadlineId);
    // Aborted on deadline: say so plainly instead of surfacing 'cancelled'.
    const msg = ctrl.signal.aborted
      ? `translate timed out after ${DEADLINE_MS / 1000}s — the translation backend may be stuck`
      : (err.message || String(err));
    self.postMessage({ ok: false, error: msg });
  }
};
