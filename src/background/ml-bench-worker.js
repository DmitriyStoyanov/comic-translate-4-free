// Thread-count benchmark worker — CLASSIC worker (not module), see ml-worker.js.
// Times the FULL Baberu OCR chain for one WASM thread count, because the
// goal is the fastest OVERALL OCR time, not the fastest single stage.
// One crop = 1 vision + 1 prefill + ~20 step runs, and the stages scale
// differently with threads: the step model (small, autoregressive) is
// fastest on the few big cores, but the vision model (big, dense) may
// prefer more threads. A per-step measurement alone cannot prove the
// overall winner — it only covers ~20% of OCR time — so this worker
// times all three models and reports the total for a representative
// crop: vision + prefill + steps * step, with steps = the number of step
// runs timed (20, the representative crop: the test page averages ~18
// chars/crop and the code already says ~20-40 steps per crop).
// A fresh worker per count, because ort.env.wasm.numThreads only takes
// effect before the first session is created in a realm — changing it
// later in the same realm does not reconfigure the pool. The host
// (offscreen.js) spawns one worker per count, keeps the lowest total,
// and saves it.
//
// Workload: the real Baberu graphs (vision, prefill, step, from the
// shared IndexedDB), fed with dummy inputs chained like the real
// pipeline in baberu.js _decode: vision(dummy pixels) -> prefill(real
// vision_embeds + BOS) -> steps(real past tensors from prefill).
// Timing does not depend on the input values — these are dense matmuls
// whose cost depends only on the shapes — so zeros are a fair stand-in.
// Input names are read from each session itself, so a graph rename
// fails loudly instead of misfeeding. Shapes: vision pixel_values
// [1,3,224,224] float32; prefill vision_embeds [1,256,H] (from the real
// vision run) + input_ids [1,1] int64; step input_ids [1,1] int64,
// position_ids [1,1] int64, past_* [1,2,257,64] float32 (257 = 256
// vision tokens + 1 BOS, from the prefill logits [1,257,vocab]).
//
// Protocol: host posts {type:'bench', threads, steps, warmup}; the worker
// replies once {type:'bench-result', ok, threads, visionMs, prefillMs,
// stepMs, totalMs, n} or {ok:false, threads, error}. The host terminates
// the worker after the reply (or on timeout). Chrome only in practice:
// without SharedArrayBuffer every count runs 1 thread, so the host never
// spawns this worker on Firefox.
if (typeof chrome === 'undefined') {
  globalThis.chrome = {
    runtime: {
      getURL: (path) => new URL(path, new URL('/', self.location.href)).href,
    },
  };
}

importScripts('../offscreen/vendor/ort.min.js');

try {
  ort.env.wasm.wasmPaths = chrome.runtime.getURL('src/offscreen/vendor/');
} catch {
  ort.env.wasm.wasmPaths = new URL('../offscreen/vendor/', self.location.href).href;
}

const VISION_MODEL_ID = 'ocr-baberu-vision-v12';
const PREFILL_MODEL_ID = 'ocr-baberu-prefill-v12';
const STEP_MODEL_ID = 'ocr-baberu-step-v12';
const IMG = 224; // BABERU_IMG in baberu.js: vision input is [1,3,224,224]
const BOS = 1; // baberu.js: BOS = 1, EOS = 2

function disposeAll(out) {
  for (const t of Object.values(out || {})) { try { t.dispose(); } catch {} }
}

async function loadModel(db, idbGet, readChunked, id) {
  const rec = await idbGet(db, id);
  if (!rec) throw new Error('model "' + id + '" not in local cache');
  let bytes;
  if (rec.data) bytes = rec.data;
  else if (rec.chunks) bytes = await readChunked(db, id, rec);
  else throw new Error('cached model "' + id + '" is corrupt');
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return ort.InferenceSession.create(u8, { executionProviders: ['wasm'], logSeverityLevel: 3 });
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function benchOne(threads, steps, warmup) {
  ort.env.wasm.numThreads = Math.max(1, threads);
  const { openDb, idbGet } = await import('../shared/contracts.js');
  const { readChunked } = await import('../shared/model-specs.js');
  const db = await openDb();
  const vis = await loadModel(db, idbGet, readChunked, VISION_MODEL_ID);
  const pre = await loadModel(db, idbGet, readChunked, PREFILL_MODEL_ID);
  const stp = await loadModel(db, idbGet, readChunked, STEP_MODEL_ID);
  try {
    // --- vision: dummy pixels [1,3,224,224] ---
    const runVision = async () => {
      const tPixel = new ort.Tensor('float32', new Float32Array(3 * IMG * IMG), [1, 3, IMG, IMG]);
      try {
        const feed = {};
        if (vis.inputNames.includes('pixel_values')) feed.pixel_values = tPixel;
        else feed[vis.inputNames[0]] = tPixel;
        const out = await vis.run(feed);
        return out[vis.outputNames[0]];
      } finally { tPixel.dispose(); }
    };
    const visionTimes = [];
    for (let i = 0; i < warmup; i++) { const e = await runVision(); try { e.dispose(); } catch {} }
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const e = await runVision();
      visionTimes.push(performance.now() - t0);
      try { e.dispose(); } catch {}
    }
    const visionMs = median(visionTimes);

    // --- prefill: real vision_embeds + BOS ---
    // Keep the past tensors from the last prefill run for the step phase.
    let past = null;
    const runPrefill = async () => {
      const embeds = await runVision();
      const tBos = new ort.Tensor('int64', BigInt64Array.from([BigInt(BOS)]), [1, 1]);
      try {
        const feed = {};
        if (pre.inputNames.includes('vision_embeds')) feed.vision_embeds = embeds;
        else throw new Error('prefill session has no vision_embeds input');
        if (pre.inputNames.includes('input_ids')) feed.input_ids = tBos;
        else throw new Error('prefill session has no input_ids input');
        return await pre.run(feed);
      } finally { tBos.dispose(); embeds.dispose(); }
    };
    const takePast = (out) => {
      const kept = {};
      for (const n of pre.outputNames.slice(1)) kept[n] = out[n];
      return kept;
    };
    const prefillTimes = [];
    for (let i = 0; i < warmup; i++) {
      const out = await runPrefill();
      const p = takePast(out);
      try { out[pre.outputNames[0]].dispose(); } catch {}
      if (past) disposeAll(past);
      past = p;
    }
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const out = await runPrefill();
      prefillTimes.push(performance.now() - t0);
      const p = takePast(out);
      try { out[pre.outputNames[0]].dispose(); } catch {}
      if (past) disposeAll(past);
      past = p;
    }
    const prefillMs = median(prefillTimes);
    if (!past || !Object.keys(past).length) throw new Error('prefill returned no past tensors');

    // --- steps: prefill past tensors, mapped POSITIONALLY (like
    // baberu.js _decode) — the step's past input names come from its
    // own inputNames (/past/i, fallback past_k0..5/past_v0..5) and the
    // prefill's past outputs are outputNames.slice(1) in order. The two
    // graphs need NOT use the same names, and in fact they do not (that
    // is why production maps by index); mapping by name fails every
    // count. present = the past tensors in prefill-output order.
    const pastNames = [];
    for (const n of stp.inputNames) if (/past/i.test(n)) pastNames.push(n);
    if (pastNames.length !== 12) {
      pastNames.length = 0;
      for (let i = 0; i < 6; i++) pastNames.push('past_k' + i);
      for (let i = 0; i < 6; i++) pastNames.push('past_v' + i);
    }
    const present = pre.outputNames.slice(1).map((n) => past[n]);
    if (pastNames.length !== present.length) throw new Error('past count mismatch: step wants ' + pastNames.length + ', prefill gave ' + present.length);
    const feed = {};
    for (const name of stp.inputNames) {
      if (name === 'input_ids' || name === 'position_ids') {
        feed[name] = new ort.Tensor('int64', BigInt64Array.from([BigInt(1)]), [1, 1]);
      }
    }
    for (let i = 0; i < pastNames.length && i < present.length; i++) feed[pastNames[i]] = present[i];
    if (!feed.input_ids && !Object.keys(feed).length) throw new Error('step session has no usable inputs');
    const stepTimes = [];
    try {
      for (let i = 0; i < warmup; i++) disposeAll(await stp.run(feed));
      for (let i = 0; i < steps; i++) {
        const t0 = performance.now();
        disposeAll(await stp.run(feed));
        stepTimes.push(performance.now() - t0);
      }
    } finally {
      for (const t of Object.values(feed)) { try { t.dispose(); } catch {} }
    }
    const stepMs = median(stepTimes);
    const totalMs = visionMs + prefillMs + steps * stepMs;
    return { visionMs, prefillMs, stepMs, totalMs };
  } finally {
    try { await vis.release(); } catch {}
    try { await pre.release(); } catch {}
    try { await stp.release(); } catch {}
  }
}

self.onmessage = (e) => {
  const d = e && e.data;
  if (!d || d.type !== 'bench') return;
  const threads = d.threads | 0;
  const steps = Math.max(1, d.steps | 0 || 20);
  const warmup = Math.max(0, d.warmup | 0 || 2);
  benchOne(threads, steps, warmup).then(
    (r) => self.postMessage({ type: 'bench-result', ok: true, threads, visionMs: r.visionMs, prefillMs: r.prefillMs, stepMs: r.stepMs, totalMs: r.totalMs, n: steps }),
    (err) => self.postMessage({ type: 'bench-result', ok: false, threads, error: String((err && err.message) || err).slice(0, 200) }),
  );
};
