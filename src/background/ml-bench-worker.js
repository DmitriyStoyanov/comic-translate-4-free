// Thread-count benchmark worker — CLASSIC worker (not module), see ml-worker.js.
// Times ONE WASM thread count for the Baberu decoder step, the part of OCR
// that costs the most (one crop = 1 vision + 1 prefill + ~20-40 step runs;
// the steps dominate). A fresh worker per count, because ort.env.wasm.
// numThreads only takes effect before the first session is created in a
// realm — changing it later in the same realm does not reconfigure the
// pool. The host (offscreen.js) spawns one worker per count, keeps the
// fastest, and saves it.
//
// Workload: the real decoder_step graph (ocr-baberu-step-v12, from the
// shared IndexedDB), fed with dummy inputs. Timing does not depend on the
// input values — the step is dense matmuls whose cost depends only on the
// shapes — so zeros are a fair stand-in for a real KV cache. Shapes:
// input_ids [1,1] int64, position_ids [1,1] int64, past_* [1,2,257,64]
// float32 (257 = 256 vision tokens + 1 BOS, from the prefill logits
// [1,257,vocab] in baberu.js _decode). Names are read from the session
// itself, so a graph rename fails loudly instead of misfeeding.
//
// Protocol: host posts {type:'bench', threads, steps, warmup}; the worker
// replies once {type:'bench-result', ok, threads, medianMs, n} or
// {ok:false, threads, error}. The host terminates the worker after the
// reply (or on timeout). Chrome only in practice: without
// SharedArrayBuffer every count runs 1 thread, so the host never spawns
// this worker on Firefox.
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

const STEP_MODEL_ID = 'ocr-baberu-step-v12';
// past_len after prefill: 256 vision tokens + 1 BOS (prefill logits [1,257,vocab]).
const PAST_LEN = 257;
const PAST_DIM = 64;

function disposeAll(out) {
  for (const t of Object.values(out || {})) { try { t.dispose(); } catch {} }
}

async function benchOne(threads, steps, warmup) {
  ort.env.wasm.numThreads = Math.max(1, threads);
  const { openDb, idbGet } = await import('../shared/contracts.js');
  const { readChunked } = await import('../shared/model-specs.js');
  const db = await openDb();
  const rec = await idbGet(db, STEP_MODEL_ID);
  if (!rec) throw new Error('model "' + STEP_MODEL_ID + '" not in local cache');
  let bytes;
  if (rec.data) bytes = rec.data;
  else if (rec.chunks) bytes = await readChunked(db, STEP_MODEL_ID, rec);
  else throw new Error('cached model "' + STEP_MODEL_ID + '" is corrupt');
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const session = await ort.InferenceSession.create(u8, { executionProviders: ['wasm'] });
  try {
    // Build the dummy feed from the session's own input names.
    const feed = {};
    for (const name of session.inputNames) {
      if (name === 'input_ids' || name === 'position_ids') {
        feed[name] = new ort.Tensor('int64', BigInt64Array.from([BigInt(1)]), [1, 1]);
      } else if (/past/i.test(name)) {
        feed[name] = new ort.Tensor('float32', new Float32Array(2 * PAST_LEN * PAST_DIM), [1, 2, PAST_LEN, PAST_DIM]);
      }
    }
    if (!feed.input_ids && !Object.keys(feed).length) throw new Error('step session has no usable inputs');
    const times = [];
    try {
      for (let i = 0; i < warmup; i++) disposeAll(await session.run(feed));
      for (let i = 0; i < steps; i++) {
        const t0 = performance.now();
        disposeAll(await session.run(feed));
        times.push(performance.now() - t0);
      }
    } finally {
      for (const t of Object.values(feed)) { try { t.dispose(); } catch {} }
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  } finally {
    try { await session.release(); } catch {}
  }
}

self.onmessage = (e) => {
  const d = e && e.data;
  if (!d || d.type !== 'bench') return;
  const threads = d.threads | 0;
  const steps = Math.max(1, d.steps | 0 || 20);
  const warmup = Math.max(0, d.warmup | 0 || 2);
  benchOne(threads, steps, warmup).then(
    (medianMs) => self.postMessage({ type: 'bench-result', ok: true, threads, medianMs, n: steps }),
    (err) => self.postMessage({ type: 'bench-result', ok: false, threads, error: String((err && err.message) || err).slice(0, 200) }),
  );
};
