// Per-block source-style estimation (weight, alignment, line spacing,
// outline color) from the block's own pixels, so the renderer can set the
// translation in the same style as the source instead of one fixed look.
// Pure pixel math on the page RGBA — no model, ~ms per block.
import { toGrayU8, otsuThreshold, connectedComponentsWithStats, dilate } from './image-ops.js';

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const std = (a) => {
  if (a.length < 2) return 0;
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
};

// Returns { font_family, font_weight, alignment, line_spacing, stroke_color, src_lines }
// or null when the crop is unusable. Defaults are the old renderer's look
// (regular, centered, 1.0, no outline override) so a failed estimate is a
// no-op.
export function estimateBlockStyle(rgba, pw, ph, xyxy) {
  const x1 = Math.max(0, Math.floor(xyxy[0])), y1 = Math.max(0, Math.floor(xyxy[1]));
  const x2 = Math.min(pw, Math.ceil(xyxy[2])), y2 = Math.min(ph, Math.ceil(xyxy[3]));
  const w = x2 - x1, h = y2 - y1;
  if (w < 8 || h < 8) return null;
  const crop = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    crop.set(rgba.subarray(((y1 + y) * pw + x1) * 4, ((y1 + y) * pw + x2) * 4), y * w * 4);
  }
  const gray = toGrayU8(crop, w, h);
  const t = otsuThreshold(gray);
  let dark = 0;
  for (let i = 0; i < gray.length; i++) if (gray[i] <= t) dark++;
  const textIsDark = dark <= gray.length / 2;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = (textIsDark ? gray[i] <= t : gray[i] > t) ? 1 : 0;

  const { numLabels, labels, stats } = connectedComponentsWithStats(bin, w, h, 8);
  const comps = [];
  for (let k = 1; k <= numLabels; k++) if (stats[k].area >= 4) comps.push({ k, s: stats[k] });
  if (comps.length < 3) return null;
  const medH = median(comps.filter(c => c.s.area >= 6).map(c => c.s.height));
  if (!medH) return null;
  // Drop artwork / outlines (far taller than glyphs) and specks.
  const kept = comps.filter(c => c.s.height <= 3 * medH && c.s.height >= 0.2 * medH);
  if (kept.length < 3) return null;
  const keptSet = new Set(kept.map(c => c.k));

  // ---- lines (vertical-overlap grouping, same idea as the OCR splitter)
  const order = [...kept].sort((a, b) => a.s.top - b.s.top || a.s.left - b.s.left);
  let lines = [];
  for (const { s } of order) {
    let hit = null;
    for (const L of lines) {
      const ov = Math.min(s.top + s.height, L.y2) - Math.max(s.top, L.y1);
      if (ov > 0.3 * Math.min(s.height, L.y2 - L.y1)) { hit = L; break; }
    }
    if (hit) {
      hit.x1 = Math.min(hit.x1, s.left); hit.x2 = Math.max(hit.x2, s.left + s.width);
      hit.y1 = Math.min(hit.y1, s.top); hit.y2 = Math.max(hit.y2, s.top + s.height);
    } else lines.push({ x1: s.left, y1: s.top, x2: s.left + s.width, y2: s.top + s.height });
  }
  lines.sort((a, b) => a.y1 - b.y1);
  const medLineH = median(lines.map(L => L.y2 - L.y1));
  // Diacritic / punctuation-only slivers are not lines.
  lines = lines.filter(L => (L.y2 - L.y1) >= 0.5 * medLineH);
  if (!lines.length) return null;

  // ---- weight: stroke width = 2 * area / perimeter, relative to line height
  let area = 0, perim = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bin[i] || !keptSet.has(labels[i])) continue;
      area++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          !bin[i - 1] || !bin[i + 1] || !bin[i - w] || !bin[i + w]) perim++;
    }
  }
  const strokeW = perim ? (2 * area) / perim : 0;
  const weightRatio = medLineH ? strokeW / medLineH : 0;
  // Regular text is ~0.08-0.10 of its line-box height, bold ~0.14+.
  const font_weight = weightRatio > 0.125 ? 'bold' : 'normal';

  // ---- serif vs sans: stroke contrast. Row runs measure vertical stems,
  // column runs measure horizontal strokes (crossbars, hairlines, serifs);
  // runs longer than ~0.45 line-heights are stems seen end-on / big shapes and
  // are ignored. Serif faces have much thinner horizontals than stems (ratio
  // well above 1); sans faces are close to even. Heuristic — needs enough
  // glyphs to be meaningful, otherwise stays 'sans'.
  let font_family = 'sans';
  {
    const cap = Math.max(2, Math.round(0.45 * medLineH));
    const rowHist = new Uint32Array(cap + 1), colHist = new Uint32Array(cap + 1);
    const isInk = (i) => bin[i] && keptSet.has(labels[i]);
    for (let y = 0; y < h; y++) {
      let run = 0;
      for (let x = 0; x <= w; x++) {
        if (x < w && isInk(y * w + x)) run++;
        else { if (run > 0 && run <= cap) rowHist[run]++; run = 0; }
      }
    }
    for (let x = 0; x < w; x++) {
      let run = 0;
      for (let y = 0; y <= h; y++) {
        if (y < h && isInk(y * w + x)) run++;
        else { if (run > 0 && run <= cap) colHist[run]++; run = 0; }
      }
    }
    const histMedian = (hst) => {
      let tot = 0; for (let i = 1; i <= cap; i++) tot += hst[i];
      if (tot < 60) return 0;
      let acc = 0; for (let i = 1; i <= cap; i++) { acc += hst[i]; if (acc >= tot / 2) return i; }
      return 0;
    };
    const mRow = histMedian(rowHist), mCol = histMedian(colHist);
    if (mRow && mCol && mRow / mCol >= 1.6) font_family = 'serif';
  }

  // ---- alignment: majority vote on line edges. Standard deviation over all
  // lines is thrown off by text that wraps around artwork (lines indented or
  // right-aligned next to a character), so instead count how many lines share
  // the dominant left edge, right edge and centre. The paragraph's short last
  // line is ignored.
  const bw = Math.max(...lines.map(L => L.x2)) - Math.min(...lines.map(L => L.x1));
  let alignment = 'center';
  const body = lines.filter(L => (L.x2 - L.x1) >= 0.5 * bw);
  if (lines.length >= 3 && body.length >= 3 && bw > 0) {
    const tol = 0.04 * bw;
    const votes = (vals) => {
      const m = median(vals);
      return vals.filter(v => Math.abs(v - m) <= tol).length / vals.length;
    };
    const vl = votes(body.map(L => L.x1));
    const vr = votes(body.map(L => L.x2));
    const vc = votes(body.map(L => (L.x1 + L.x2) / 2));
    if (vl >= 0.6 && vr >= 0.6) alignment = 'justify';
    else if (vl >= 0.6 && vl >= vr && vl >= vc) alignment = 'left';
    else if (vr >= 0.6 && vr > vl && vr >= vc) alignment = 'right';
    else if (vc >= 0.6) alignment = 'center';
    else alignment = vl >= vr ? 'left' : 'right';
  }

  // ---- list-like: a left-aligned column of short, independent entries (a table
  // of contents, credits) rather than wrapped prose. Prose lines fill the column
  // to the same right edge; entries stop ragged. Such blocks are translated and
  // drawn line by line so entries are not fused into one paragraph.
  let list_like = false;
  if ((alignment === 'left' || alignment === 'justify') && lines.length >= 3 && bw > 0) {
    const inner = lines.slice(0, -1);
    const shortN = inner.filter(L => (L.x2 - L.x1) < 0.8 * bw).length;
    list_like = alignment === 'left' && shortN / inner.length >= 0.5;
  }

  // ---- wrap-around indents: in a left-aligned column, lines in the LOWER half
  // that start well right of the column's left edge mean the source text wrapped
  // around artwork (a character, a drawing). Record those line bands so the
  // translation can wrap around the same artwork instead of running into it.
  // Page coordinates; the top half is ignored (a drop cap's indent is not art
  // to avoid, and the cap itself is erased).
  let src_indents = [];
  if ((alignment === 'left' || alignment === 'justify') && lines.length >= 8 && bw > 0) {
    const leftEdge = median(body.map(L => L.x1));
    const maxY = Math.max(...lines.map(L => L.y2));
    for (const L of lines) {
      const ind = L.x1 - leftEdge;
      if (ind > 0.06 * bw && L.y1 > 0.5 * maxY) {
        src_indents.push({ y1: y1 + L.y1, y2: y1 + L.y2, x: Math.round(ind) });
      }
    }
  }

  // Source text-line boxes (page coords) for left-aligned columns: the mask
  // builder uses them to tell text components from artwork next to the column.
  let src_line_boxes = null;
  if ((alignment === 'left' || alignment === 'justify') && lines.length >= 8) {
    src_line_boxes = lines.map(L => ({ x1: x1 + L.x1, y1: y1 + L.y1, x2: x1 + L.x2, y2: y1 + L.y2 }));
  }

  // ---- line spacing: baseline pitch vs line-box height -> font line-height
  let line_spacing = 1;
  if (lines.length >= 2) {
    const pitches = [];
    for (let i = 1; i < lines.length; i++) pitches.push(lines[i].y1 - lines[i - 1].y1);
    const pitch = median(pitches);
    if (pitch > 0 && medLineH > 0) line_spacing = Math.max(0.9, Math.min(1.35, (pitch / medLineH) * 0.85 / 1.18));
  }

  // ---- outline: colour of the 1-2px ring around the glyphs, when it differs
  // from both the fill and the surrounding background (halo / stroke).
  let stroke_color = null;
  try {
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < ink.length; i++) ink[i] = (bin[i] && keptSet.has(labels[i])) ? 1 : 0;
    const d2 = dilate(ink, w, h, 3, 2), d9 = dilate(ink, w, h, 3, 6);
    let rn = 0, rr = 0, rg = 0, rb = 0, bn = 0, br = 0, bg = 0, bb = 0, fn = 0, fr = 0, fg = 0, fb = 0;
    for (let i = 0; i < ink.length; i++) {
      const o = i * 4;
      if (ink[i]) { fn++; fr += crop[o]; fg += crop[o + 1]; fb += crop[o + 2]; }
      else if (d2[i]) { rn++; rr += crop[o]; rg += crop[o + 1]; rb += crop[o + 2]; }
      else if (!d9[i]) { bn++; br += crop[o]; bg += crop[o + 1]; bb += crop[o + 2]; }
    }
    if (rn > 20 && fn > 20 && bn > 20) {
      const ringL = lum(rr / rn, rg / rn, rb / rn), fillL = lum(fr / fn, fg / fn, fb / fn), bgL = lum(br / bn, bg / bn, bb / bn);
      if (Math.abs(ringL - bgL) > 45 && Math.abs(ringL - fillL) > 40) {
        stroke_color = `rgb(${Math.round(rr / rn)},${Math.round(rg / rn)},${Math.round(rb / rn)})`;
      }
    }
  } catch { stroke_color = null; }

  return { list_like, src_line_boxes, src_indents, font_family, font_weight, alignment, line_spacing: Math.round(line_spacing * 100) / 100, stroke_color, src_lines: lines.length };
}

// Extent of a 1-D profile connected to its strongest point inside [lo, hi]:
// walk outward from the peak while the profile stays >= 8% of that peak,
// tolerating gaps up to maxGap (word spaces, a dotted i). Everything not
// connected to the lettering - a pale airship piece far above it, a logo far
// to the side - is never reached, however similar its colour is.
function connectedExtent(prof, lo, hi, maxGap) {
  lo = Math.max(0, Math.floor(lo)); hi = Math.min(prof.length - 1, Math.ceil(hi));
  if (hi < lo) return null;
  let seed = lo;
  for (let i = lo; i <= hi; i++) if (prof[i] > prof[seed]) seed = i;
  if (!prof[seed]) return null;
  const thr = 0.08 * prof[seed];
  let a = seed, g = 0;
  for (let i = seed - 1; i >= 0; i--) { if (prof[i] >= thr) { a = i; g = 0; } else if (++g > maxGap) break; }
  let b = seed; g = 0;
  for (let i = seed + 1; i < prof.length; i++) { if (prof[i] >= thr) { b = i; g = 0; } else if (++g > maxGap) break; }
  return [a, b];
}

// Title / display-lettering band refinement. Given a rough band box (page
// coords) from the band OCR, find the lettering's tight box and fill colour.
// Display lettering is saturated (teal, red, yellow) while the white halo and
// pale sky around it are not, so the letter mask is "saturated pixels"; rows
// and columns holding a meaningful share of that mask give the tight box, and
// the mean colour of the mask is the fill. Returns { box, color } or null when
// there is not enough saturated ink to trust (caller keeps the rough box).
export function refineTitleBand(rgba, pw, ph, box) {
  const first = refineBandBySaturation(rgba, pw, ph, box);
  if (!first) return null;
  // Grow until stable (max 3 rounds): a candidate band can cut a line in half,
  // and one round only reaches half a band further.
  let cur = first;
  for (let i = 0; i < 3; i++) {
    const next = growByColour(rgba, pw, ph, cur.box, cur.color);
    if (!next) break;
    const moved = Math.abs(next.box[1] - cur.box[1]) + Math.abs(next.box[3] - cur.box[3]) + Math.abs(next.box[0] - cur.box[0]) + Math.abs(next.box[2] - cur.box[2]);
    cur = next;
    if (moved <= 6) break;
  }
  return cur;
}

function growByColour(rgba, pw, ph, box, colorStr) {
  const first = { color: colorStr };
  // Second pass: fixed-height candidate bands cut letters, so the first box can
  // be too short. Grow the search area (vertically by half a band, a little
  // sideways) and select only pixels close to the band's own colour - a
  // neighbouring line in another colour (teal vs red) is excluded by colour,
  // not by position, so the whole letter height is found.
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(first.color);
  if (!m) return null;
  const c0 = [+m[1], +m[2], +m[3]];
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const x1 = Math.max(0, Math.floor(box[0] - bw * 0.12)), x2 = Math.min(pw, Math.ceil(box[2] + bw * 0.12));
  const y1 = Math.max(0, Math.floor(box[1] - bh * 0.5)), y2 = Math.min(ph, Math.ceil(box[3] + bh * 0.5));
  const w = x2 - x1, h = y2 - y1;
  if (w < 8 || h < 8) return null;
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = ((y1 + y) * pw + x1 + x) * 4;
      const dr = rgba[o] - c0[0], dg = rgba[o + 1] - c0[1], db = rgba[o + 2] - c0[2];
      if (dr * dr + dg * dg + db * db < 60 * 60) { mask[y * w + x] = 1; count++; }
    }
  }
  if (count < 150) return null;
  const rows = new Uint32Array(h), cols = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { rows[y]++; cols[x]++; }
  const re = connectedExtent(rows, box[1] - y1, box[3] - y1, 4);
  const ce = connectedExtent(cols, box[0] - x1, box[2] - x1, Math.max(8, Math.round(0.8 * bh)));
  if (!re || !ce) return null;
  const ty1 = re[0], ty2 = re[1], tx1 = ce[0], tx2 = ce[1];
  if (ty2 - ty1 < 8 || tx2 - tx1 < 8) return null;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = ty1; y <= ty2; y++) for (let x = tx1; x <= tx2; x++) {
    if (!mask[y * w + x]) continue;
    const o = ((y1 + y) * pw + x1 + x) * 4;
    sr += rgba[o]; sg += rgba[o + 1]; sb += rgba[o + 2]; n++;
  }
  if (!n) return null;
  return {
    box: [x1 + tx1 - 2, y1 + ty1 - 2, x1 + tx2 + 3, y1 + ty2 + 3],
    color: `rgb(${Math.round(sr / n)},${Math.round(sg / n)},${Math.round(sb / n)})`,
  };
}

function refineBandBySaturation(rgba, pw, ph, box) {
  const x1 = Math.max(0, Math.floor(box[0])), y1 = Math.max(0, Math.floor(box[1]));
  const x2 = Math.min(pw, Math.ceil(box[2])), y2 = Math.min(ph, Math.ceil(box[3]));
  const w = x2 - x1, h = y2 - y1;
  if (w < 8 || h < 8) return null;
  const m = new Uint8Array(w * h);
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = ((y1 + y) * pw + x1 + x) * 4;
      const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx > 0 && (mx - mn) / mx >= 0.28 && lum(r, g, b) < 225) { m[y * w + x] = 1; count++; }
    }
  }
  if (count < 150) return null;
  const rows = new Uint32Array(h), cols = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { rows[y]++; cols[x]++; }
  const re = connectedExtent(rows, 0, h - 1, 4);
  const ce = connectedExtent(cols, 0, w - 1, Math.max(8, Math.round(0.8 * h)));
  if (!re || !ce) return null;
  const ty1 = re[0], ty2 = re[1], tx1 = ce[0], tx2 = ce[1];
  if (ty2 - ty1 < 8 || tx2 - tx1 < 8) return null;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = ty1; y <= ty2; y++) for (let x = tx1; x <= tx2; x++) {
    if (!m[y * w + x]) continue;
    const o = ((y1 + y) * pw + x1 + x) * 4;
    sr += rgba[o]; sg += rgba[o + 1]; sb += rgba[o + 2]; n++;
  }
  if (!n) return null;
  return {
    box: [x1 + tx1 - 2, y1 + ty1 - 2, x1 + tx2 + 3, y1 + ty2 + 3],
    color: `rgb(${Math.round(sr / n)},${Math.round(sg / n)},${Math.round(sb / n)})`,
  };
}
