// Baberu OCR via the official ONNX exports in genshiai-daichi/baberu-ocr
// (Apache License 2.0, https://huggingface.co/genshiai-daichi/baberu-ocr).
//
// Character-level OCR trained specifically on modern manga speech bubbles
// (EN/ZH/JA). Three ONNX graphs, smallest tier:
//   vision_int4.onnx           (52.3MB)  crop -> vision_embeds
//   decoder_prefill_int8.onnx  (35.1MB)  vision_embeds + BOS -> logits + KV cache
//   decoder_step_int8.onnx     (33.9MB)  token + pos + KV cache -> logits + KV cache
//
// Faithful port of the repo's onnx_infer.py (pure-numpy host loop), verified
// against it on 2026-09-28:
//
//   crop -> RGB BICUBIC resize to 224x224 (whole crop, aspect NOT preserved)
//        -> (x/255 - mean) / std, ImageNet mean/std, CHW
//        -> vision [1,3,224,224] -> vision_embeds
//        -> prefill(vision_embeds, input_ids=[[BOS]]) -> logits + 12 past tensors
//        -> autoregressive step loop:
//             repetition_penalty 1.2 on all previously emitted ids
//             symbol-aware content-run cap: a letter/number id emitted 12 times
//               in a row gets -inf (kills repetition loops)
//             stop at EOS or 128 tokens
//        -> decode: ids 0..3 are <pad>/<bos>/<eos>/<unk>, id>=4 -> charset[id-4]
import { detectBlockLang } from '../../shared/lang-detect.js';
export const BABERU_IMG = 224;
const BOS = 1, EOS = 2;
// NOTE (2026-10-06): Baberu v1.1 (genshiai-daichi/baberu-ocr, 2026-10-06)
// fixed the ~64-character training cap. v1.0 trained labels were cut at 64
// chars (with EOS after the cut), so the model learned to stop at char 64;
// v1.1 was retrained on labels up to 256 chars with no EOS after a cut, and
// the ONNX step graph's RoPE now covers 2,048 positions (was 512 — a read
// past 255 tokens would have failed in a Gather). Upstream numbers on our
// tier (vision_int4 + decoder_*_int8): English bubbles of 65–256 chars,
// lCER 0.381 → 0.031, exact match 12% → 72%. Up to ~128 chars it reads
// almost everything; past ~190 the tail garbles (letters too small at
// 224×224). The chunked re-OCR below is now a rare fallback (only for
// >254-token decodes), not the primary path.
const MAX_NEW_TOKENS = 256;
const REPETITION_PENALTY = 1.2;
const MAX_CONTENT_RUN = 12;
// Upstream onnx_infer.py: stop a run of one symbol (ー/～/・) at 16 — now that
// a read can go past 64, an over-stretched ー could otherwise run to the 256
// cap. Vocab ids: ・=1472, ー=1473, ～=14239.
const SYMBOL_RUN_IDS = new Set([1472, 1473, 14239]);
const MAX_SYMBOL_RUN = 16;
const NUM_LAYERS = 6;
// v1.1 ceiling: emitted text is truncated at ~this many chars. CEILING_TOKENS
// is the point at which we treat a decode as clipped and re-OCR the crop in
// chunks (256 minus room for a trailing space/EOS). Rarely hit now.
const BABERU_MAX_CHARS = 256;
const CEILING_TOKENS = BABERU_MAX_CHARS - 2;
const SPLIT_OVERLAP = 0.15;  // fraction of the split axis duplicated at the seam
const MIN_CHUNK_PX = 40;     // don't split a crop whose split axis is smaller
const MAX_SPLIT_DEPTH = 2;   // up to 4 leaves -> ~4x256 chars of capacity

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

// Bicubic (Catmull-Rom) resize of RGBA, like PIL BICUBIC which the reference
// preprocessing uses.
function resizeBicubicRGBA(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh * 4);
  const xr = sw / dw, yr = sh / dh;
  const kernel = t => {
    const a = Math.abs(t);
    if (a <= 1) return 1.5 * a * a * a - 2.5 * a * a + 1;
    if (a <= 2) return -0.5 * a * a * a + 2.5 * a * a - 4 * a + 2;
    return 0;
  };
  for (let y = 0; y < dh; y++) {
    const gy = (y + 0.5) * yr - 0.5;
    const y0 = Math.floor(gy);
    for (let x = 0; x < dw; x++) {
      const gx = (x + 0.5) * xr - 0.5;
      const x0 = Math.floor(gx);
      for (let c = 0; c < 4; c++) {
        let acc = 0;
        for (let j = -1; j <= 2; j++) {
          const yy = Math.min(sh - 1, Math.max(0, y0 + j));
          const wy = kernel(gy - (y0 + j));
          for (let i = -1; i <= 2; i++) {
            const xx = Math.min(sw - 1, Math.max(0, x0 + i));
            acc += src[(yy * sw + xx) * 4 + c] * wy * kernel(gx - (x0 + i));
          }
        }
        out[(y * dw + x) * 4 + c] = acc;
      }
    }
  }
  return out;
}

function preprocessCrop(rgba, w, h) {
  const small = resizeBicubicRGBA(rgba, w, h, BABERU_IMG, BABERU_IMG);
  const chw = new Float32Array(3 * BABERU_IMG * BABERU_IMG);
  const plane = BABERU_IMG * BABERU_IMG;
  for (let i = 0; i < plane; i++) {
    chw[i] = (small[i * 4] / 255 - MEAN[0]) / STD[0];
    chw[plane + i] = (small[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    chw[2 * plane + i] = (small[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }
  return chw;
}

const EXCLUDED_RUN = new Set(['ー', 'ｰ', '〜', '~']);
// onnx_infer.py content_ids: single char, not in "ーｰ〜~", unicodedata
// category L* or N*. JS approximation via unicode property escapes.
function isContentChar(ch) {
  if ([...ch].length !== 1 || EXCLUDED_RUN.has(ch)) return false;
  return /\p{L}|\p{N}/u.test(ch);
}

// ---------------------------------------------------------------- chunking
// v1.1 reads up to ~256 chars natively, so this is now a rare fallback for
// crops whose text runs past the new ceiling (only extreme cases hit it).
// To recover the rest we split an oversized crop into two overlapping
// sub-crops along the axis its text lines STACK on (so concatenating the
// halves keeps reading order), OCR
// each, and stitch the pieces with the duplicated seam removed.

// Straight rectangle copy of an RGBA buffer (mirrors cropRGBA in
// service-worker.js). Returns { rgba, w, h }.
function cropRegion(rgba, w, h, x1, y1, x2, y2) {
  const ox = Math.max(0, Math.min(w - 1, Math.round(x1)));
  const oy = Math.max(0, Math.min(h - 1, Math.round(y1)));
  const cw = Math.max(1, Math.min(w, Math.round(x2)) - ox);
  const ch = Math.max(1, Math.min(h, Math.round(y2)) - oy);
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let r = 0; r < ch; r++) {
    const s = ((oy + r) * w + ox) * 4;
    out.set(rgba.subarray(s, s + cw * 4), r * cw * 4);
  }
  return { rgba: out, w: cw, h: ch };
}

// Which axis the text lines stack on, so a split preserves reading order.
//   en / zh (horizontal writing): lines stack vertically -> split by y, top
//     half first.
//   ja: may be vertical writing, where columns stack right-to-left -> split by
//     x, RIGHT half first. The pipeline never fills in TextBlock.direction, so
//     fall back to the crop aspect as a proxy.
function splitAxisFor(w, h, lang, forced) {
  if (forced === 'x') return { axis: 'x', rightFirst: lang === 'ja' };
  if (forced === 'y') return { axis: 'y', rightFirst: false };
  if (lang === 'ja') {
    if (h >= w * 1.2) return { axis: 'y', rightFirst: false }; // multi-line horizontal
    return { axis: 'x', rightFirst: true };                    // vertical writing
  }
  return { axis: 'y', rightFirst: false };
}

// Comparison key for the seam: case-insensitive, internal whitespace runs
// collapsed. Deliberately does NOT trim — trimming would let an off-by-one
// window (leading space on one side, trailing space on the other) compare equal
// and then splice at the wrong offset. Whitespace differences at the seam
// therefore fall through to the conservative space-join below.
const overlapNorm = s => s.toUpperCase().replace(/\s+/g, ' ');

// Join two chunk texts, dropping the run the overlapping crops read twice.
// Conservative: only removes a >=3-char exact (normalised) overlap; if the two
// crops read the seam differently it keeps both copies rather than losing text.
function overlapJoin(a, b) {
  const A = a.replace(/\s+$/, ''), B = b.replace(/^\s+/, '');
  const max = Math.min(A.length, B.length, 40);
  for (let n = max; n >= 3; n--) {
    if (overlapNorm(A.slice(-n)) === overlapNorm(B.slice(0, n))) return A + B.slice(n);
  }
  return A + ' ' + B;
}

export class BaberuOCR {
  constructor() {
    this.vis = null; this.pre = null; this.stp = null;
    this.id2ch = null; this.contentIds = null;
  }

  get loaded() { return !!this.vis; }

  // Release frees the sessions' blocks for reuse (dispose does not exist
  // on sessions — the old dispose calls were no-ops). The WASM heap
  // itself never shrinks; callers must await reset(). See detector.js.
  async reset() {
    for (const s of [this.vis, this.pre, this.stp]) { try { await s?.release?.(); } catch {} }
    this.vis = null; this.pre = null; this.stp = null;
  }

  // One graph at a time: the caller fetches each buffer, we build its session,
  // and the buffer is releasable before the next fetch. Holding all three
  // (121MB) at once — plus their blobs, pre-fix — spiked the transient peak.
  async loadVis(visBytes, executionProviders = ['wasm']) {
    if (this.vis) return;
    const u8 = visBytes instanceof Uint8Array ? visBytes : new Uint8Array(visBytes);
    this.vis = await ort.InferenceSession.create(u8, { executionProviders, logSeverityLevel: 3 });
  }

  async loadPre(preBytes, executionProviders = ['wasm']) {
    if (this.pre) return;
    const u8 = preBytes instanceof Uint8Array ? preBytes : new Uint8Array(preBytes);
    this.pre = await ort.InferenceSession.create(u8, { executionProviders, logSeverityLevel: 3 });
  }

  async loadStep(stepBytes, executionProviders = ['wasm']) {
    if (this.stp) return;
    const u8 = stepBytes instanceof Uint8Array ? stepBytes : new Uint8Array(stepBytes);
    this.stp = await ort.InferenceSession.create(u8, { executionProviders, logSeverityLevel: 3 });
  }

  setVocab(vocabJson) {
    const charset = JSON.parse(vocabJson);
    this.id2ch = new Map();
    this.contentIds = new Set();
    for (let i = 0; i < charset.length; i++) {
      this.id2ch.set(i + 4, charset[i]);
      if (isContentChar(charset[i])) this.contentIds.add(i + 4);
    }
  }

  // Legacy combined entry point (bytes go straight to ORT — no Blob URLs).
  async load(visBytes, preBytes, stepBytes, vocabJson, executionProviders = ['wasm']) {
    if (this.vis) return;
    await this.loadVis(visBytes, executionProviders);
    await this.loadPre(preBytes, executionProviders);
    await this.loadStep(stepBytes, executionProviders);
    this.setVocab(vocabJson);
  }

  _feed(session, obj) {
    // Map by name so graph renames don't silently misfeed.
    const feed = {};
    for (const n of session.inputNames) {
      if (n in obj) feed[n] = obj[n];
    }
    return feed;
  }

  _pastNames() {
    const names = [];
    for (const n of this.stp.inputNames) {
      if (/past/i.test(n)) names.push(n);
    }
    // Fall back to the documented order if names don't match.
    if (names.length !== 2 * NUM_LAYERS) {
      names.length = 0;
      for (let i = 0; i < NUM_LAYERS; i++) names.push(`past_k${i}`);
      for (let i = 0; i < NUM_LAYERS; i++) names.push(`past_v${i}`);
    }
    return names;
  }

  // One crop -> one decode. Returns { text, nTok, stopped }: the generated
  // text, how many character tokens were emitted (1 char per token, so == text
  // length for valid ids), and whether the loop ended on EOS or the
  // MAX_NEW_TOKENS safety cap.
  async _decode(rgba, w, h, shouldAbort = null) {
    const chw = preprocessCrop(rgba, w, h);
    const i64 = (v) => new ort.Tensor('int64', BigInt64Array.from([BigInt(v)]), [1, 1]);
    const tPixel = new ort.Tensor('float32', chw, [1, 3, BABERU_IMG, BABERU_IMG]);
    const visIn = this._feed(this.vis, { pixel_values: tPixel });
    if (!visIn || Object.keys(visIn).length === 0) {
      // Extremely defensive: feed positionally if no name matched.
      visIn[this.vis.inputNames[0]] = tPixel;
    }
    // Tensors hold WASM-heap buffers — every undisposed run leaks, and this
    // loop does up to 256 runs per crop. That leak was the 10~40-image
    // browser crash: dispose every input/output once its data is copied out.
    // try/finally: a throwing run() must not leak the inputs.
    let visEmbeds;
    try {
      const visOut = await this.vis.run(visIn);
      try {
        visEmbeds = visOut[this.vis.outputNames[0]];
        for (const n of Object.keys(visOut)) if (n !== this.vis.outputNames[0]) visOut[n].dispose();
      } catch (e) {
        for (const n of Object.keys(visOut)) try { visOut[n].dispose(); } catch {}
        throw e;
      }
    } finally {
      tPixel.dispose();
    }

    const tBos = i64(BOS);
    const preIn = this._feed(this.pre, {
      vision_embeds: visEmbeds,
      input_ids: tBos,
    });
    let preOut;
    try {
      preOut = await this.pre.run(preIn);
    } finally {
      tBos.dispose();
      visEmbeds.dispose(); // consumed by the prefill run above
    }
    const preNames = this.pre.outputNames;
    const preLogits = preOut[preNames[0]];
    // prefill logits are [1, 257, vocab] (256 vision + 1 BOS): take the last row.
    const pv = preLogits.dims[preLogits.dims.length - 1];
    let logits = preLogits.data.slice(preLogits.data.length - pv);
    preLogits.dispose();
    let present = preNames.slice(1).map(n => preOut[n]);

    const pastNames = this._pastNames();
    const seqLen = visEmbeds.dims[1];
    let pos = seqLen + 1;
    const seq = [BOS], toks = [];
    const vocabSize = this.id2ch.size + 4;
    let stopped = 'limit';

    for (let step = 0; step < MAX_NEW_TOKENS; step++) {
      // Bail every few steps when the run was cancelled — the 256-step loop
      // is seconds of WASM per crop that would otherwise burn after a page
      // change.
      if (shouldAbort && (step & 7) === 0 && shouldAbort()) throw new Error('cancelled');
      // repetition_penalty 1.2 over previously emitted ids (incl. BOS).
      const seen = new Set(seq);
      for (const tid of seen) {
        if (tid < vocabSize) {
          const s = logits[tid];
          logits[tid] = s < 0 ? s * REPETITION_PENALTY : s / REPETITION_PENALTY;
        }
      }
      // Symbol-aware content-run cap: 12 identical letter/number ids in a row
      // -> -inf (matches onnx_infer.py; kills repetition loops).
      if (toks.length && this.contentIds.has(toks[toks.length - 1])) {
        const last = toks[toks.length - 1];
        let run = 0;
        for (let i = toks.length - 1; i >= 0 && toks[i] === last; i--) run++;
        if (run >= MAX_CONTENT_RUN && last < vocabSize) logits[last] = -Infinity;
      }
      // v1.1: stop a run of one symbol (ー/～/・) at 16 (matches onnx_infer.py).
      // Now that reads can go past 64, an over-stretched ー could otherwise
      // run all the way to the 256 cap.
      if (toks.length && SYMBOL_RUN_IDS.has(toks[toks.length - 1])) {
        const last = toks[toks.length - 1];
        let run = 0;
        for (let i = toks.length - 1; i >= 0 && toks[i] === last; i--) run++;
        if (run >= MAX_SYMBOL_RUN && last < vocabSize) logits[last] = -Infinity;
      }
      let nxt = 0;
      for (let i = 1; i < vocabSize && i < logits.length; i++) {
        if (logits[i] > logits[nxt]) nxt = i;
      }
      if (nxt === EOS) { stopped = 'eos'; break; }
      toks.push(nxt);
      seq.push(nxt);
      if (toks.length >= MAX_NEW_TOKENS) break;
      const tId = i64(nxt), tPos = i64(pos);
      const feed = this._feed(this.stp, {
        input_ids: tId,
        position_ids: tPos,
      });
      for (let i = 0; i < pastNames.length && i < present.length; i++) {
        feed[pastNames[i]] = present[i];
      }
      const prevPresent = present;
      let out;
      try {
        out = await this.stp.run(feed);
      } catch (e) {
        // run() threw: prevPresent was never consumed — free it to avoid leak.
        for (const t of prevPresent) try { t.dispose(); } catch {}
        throw e;
      } finally {
        tId.dispose();
        tPos.dispose();
      }
      for (const t of prevPresent) t.dispose(); // consumed by the run above
      const names = this.stp.outputNames;
      const flat = out[names[0]];
      // logits layout [1, 1, vocab] -> last row.
      const n = flat.data.length, v = flat.dims[flat.dims.length - 1];
      logits = flat.data.slice(n - v);
      flat.dispose();
      present = names.slice(1).map(nm => out[nm]);
      pos++;
    }
    for (const t of present) t.dispose(); // last step's KV cache, no longer needed
    let text = '';
    for (const id of toks) {
      const ch = this.id2ch.get(id);
      if (ch !== undefined) text += ch;
    }
    // nTok is what decides "clipped": an EOS landing at >= CEILING_TOKENS chars
    // is the v1.1 256-char ceiling showing through, not a real ending.
    return { text, nTok: toks.length, stopped };
  }

  async ocrSingle(rgba, w, h, shouldAbort = null) {
    return (await this._decode(rgba, w, h, shouldAbort)).text;
  }

  // NOTE (2026-09-30): batched multi-crop decode was prototyped here and
  // reverted. The Baberu ONNX graphs bake batch=1 into every input
  // (decoder_step: input_ids [1,1], past_* [1,2,'past_len',64]; vision and
  // prefill likewise — verified by parsing the model files, only past_len is
  // symbolic). Batching needs a re-export with dynamic batch axes, which is
  // a model-side project, not a code change.

  // Chunked OCR for crops whose text runs past the model's ~256-char ceiling
  // (v1.1). Returns { text, chunks, hitCeiling, firstPass, stopped }: `chunks` is
  // how many decodes produced `text` (1 = no split), `firstPass` is the plain
  // single-crop decode (the fallback), and `stopped` is 'eos' | 'limit'.
  async ocrChunked(rgba, w, h, opts = {}) {
    const { lang = 'ja', axis = null, shouldAbort = null, depth = 0 } = opts;
    const first = await this._decode(rgba, w, h, shouldAbort);
    // this late is the symptom, not a natural sentence end. Length is the
    // trigger, not the stop reason (MAX_NEW_TOKENS is only a safety cap that a
    // real bubble never reaches).
    const hitCeiling = first.nTok >= CEILING_TOKENS;
    const plain = { text: first.text, chunks: 1, hitCeiling, firstPass: first.text, stopped: first.stopped };
    if (!hitCeiling || depth >= MAX_SPLIT_DEPTH) return plain;
    // 'auto' source: detect the script from the first-pass decode so the
    // split axis matches the text (vertical Japanese splits on x, everything
    // else on y). Undetectable -> 'ja', the old default.
    const effLang = lang === 'auto' ? (detectBlockLang(first.text) || 'ja') : lang;
    const { axis: ax, rightFirst } = splitAxisFor(w, h, effLang, axis);
    const len = ax === 'x' ? w : h;
    if (len < MIN_CHUNK_PX * 2) return plain; // too small to split usefully
    const mid = Math.round(len / 2), ov = Math.round(len * SPLIT_OVERLAP);
    let a, b;
    if (ax === 'x') {
      a = cropRegion(rgba, w, h, 0, 0, mid + ov, h);
      b = cropRegion(rgba, w, h, mid - ov, 0, w, h);
    } else {
      a = cropRegion(rgba, w, h, 0, 0, w, mid + ov);
      b = cropRegion(rgba, w, h, 0, mid - ov, w, h);
    }
    if (ax === 'x' && rightFirst) { const t = a; a = b; b = t; }
    if (shouldAbort && shouldAbort()) throw new Error('cancelled');
    const ra = await this.ocrChunked(a.rgba, a.w, a.h, { lang: effLang, axis: ax, shouldAbort, depth: depth + 1 });
    const rb = await this.ocrChunked(b.rgba, b.w, b.h, { lang: effLang, axis: ax, shouldAbort, depth: depth + 1 });
    const text = overlapJoin(ra.text, rb.text);
    // Splitting must not lose text: if the stitched result isn't longer than the
    // clipped single-pass decode, keep the simpler result.
    if (text.length <= first.text.length) return plain;
    // 'limit' means some piece ran into the MAX_NEW_TOKENS safety cap without
    // EOS — a degenerate (looping) output, worth flagging in the panel.
    const stopped = (ra.stopped === 'limit' || rb.stopped === 'limit') ? 'limit' : 'eos';
    return { text, chunks: ra.chunks + rb.chunks, hitCeiling, firstPass: first.text, stopped };
  }

  async ocrCrops(crops) {
    const out = [];
    for (const c of crops) out.push(await this.ocrSingle(c.rgba, c.w, c.h));
    return out;
  }
}
