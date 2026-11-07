// PP-OCR text recognition via PaddlePaddle's official ONNX exports
// (PaddlePaddle/PP-OCRv6_small_rec_onnx inference.onnx — PP-OCRv6 small rec,
// 50 languages incl. all Latin-script accents: Italian, German, French,
// Spanish, Portuguese, Dutch, Danish, Norwegian; read 4/4 accented test
// lines exactly on 2026-11-07. Same CTC head / 48px preprocessing / dict+2
// class layout as PP-OCRv5, so this pipeline is unchanged). Apache License 2.0.
//
// Baberu reads only ja/en/zh: on an Italian bubble it hallucinates English
// gibberish (repetition loops, stray kana), so Latin sources need this
// engine. It is routed by ocrEngineForLang() in shared/model-specs.js.
//
// Faithful port of PaddleOCR's rec inference preprocessing (RecResizeImg +
// NormalizeImage + CTCLabelDecode, verified against PaddlePaddle's official
// PP-OCRv5 inference config on 2026-09-28):
//
//   crop -> RGB resize to height 48 keeping aspect (bilinear)
//        -> (x/255 - 0.5) / 0.5, CHW
//        -> rec.onnx [1,3,48,W] -> [1,seq,numClasses]
//        -> CTC greedy decode: argmax per step, collapse repeats, drop
//           class 0 (blank); dict line i -> class i+1
//           (PaddleOCR prepends 'blank' to the dict).
//
// The exported models report one more class than dict+blank
// (e.g. latin: 504 classes vs 502 dict lines + blank). That trailing class
// is the SPACE: the official PP-OCRv5 rec config trains/infers with
// use_space_char=true, which appends ' ' after the dict
// (PaddleOCR's CTCLabelDecode then maps the last class to ' ').
//
// Polarity: PP-OCR rec training is overwhelmingly dark ink on light paper.
// Comic captions and sound effects are often WHITE letters on dark ground.
// On flat synthetic crops rec still reads light-on-dark un-inverted
// (verified 2026-11-07), but real comic backgrounds are textured (halftone,
// gradients, JPEG noise) where the dark-on-light training distribution is
// the safer input — so ocrCropLines inverts light-text crops before every
// rec pass; dark-on-light crops pass through unchanged. The line splitter
// works on the original pixels and picks the polarity from the minority
// side (see splitIntoLines).
//
// PaddleOCR is Apache License 2.0 (https://github.com/PaddleOCR/PaddleOCR).

import { resizeBilinearRGBA, toGrayU8, otsuThreshold, connectedComponentsWithStats } from '../../shared/image-ops.js';
import { refineTitleBand } from '../../shared/style.js';

const IMG_H = 48;
const MAX_W = 1600; // bound memory/time on pathological aspect ratios

function preprocessCrop(rgba, w, h) {
  const dw = Math.max(1, Math.min(MAX_W, Math.round(IMG_H * (w / h))));
  const small = resizeBilinearRGBA(rgba, w, h, dw, IMG_H);
  const chw = new Float32Array(3 * IMG_H * dw);
  const plane = IMG_H * dw;
  for (let y = 0; y < IMG_H; y++) {
    for (let x = 0; x < dw; x++) {
      const s = (y * dw + x) * 4, d = y * dw + x;
      chw[d] = (small[s] / 255 - 0.5) / 0.5;
      chw[plane + d] = (small[s + 1] / 255 - 0.5) / 0.5;
      chw[2 * plane + d] = (small[s + 2] / 255 - 0.5) / 0.5;
    }
  }
  return { data: chw, w: dw };
}

// Returns { text, conf }. conf = mean probability of the kept characters — a
// cheap read-quality signal: clean text scores ~0.9+, hallucinated junk
// (stylized titles, art, logos, halftone) scores low. The exported head
// already ends in softmax; if a row does not sum to ~1 it is treated as
// logits and soft-maxed here so conf is a probability either way.
//
// Per-WORD filtering: one line often mixes real words with junk read off a
// logo or a gradient ("Reveeravamerimast? Dove eravamo rimasti..."), and the
// line average stays high. Each space-separated token is scored on its own;
// tokens below TOKEN_DROP, and symbol-only tokens that are not ordinary
// punctuation, are removed before the text is returned.
const TOKEN_DROP = 0.6;
function ctcGreedyDecode(logits, seqLen, numClasses, dict) {
  // use_space_char=true in the official config appends ' ' after the dict,
  // so exactly one class beyond dict+blank is the space character.
  const spaceClass = (numClasses === dict.length + 2) ? numClasses - 1 : -1;
  let prev = -1;
  const toks = [];
  let cur = { s: '', p: 0, n: 0, t0: -1, t1: -1 };
  const flush = () => { if (cur.n) toks.push(cur); cur = { s: '', p: 0, n: 0, t0: -1, t1: -1 }; };
  for (let t = 0; t < seqLen; t++) {
    const row = t * numClasses;
    let best = 0;
    for (let c = 1; c < numClasses; c++) {
      if (logits[row + c] > logits[row + best]) best = c;
    }
    if (best === 0 || best === prev) { prev = best; continue; }
    prev = best;
    if (best === spaceClass) { flush(); continue; }
    const ch = best - 1 < dict.length ? dict[best - 1] : '';
    if (!ch) continue;
    let sum = 0, mx = logits[row + best];
    for (let c = 0; c < numClasses; c++) sum += logits[row + c];
    let p;
    if (sum > 0.98 && sum < 1.02 && mx <= 1.0001) p = mx;
    else {
      let m = -Infinity;
      for (let c = 0; c < numClasses; c++) if (logits[row + c] > m) m = logits[row + c];
      let z = 0;
      for (let c = 0; c < numClasses; c++) z += Math.exp(logits[row + c] - m);
      p = 1 / z;
    }
    cur.s += ch; cur.p += p; cur.n++;
    if (cur.t0 < 0) cur.t0 = t;
    cur.t1 = t;
  }
  flush();
  const kept = toks.filter(k => {
    if (k.p / k.n < TOKEN_DROP) return false;
    // "●", "—", "|" and similar read off artwork: keep only tokens that carry
    // a letter or digit, or are plain sentence punctuation.
    if (!/[\p{L}\p{N}]/u.test(k.s) && !/^[.,;:!?'"()\-–—…]+$/.test(k.s)) return false;
    return true;
  });
  let ps = 0, pn = 0;
  for (const k of kept) { ps += k.p; pn += k.n; }
  // x0/x1: horizontal extent of the kept text as fractions of the crop width,
  // from the CTC timesteps of the first/last kept character (a timestep is
  // 1/seqLen of the width; one step of padding each side).
  let x0 = 0, x1 = 1;
  if (kept.length && seqLen > 0) {
    x0 = Math.max(0, (Math.min(...kept.map(k => k.t0)) - 1) / seqLen);
    x1 = Math.min(1, (Math.max(...kept.map(k => k.t1)) + 2) / seqLen);
  }
  return { text: kept.map(k => k.s).join(' ').trim(), conf: pn ? ps / pn : 0, x0, x1, seqLen,
    toks: kept.map(k => ({ s: k.s, p: k.p / k.n, n: k.n, t0: k.t0, t1: k.t1 })) };
}

// Join per-line OCR into running text: a line ending in "letter-" followed by
// a lowercase letter is a typeset hyphenation ("radi-" + "calmente"), so the
// halves are glued with no hyphen and no space; every other line break
// becomes a single space. Translators otherwise see the hard line breaks and
// split words, and the renderer re-wraps the text anyway.
export function joinOcrLines(parts) {
  let out = '';
  for (const raw of parts) {
    const line = raw.trim();
    if (!line) continue;
    if (!out) { out = line; continue; }
    if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(line)) out = out.slice(0, -1) + line;
    else out += ' ' + line;
  }
  return out;
}

// Lines below this mean-probability are dropped (junk would reach the
// translator, which invents fluent nonsense from it); below RETRY the line is
// re-read on the opposite polarity and the better read wins.
const CONF_RETRY = 0.85;
const CONF_DROP = 0.55;

// rec is a SINGLE-LINE model: squashing a multi-line bubble crop into one
// 48px row yields empty/garbage output (verified 2026-11-07). Crop text is
// split into lines first: Otsu binarize -> connected components -> group
// components whose vertical spans overlap (umlaut dots and descenders ride
// with their line) -> one rec pass per line box.
// Returns { lines, textIsDark }: textIsDark is the crop's ink polarity
// (minority side of the Otsu threshold), reused by ocrCropLines to pick
// whether the rec passes need an inversion.
function splitIntoLines(rgba, w, h) {
  const gray = toGrayU8(rgba, w, h);
  const t = otsuThreshold(gray);
  // Text is the minority side of the threshold — a bubble crop is mostly
  // background, whichever polarity the text uses (dark ink or white on
  // black).
  let dark = 0;
  for (let i = 0; i < gray.length; i++) if (gray[i] < t) dark++;
  const textIsDark = dark <= gray.length / 2;
  const bin = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    bin[i] = textIsDark ? (gray[i] < t ? 1 : 0) : (gray[i] >= t ? 1 : 0);
  }
  const { numLabels, stats } = connectedComponentsWithStats(bin, w, h, 8);
  const comps = [];
  for (let k = 1; k <= numLabels; k++) {
    const s = stats[k];
    if (s.area < 2) continue; // single-pixel JPEG specks
    comps.push(s);
  }
  // Artwork (character faces, outlines) and drop caps are far taller than
  // text glyphs; left in, they stretch a line box over several real lines
  // and chain-merge the paragraph into one box (-> squashed rec -> ''.
  // Drop components taller than 3x the median glyph height. Real big-glyph
  // text (sound effects) is unaffected: its median is itself large.
  let kept = comps;
  const hs = comps.filter(s => s.area >= 6).map(s => s.height).sort((a, b) => a - b);
  if (hs.length >= 8) {
    const medH = hs[hs.length >> 1];
    kept = comps.filter(s => s.height <= 3 * medH);
  }
  kept.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines = [];
  for (const s of kept) {
    let merged = false;
    for (const L of lines) {
      const ov = Math.min(s.top + s.height, L.y2) - Math.max(s.top, L.y1);
      const hOther = L.y2 - L.y1;
      if (ov > 0.3 * Math.min(s.height, hOther)) {
        L.x1 = Math.min(L.x1, s.left); L.x2 = Math.max(L.x2, s.left + s.width);
        L.y1 = Math.min(L.y1, s.top); L.y2 = Math.max(L.y2, s.top + s.height);
        merged = true;
        break;
      }
    }
    if (!merged) lines.push({ x1: s.left, y1: s.top, x2: s.left + s.width, y2: s.top + s.height });
  }
  lines.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  return { lines: mergeNearLines(lines), textIsDark };
}

// Diacritic-only boxes (the dots of Ü/Ä, apostrophe marks) get merged
// back into the line they ride on: a dot-only "line" is 2-3px tall and
// rec reads it as junk (".".".") — verified 2026-11-07. The small box
// must be much shorter than the line (<= 0.35 * its height — real
// bubble lines never are) and the gap must be small relative to the
// line's own height; real bubble line gaps are far larger than that
// fraction, so two-line bubbles stay separate.
function mergeNearLines(lines) {
  const out = [];
  for (const L of lines) {
    let merged = false;
    for (const G of out) {
      const hL = L.y2 - L.y1, hG = G.y2 - G.y1;
      const hMax = Math.max(hL, hG), hMin = Math.min(hL, hG);
      const gap = Math.max(L.y1 - G.y2, G.y1 - L.y2);
      const nearX = L.x2 >= G.x1 - hMax && G.x2 >= L.x1 - hMax;
      if (hMin <= 0.35 * hMax && gap <= 0.25 * hMax && nearX) {
        G.x1 = Math.min(G.x1, L.x1); G.x2 = Math.max(G.x2, L.x2);
        G.y1 = Math.min(G.y1, L.y1); G.y2 = Math.max(G.y2, L.y2);
        merged = true;
        break;
      }
    }
    if (!merged) out.push({ ...L });
  }
  return out;
}

function invertRGBA(rgba) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = 255 - rgba[i];
    out[i + 1] = 255 - rgba[i + 1];
    out[i + 2] = 255 - rgba[i + 2];
    out[i + 3] = rgba[i + 3];
  }
  return out;
}

function cropRect(rgba, w, x, y, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let r = 0; r < ch; r++) {
    out.set(rgba.subarray((y + r) * w * 4 + x * 4, (y + r) * w * 4 + x * 4 + cw * 4), r * cw * 4);
  }
  return out;
}

// Common short words that may legitimately start/end a title line.
const SHORT_WORDS = new Set(['a', 'e', 'i', 'o', 'u', 'il', 'la', 'lo', 'le', 'li', 'di', 'da', 'in', 'un', 'al', 'el', 'de', 'of', 'to', 'the', 'an', 'as', 'at', 'by', 'on', 'or', 'if', 'is', 'it', 'du', 'y', 'en', 'um', 'no', 'ne', 'se', 'si', 'su', 'me', 'mi', 'ti', 'tu', 'ci', 'vi', 'ha', 'ho', 'we', 'my', 'ma', 'na', 'ou', 'et']);

// Approximate-substring similarity (1 = the shorter text appears in the longer
// one, up to typos): semi-global Levenshtein on lower-cased letters/digits,
// free start/end in the longer string. A misread of part of a line ("reveeravamerimast")
// then scores high against the clean line that contains the same words.
function textSimilarity(a, b) {
  let x = a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''), y = b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (!x.length || !y.length) return 0;
  if (x.length > y.length) [x, y] = [y, x];   // x = shorter, matched inside y
  let prev = new Array(y.length + 1).fill(0);  // free start in y
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - Math.min(...prev) / x.length;     // free end in y
}

// Symmetric normalised Levenshtein similarity (1 = identical). Unlike
// textSimilarity (substring match), an extra stray letter COUNTS as a
// difference, which is what consensus voting between readings needs.
function textSimilaritySym(a, b) {
  const x = a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''), y = b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (!x.length && !y.length) return 1;
  if (!x.length || !y.length) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

export class PPOCRV5 {
  constructor() {
    this.session = null;
    this.dict = null;
  }

  async load(modelBytes, dictText, executionProviders = ['wasm']) {
    if (this.session) return;
    // Bytes go straight to ORT — no Blob/object-URL round trip (see detector.js).
    const u8 = modelBytes instanceof Uint8Array ? modelBytes : new Uint8Array(modelBytes);
    this.session = await ort.InferenceSession.create(u8, { executionProviders });
    this.dict = dictText.split('\n').map(l => l.replace(/\r$/, ''));
    // A trailing newline yields a final empty entry — not a character.
    if (this.dict.length && this.dict[this.dict.length - 1] === '') this.dict.pop();
  }

  get loaded() { return !!this.session; }

  reset() { this.session = null; this.dict = null; }

  async ocrSingle(rgba, w, h) {
    return (await this.recLine(rgba, w, h)).text;
  }

  async recLine(rgba, w, h) {
    const { data, w: dw } = preprocessCrop(rgba, w, h);
    const feeds = {};
    feeds[this.session.inputNames[0]] = new ort.Tensor('float32', data, [1, 3, IMG_H, dw]);
    const out = await this.session.run(feeds);
    const t = out[this.session.outputNames[0]];
    const seqLen = t.dims[1], numClasses = t.dims[2];
    return ctcGreedyDecode(t.data, seqLen, numClasses, this.dict);
  }

  // One crop -> text with lines joined by '\n'. Returns { text, lines }:
  // `lines` is how many rec passes produced `text` (1 = single line or the
  // vertical/noisy fallback below).
  async ocrCropLines(rgba, w, h) {
    const { lines: rects, textIsDark } = splitIntoLines(rgba, w, h);
    if (rects.length === 0) return { text: '', lines: 0 };
    // Light ink on dark ground (white captions, sound-effect lettering):
    // rec is trained dark-on-light, so invert before every pass. The line
    // rects and PAD math are polarity-independent pixel boxes.
    const ink = textIsDark ? rgba : invertRGBA(rgba);
    // > 16 "lines" means the split went vertical (sound effects stack glyph
    // columns with no vertical overlap) or turned noise into speck rows —
    // per-glyph rec would produce garbage, so fall back to one squashed
    // whole-crop pass, the pre-2.1.1 behavior.
    // Limit raised 16 -> 48: long caption/synopsis blocks (e.g. a 24-line
    // Italian paragraph) are legitimate and the squashed pass returns ''.
    if (rects.length > 48) return { text: await this.ocrSingle(ink, w, h), lines: 1 };
    const PAD = 4;
    const parts = [];
    let dropped = 0;
    for (const L of rects) {
      const x = Math.max(0, L.x1 - PAD), y = Math.max(0, L.y1 - PAD);
      const cw = Math.min(w - x, L.x2 - L.x1 + PAD * 2), ch = Math.min(h - y, L.y2 - L.y1 + PAD * 2);
      if (cw <= 0 || ch <= 0) continue;
      let r = await this.recLine(cropRect(ink, w, x, y, cw, ch), cw, ch);
      if (r.conf < CONF_RETRY) {
        // Wrong polarity guess (title over a halo, mixed-color lettering):
        // read the other polarity and keep whichever the model is surer of.
        const other = await this.recLine(invertRGBA(cropRect(ink, w, x, y, cw, ch)), cw, ch);
        if (other.conf > r.conf) r = other;
      }
      if (!r.text) continue;
      if (r.conf < CONF_DROP) { dropped++; continue; }
      parts.push({ text: r.text, conf: r.conf });
    }
    // Stylized header text is often read twice (a misread of the lettering plus
    // a cleaner pass of the same words). In short blocks, of two near-duplicate
    // lines keep the one the model was surer of.
    if (parts.length >= 2 && parts.length <= 3) {
      const drop = new Set();
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        if (drop.has(i) || drop.has(j)) continue;
        if (textSimilarity(parts[i].text, parts[j].text) >= 0.6) drop.add(parts[i].conf >= parts[j].conf ? j : i);
      }
      if (drop.size) { const kept = parts.filter((_, k) => !drop.has(k)); parts.length = 0; parts.push(...kept); }
    }
    let text = joinOcrLines(parts.map(p => p.text));
    // A block whose whole reading is a stray letter or two ("I", "●") is
    // artwork or lettering the model cannot read, not text: report it empty so
    // it is neither translated nor erased from the page.
    if ((text.match(/\p{L}/gu) || []).length < 3) text = '';
    // Nothing readable in a LARGE crop: big display lettering (a title on a
    // gradient, over artwork) defeats the Otsu line splitter. Search candidate
    // horizontal bands instead.
    if (!text && h >= 90 && w >= h * 1.2) {
      const bands = await this.ocrBands(rgba, w, h);
      if (bands.length) {
        return { text: bands.map(b => b.text).join(' '), lines: bands.length, dropped, bands };
      }
    }
    // Per-line readings (before joining) so list-like blocks can be translated
    // and drawn entry by entry; `text` itself stays space-joined.
    return { text, lines: parts.length, dropped, textLines: text ? parts.map(p => p.text.trim()).filter(Boolean) : null };
  }

  // Band search for display lettering. Candidate bands (several heights, 1/3
  // overlapping steps, full crop width) are each read by the line recognizer;
  // the best-scoring non-overlapping bands with a confident reading of >= 3
  // letters win. Full width is fine: junk read off artwork beside the lettering
  // is removed by the per-token confidence filter, and the recognizer's own
  // character positions give each band's horizontal extent. Returns bands in
  // crop coordinates: { x1, y1, x2, y2, text, conf }, top to bottom.
  async ocrBands(rgba, w, h) {
    const cands = [];
    // Positions are computed up front (no loop-control state mixed with early
    // `continue`s), heights ordered by how often display lettering matches them,
    // steps of half a band, and a hard time budget: a full-width pass is slow in
    // WASM and the ML host has a 60s watchdog for the whole OCR call.
    const BUDGET_MS = 12000;
    const t0 = performance.now();
    outer:
    for (const f of [0.22, 0.16, 0.3, 0.4]) {
      const H = Math.round(h * f);
      if (H < 28 || H > h) continue;
      const step = Math.max(8, Math.round(H / 2));
      const ys = [];
      for (let y0 = 0; y0 < h - H; y0 += step) ys.push(y0);
      ys.push(h - H);
      for (const y of ys) {
        if (performance.now() - t0 > BUDGET_MS) break outer;
        const r = await this.recLine(cropRect(rgba, w, 0, y, w, H), w, H);
        // Cluster the tokens by horizontal gaps: junk read off artwork beside the
        // lettering (an airship, a logo) sits far from the real words, so keep
        // only the cluster with the most letters. A gap > 1.3 band heights splits.
        const toks = (r.toks || []).filter(k => k.p >= 0.6).sort((p, q) => p.t0 - q.t0);
        if (!toks.length || !r.seqLen) continue;
        const px = (t) => (t / r.seqLen) * w;
        const clusters = [[toks[0]]];
        for (let i = 1; i < toks.length; i++) {
          const gap = px(toks[i].t0) - px(toks[i - 1].t1);
          if (gap > 1.3 * H) clusters.push([toks[i]]); else clusters[clusters.length - 1].push(toks[i]);
        }
        const letterCount = (c) => c.reduce((a, k) => a + (k.s.match(/\p{L}/gu) || []).length, 0);
        clusters.sort((p, q) => letterCount(q) - letterCount(p));
        const cl = clusters[0];
        // Short leading/trailing fragments that are not ordinary words ("YU")
        // are junk read off artwork or cut glyphs, not part of the lettering.
        const junkEnd = (k) => (k.s.match(/\p{L}/gu) || []).length <= 2 && !SHORT_WORDS.has(k.s.toLowerCase().replace(/[^\p{L}]/gu, ''));
        while (cl.length > 1 && junkEnd(cl[0])) cl.shift();
        while (cl.length > 1 && junkEnd(cl[cl.length - 1])) cl.pop();
        const letters = letterCount(cl);
        const conf = cl.reduce((a, k) => a + k.p * k.n, 0) / cl.reduce((a, k) => a + k.n, 0);
        if (letters >= 3 && conf >= 0.8) {
          const text = cl.map(k => k.s).join(' ');
          cands.push({
            y1: y, y2: y + H,
            x1: Math.max(0, Math.round(px(cl[0].t0 - 1))), x2: Math.min(w, Math.round(px(cl[cl.length - 1].t1 + 2))),
            text, conf, score: conf * Math.min(letters, 20),
          });
        }
      }
    }
    // Many overlapping candidate bands read the SAME line, each with its own
    // small errors (a cut glyph, an extra letter). Group the candidates by row
    // and take the consensus: the reading the other candidates agree with most
    // (confidence-weighted) beats one that merely happens to be the longest.
    cands.sort((a, b) => b.score - a.score);
    const rowOverlap = (p, q) => Math.min(p.y2, q.y2) - Math.max(p.y1, q.y1);
    const groups = [];
    for (const c of cands) {
      const g = groups.find(g => rowOverlap(g.rep, c) > 0.5 * Math.min(g.rep.y2 - g.rep.y1, c.y2 - c.y1));
      if (g) g.items.push(c); else groups.push({ rep: c, items: [c] });
    }
    const med = (arr) => { const v = [...arr].sort((p, q) => p - q); return v[v.length >> 1]; };
    const results = groups.map(g => {
      let best = g.items[0];
      if (g.items.length >= 3) {
        let bs = -1;
        for (const it of g.items) {
          let sc = it.conf * 0.01;
          for (const o of g.items) if (o !== it) sc += textSimilaritySym(it.text, o.text) * o.conf;
          if (sc > bs) { bs = sc; best = it; }
        }
      }
      const agree = g.items.filter(it => textSimilaritySym(it.text, best.text) >= 0.8);
      return {
        y1: med(agree.map(a => a.y1)), y2: med(agree.map(a => a.y2)),
        x1: med(agree.map(a => a.x1)), x2: med(agree.map(a => a.x2)),
        text: best.text, conf: best.conf, score: g.items.reduce((a, it) => a + it.score, 0),
      };
    });
    results.sort((a, b) => b.score - a.score);
    const chosen = [];
    for (const c of results) {
      const clash = chosen.some(k => rowOverlap(k, c) > 0.3 * Math.min(k.y2 - k.y1, c.y2 - c.y1) || textSimilarity(k.text, c.text) >= 0.6);
      if (!clash) chosen.push(c);
    }
    chosen.sort((a, b) => a.y1 - b.y1);
    // Second read inside each band's refined tight box. The first read spans the
    // full width, so artwork glyphs beside the lettering can end up glued to the
    // first word ("F" + "RITORNO"). The tight box follows only pixels of the
    // band's own colour that are connected to the lettering; re-reading inside
    // it (a little padding) drops those strays. Kept only if still confident and
    // not much shorter than the first reading.
    for (const c of chosen) {
      try {
        const ref = refineTitleBand(rgba, w, h, [c.x1, c.y1, c.x2, c.y2]);
        if (!ref) continue;
        const bh = ref.box[3] - ref.box[1], pad = Math.round(0.12 * bh) + 2;
        const rx1 = Math.max(0, Math.floor(ref.box[0] - pad)), ry1 = Math.max(0, Math.floor(ref.box[1] - pad));
        const rx2 = Math.min(w, Math.ceil(ref.box[2] + pad)), ry2 = Math.min(h, Math.ceil(ref.box[3] + pad));
        const cw = rx2 - rx1, ch = ry2 - ry1;
        if (cw < 16 || ch < 16) continue;
        const r2 = await this.recLine(cropRect(rgba, w, rx1, ry1, cw, ch), cw, ch);
        const l2 = (r2.text.match(/\p{L}/gu) || []).length, l1 = (c.text.match(/\p{L}/gu) || []).length;
        if (r2.conf >= 0.85 && l2 >= 3 && l2 >= 0.6 * l1) {
          c.text = r2.text; c.conf = r2.conf; c.x1 = rx1; c.x2 = rx2; c.y1 = ry1; c.y2 = ry2;
        }
      } catch { /* keep the first reading */ }
    }
    return chosen.map(({ x1, y1, x2, y2, text, conf }) => ({ x1, y1, x2, y2, text, conf }));
  }
}
