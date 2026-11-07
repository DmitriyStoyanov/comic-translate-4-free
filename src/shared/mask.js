// Inference logic ported from ogkalu2/comic-translate
// (Apache License 2.0, https://github.com/ogkalu2/comic-translate).
// Text-removal mask generation. Faithful port of the comic-translate algorithm:
//   modules/detection/utils/content.py  (detect_content_mask_in_bbox)
//   modules/utils/image_utils.py        (build_block_mask_data, _select_text_like_components,
//                                        build_bubble_clip_mask, clip_mask_components_to_bubble,
//                                        generate_mask)
//
// Masks are Uint8Array 0/255 (public) — internals use 0/1.
import {
  toGrayU8, otsuThreshold, connectedComponentsWithStats,
  dilate, erode, morphClose, fillHoles, dominantBinCenter,
} from './image-ops.js';
import { adjustTextLineCoords } from './textblock.js';

// ---- detect_content_mask_in_bbox ------------------------------------------------
// Otsu on grayscale, dual polarity (dark text + light text), CC filtering:
// keep (area > 10 OR (area >= 4 AND w,h <= 6)) AND 1px border margin AND
// (area < 50% of crop when crop > 150 px). Returns 0/255 mask.
export function detectContentMaskInBbox(cropRgba, w, h, minArea = 10, margin = 1) {
  const gray = toGrayU8(cropRgba, w, h);
  const t = otsuThreshold(gray);
  let mn = 255, mx = 0;
  for (let i = 0; i < gray.length; i++) { if (gray[i] < mn) mn = gray[i]; if (gray[i] > mx) mx = gray[i]; }
  const black = new Uint8Array(w * h), white = new Uint8Array(w * h);
  let anyB = false, anyW = false;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < t) { black[i] = 1; anyB = true; }
    if (gray[i] > t) { white[i] = 1; anyW = true; }
  }
  if (!anyB) for (let i = 0; i < gray.length; i++) black[i] = gray[i] === mn ? 1 : 0;
  if (!anyW) for (let i = 0; i < gray.length; i++) white[i] = gray[i] === mx ? 1 : 0;
  const mb = maskFromComponentStats(black, w, h, minArea, margin);
  const mw = maskFromComponentStats(white, w, h, minArea, margin);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = (mb[i] || mw[i]) ? 255 : 0;
  return out;
}

function maskFromComponentStats(binary, w, h, minArea, margin) {
  const { numLabels, labels, stats } = connectedComponentsWithStats(binary, w, h, 8);
  const out = new Uint8Array(w * h);
  if (numLabels <= 0) return out;
  const keep = new Set();
  for (let l = 1; l <= numLabels; l++) {
    const st = stats[l];
    const areaOk = st.area > minArea || (st.area >= 4 && st.width <= 6 && st.height <= 6);
    const borderOk = st.left >= margin && st.top >= margin &&
      st.left + st.width <= w - margin && st.top + st.height <= h - margin;
    let bigOk = true;
    if (w * h > 150) bigOk = st.area < 0.5 * w * h;
    if (areaOk && borderOk && bigOk) keep.add(l);
  }
  if (!keep.size) return out;
  for (let i = 0; i < labels.length; i++) if (keep.has(labels[i])) out[i] = 255;
  return out;
}

// ---- crop bounds ----------------------------------------------------------------
function resolveBlockCropBounds(imgW, imgH, blk, defaultPadding = 5) {
  let [cx1, cy1, cx2, cy2] = adjustTextLineCoords(blk.xyxy, 10, 10, imgW, imgH);
  if (blk.text_class === 'text_bubble' && blk.bubble_xyxy && blk.bubble_xyxy.length >= 4) {
    const [bx1, by1, bx2, by2] = blk.bubble_xyxy.map(v => Math.round(v));
    const margin = Math.max(4, Math.min(defaultPadding + 3, 12));
    const insetY = Math.max(2, Math.min(defaultPadding + 1, 8));
    cx1 = Math.min(cx1, Math.max(0, bx1 - margin));
    cy1 = Math.min(cy1, Math.max(0, by1 + insetY));
    cx2 = Math.max(cx2, Math.min(imgW, bx2 + margin));
    cy2 = Math.max(cy2, Math.min(imgH, by2 - insetY));
  }
  return [cx1, cy1, cx2, cy2];
}

// ---- _select_text_like_components ------------------------------------------------
// Keep CCs anchored in the detector box; admit near-neighbors only on size/row/column
// similarity; reject sparse long CCs as bubble outlines. Input 0/255, output 0/255.
function selectTextLikeComponents(cropMask255, textBounds, searchPadding) {
  const w = cropMask255.w, h = cropMask255.h;
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < binary.length; i++) binary[i] = cropMask255.data[i] ? 1 : 0;
  const { numLabels, labels, stats } = connectedComponentsWithStats(binary, w, h, 4);
  const out = new Uint8Array(w * h);
  if (numLabels <= 0) return { data: out, w, h };

  const [tx1, ty1, tx2, ty2] = textBounds.map(v => Math.round(v));
  const sx1 = Math.max(0, tx1 - searchPadding), sy1 = Math.max(0, ty1 - searchPadding);
  const sx2 = Math.min(w, tx2 + searchPadding), sy2 = Math.min(h, ty2 + searchPadding);
  if (sx2 <= sx1 || sy2 <= sy1) return { data: out, w, h };

  const candidateSet = new Set();
  for (let y = sy1; y < sy2; y++) for (let x = sx1; x < sx2; x++) {
    const l = labels[y * w + x];
    if (l > 0) candidateSet.add(l);
  }
  const candidates = [...candidateSet];
  if (!candidates.length) return { data: out, w, h };

  const cx1 = Math.max(0, tx1 - 2), cy1 = Math.max(0, ty1 - 2);
  const cx2 = Math.min(w, tx2 + 2), cy2 = Math.min(h, ty2 + 2);
  const coreCounts = new Map();
  for (let y = cy1; y < cy2; y++) for (let x = cx1; x < cx2; x++) {
    const l = labels[y * w + x];
    if (l > 0) coreCounts.set(l, (coreCounts.get(l) || 0) + 1);
  }

  const textW = Math.max(1, tx2 - tx1), textH = Math.max(1, ty2 - ty1);
  const outlineLenTh = Math.max(24, Math.round(0.3 * Math.max(textW, textH)));
  const isOutline = (l) => {
    const st = stats[l];
    const density = st.area / Math.max(1, st.width * st.height);
    return density < 0.08 && Math.max(st.width, st.height) > outlineLenTh;
  };

  const anchors = [];
  for (const l of candidates) {
    const st = stats[l];
    const coreCoverage = (coreCounts.get(l) || 0) / Math.max(1, st.area);
    if (coreCoverage >= 0.2 && !isOutline(l)) anchors.push(l);
  }
  if (!anchors.length) return { data: out, w, h };

  const keep = new Set(anchors);
  for (const l of candidates) {
    if (keep.has(l) || isOutline(l)) continue;
    const st = stats[l];
    const x = st.left, y = st.top, cw = st.width, ch = st.height, area = Math.max(1, st.area);
    for (const a of anchors) {
      const as = stats[a];
      const ax = as.left, ay = as.top, aw = as.width, ah = as.height;
      const areaSim = Math.min(area, as.area) / Math.max(area, as.area);
      const hSim = Math.min(ch, ah) / Math.max(ch, ah);
      const wSim = Math.min(cw, aw) / Math.max(cw, aw);
      const rowOv = Math.max(0, Math.min(y + ch, ay + ah) - Math.max(y, ay));
      const colOv = Math.max(0, Math.min(x + cw, ax + aw) - Math.max(x, ax));
      const hGap = Math.max(0, Math.max(x, ax) - Math.min(x + cw, ax + aw));
      const vGap = Math.max(0, Math.max(y, ay) - Math.min(y + ch, ay + ah));
      const sameRow = rowOv >= 0.5 * Math.min(ch, ah) && hSim >= 0.45 &&
        hGap <= Math.max(18, Math.round(0.8 * Math.max(ch, ah)));
      const sameCol = colOv >= 0.5 * Math.min(cw, aw) && wSim >= 0.45 &&
        vGap <= Math.max(18, Math.round(0.8 * Math.max(cw, aw)));
      if (areaSim >= 0.18 && (sameRow || sameCol)) { keep.add(l); break; }
    }
  }
  for (let i = 0; i < labels.length; i++) if (keep.has(labels[i])) out[i] = 255;
  return { data: out, w, h };
}

// ---- build_bubble_clip_mask ------------------------------------------------------
// Returns boolean clip mask (crop coords) for the bubble interior, or an inset ellipse
// fallback. Flood-fills the bubble background color from the text seed bbox.
function buildBubbleClipMask(cropW, cropH, bounds, bubbleXyxy, inset, pageGray, pageW, pageH, seedBbox) {
  const [x1, y1] = bounds;
  const [bx1r, by1r, bx2r, by2r] = bubbleXyxy.map(v => Math.round(v));
  // fallback ellipse in crop coords
  const ex1 = bx1r + inset - x1, ey1 = by1r + inset - y1;
  const ex2 = bx2r - inset - x1, ey2 = by2r - inset - y1;
  const ecx = (ex1 + ex2) / 2, ecy = (ey1 + ey2) / 2;
  const erx = Math.max(1, (ex2 - ex1) / 2), ery = Math.max(1, (ey2 - ey1) / 2);
  const ellipse = new Uint8Array(cropW * cropH);
  for (let y = 0; y < cropH; y++) for (let x = 0; x < cropW; x++) {
    const dx = (x - ecx) / erx, dy = (y - ecy) / ery;
    if (dx * dx + dy * dy <= 1) ellipse[y * cropW + x] = 1;
  }

  try {
    const margin = 5;
    const cyy1 = Math.max(0, by1r - margin), cyy2 = Math.min(pageH, by2r + margin);
    const cxx1 = Math.max(0, bx1r - margin), cxx2 = Math.min(pageW, bx2r + margin);
    const cw = cxx2 - cxx1, ch = cyy2 - cyy1;
    if (cw <= 0 || ch <= 0) return ellipse;
    const crop = new Uint8ClampedArray(cw * ch);
    for (let y = 0; y < ch; y++) crop.set(pageGray.subarray((cyy1 + y) * pageW + cxx1, (cyy1 + y) * pageW + cxx2), y * cw);

    let sx1, sy1, sx2, sy2;
    if (seedBbox) [sx1, sy1, sx2, sy2] = seedBbox.map(v => Math.round(v));
    else { const mcx = (bx1r + bx2r) >> 1, mcy = (by1r + by2r) >> 1; sx1 = mcx - 5; sx2 = mcx + 5; sy1 = mcy - 5; sy2 = mcy + 5; }
    const sry1 = Math.max(0, sy1 - cyy1), sry2 = Math.min(ch, sy2 - cyy1);
    const srx1 = Math.max(0, sx1 - cxx1), srx2 = Math.min(cw, sx2 - cxx1);
    if (sry2 <= sry1 || srx2 <= srx1) return ellipse;

    const seedRegion = [];
    for (let y = sry1; y < sry2; y++) for (let x = srx1; x < srx2; x++) seedRegion.push(crop[y * cw + x]);
    if (!seedRegion.length) return ellipse;
    const bgVal = dominantBinCenter(Uint8ClampedArray.from(seedRegion));
    const bgMask = new Uint8Array(cw * ch);
    for (let i = 0; i < bgMask.length; i++) bgMask[i] = Math.abs(crop[i] - bgVal) <= 20 ? 1 : 0;
    const { labels } = connectedComponentsWithStats(bgMask, cw, ch, 4);
    const seedLabels = new Set();
    for (let y = sry1; y < sry2; y++) for (let x = srx1; x < srx2; x++) {
      if (bgMask[y * cw + x]) { const l = labels[y * cw + x]; if (l > 0) seedLabels.add(l); }
    }
    if (!seedLabels.size) return ellipse;
    const bubbleMask = new Uint8Array(cw * ch);
    for (let i = 0; i < bubbleMask.length; i++) bubbleMask[i] = seedLabels.has(labels[i]) ? 1 : 0;

    // border touch ratio validation
    const bRY1 = by1r - cyy1, bRY2 = by2r - cyy1, bRX1 = bx1r - cxx1, bRX2 = bx2r - cxx1;
    let touch = 0, total = 0;
    const sample = (yy, xx) => { if (yy >= 0 && yy < ch && xx >= 0 && xx < cw) { total++; if (bubbleMask[yy * cw + xx]) touch++; } };
    for (let x = Math.max(0, bRX1); x < Math.min(cw, bRX2); x++) { sample(bRY1, x); sample(bRY2 - 1, x); }
    for (let y = Math.max(0, bRY1); y < Math.min(ch, bRY2); y++) { sample(y, bRX1); sample(y, bRX2 - 1); }
    if (total === 0 || touch / total < 0.5) return ellipse;

    let filled = fillHoles(bubbleMask, cw, ch);
    const segInset = Math.min(2, inset);
    if (segInset > 0) {
      // cross-shaped 3x3 erode
      let cur = filled;
      for (let it = 0; it < segInset; it++) {
        const out = new Uint8Array(cw * ch);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const i = y * cw + x;
          out[i] = (cur[i] && (x > 0 ? cur[i - 1] : 0) && (x < cw - 1 ? cur[i + 1] : 0) &&
            (y > 0 ? cur[i - cw] : 0) && (y < ch - 1 ? cur[i + cw] : 0)) ? 1 : 0;
        }
        cur = out;
      }
      filled = cur;
    }
    // map back to bounds coords
    const finalClip = new Uint8Array(cropW * cropH);
    const oy1 = Math.max(y1, cyy1), oy2 = Math.min(bounds[3], cyy2);
    const ox1 = Math.max(bounds[0], cxx1), ox2 = Math.min(bounds[2], cxx2);
    if (oy2 > oy1 && ox2 > ox1) {
      for (let y = oy1; y < oy2; y++) for (let x = ox1; x < ox2; x++) {
        if (filled[(y - cyy1) * cw + (x - cxx1)]) finalClip[(y - y1) * cropW + (x - x1)] = 1;
      }
    }
    if (seedBbox) {
      const sp = 2;
      const enx1 = Math.max(0, sx1 - sp - x1), eny1 = Math.max(0, sy1 - sp - y1);
      const enx2 = Math.min(cropW, sx2 + sp - x1), eny2 = Math.min(cropH, sy2 + sp - y1);
      for (let y = eny1; y < eny2; y++) for (let x = enx1; x < enx2; x++) {
        const i = y * cropW + x;
        if (ellipse[i]) finalClip[i] = 1;
      }
    }
    return finalClip;
  } catch { return ellipse; }
}

// ---- clip_mask_components_to_bubble ------------------------------------------------
function clipMaskComponentsToBubble(cropMask255, cropW, cropH, bounds, bubbleXyxy, inset,
    pageGray, pageW, pageH, seedBbox, dilateK, dilateIt) {
  const clip = buildBubbleClipMask(cropW, cropH, bounds, bubbleXyxy, inset, pageGray, pageW, pageH, seedBbox);
  if (!clip) {
    const d = dilate(to01(cropMask255), cropW, cropH, dilateK, dilateIt);
    return from01(d);
  }
  const binary = to01(cropMask255);
  const { numLabels, labels } = connectedComponentsWithStats(binary, cropW, cropH, 4);
  const overlapping = new Set();
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] > 0 && clip[i]) overlapping.add(labels[i]);
  }
  if (!overlapping.size) return new Uint8Array(cropW * cropH);
  const kept = new Uint8Array(cropW * cropH);
  for (let i = 0; i < labels.length; i++) {
    if (overlapping.has(labels[i])) kept[i] = clip[i] ? 255 : 0;
  }
  if (dilateK > 0) {
    const d = dilate(to01(kept), cropW, cropH, dilateK, dilateIt);
    const out = new Uint8Array(cropW * cropH);
    for (let i = 0; i < out.length; i++) out[i] = (clip[i] && d[i]) || (kept[i] === 255) ? 255 : 0;
    return out;
  }
  return kept;
}

function to01(m255) { const o = new Uint8Array(m255.length); for (let i = 0; i < o.length; i++) o[i] = m255[i] ? 1 : 0; return o; }
function from01(m01) { const o = new Uint8Array(m01.length); for (let i = 0; i < o.length; i++) o[i] = m01[i] ? 255 : 0; return o; }

function cropPageRgba(pageRgba, pageW, x1, y1, x2, y2) {
  const w = x2 - x1, h = y2 - y1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    out.set(pageRgba.subarray(((y1 + y) * pageW + x1) * 4, ((y1 + y) * pageW + x2) * 4), y * w * 4);
  }
  return out;
}

// Display lettering (title bands from the band OCR): the generic Otsu mask fails
// on gradients and artwork, so build the mask directly from each band's own
// colour - pixels inside the band box close to its fill colour - then grow it a
// few pixels to take the anti-aliased edge and any outline with it.
function buildBandMaskData(pageRgba, pageW, pageH, blk) {
  const parse = (c) => { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c || ''); return m ? [+m[1], +m[2], +m[3]] : null; };
  const bands = blk.src_bands.filter(b => parse(b.color));
  if (!bands.length) return null;
  const PAD = 14;
  let ux1 = 1e9, uy1 = 1e9, ux2 = -1, uy2 = -1;
  for (const b of bands) {
    ux1 = Math.min(ux1, b.xyxy[0]); uy1 = Math.min(uy1, b.xyxy[1]);
    ux2 = Math.max(ux2, b.xyxy[2]); uy2 = Math.max(uy2, b.xyxy[3]);
  }
  const cx1 = Math.max(0, Math.floor(ux1 - PAD)), cy1 = Math.max(0, Math.floor(uy1 - PAD));
  const cx2 = Math.min(pageW, Math.ceil(ux2 + PAD)), cy2 = Math.min(pageH, Math.ceil(uy2 + PAD));
  const cw = cx2 - cx1, ch = cy2 - cy1;
  if (cw <= 0 || ch <= 0) return null;
  const m = new Uint8Array(cw * ch);
  let any = false;
  for (const b of bands) {
    const [r0, g0, b0] = parse(b.color);
    const bx1 = Math.max(cx1, Math.floor(b.xyxy[0]) - 4), by1 = Math.max(cy1, Math.floor(b.xyxy[1]) - 4);
    const bx2 = Math.min(cx2, Math.ceil(b.xyxy[2]) + 4), by2 = Math.min(cy2, Math.ceil(b.xyxy[3]) + 4);
    for (let y = by1; y < by2; y++) {
      for (let x = bx1; x < bx2; x++) {
        const o = (y * pageW + x) * 4;
        const dr = pageRgba[o] - r0, dg = pageRgba[o + 1] - g0, db = pageRgba[o + 2] - b0;
        if (dr * dr + dg * dg + db * db < 75 * 75) { m[(y - cy1) * cw + (x - cx1)] = 1; any = true; }
      }
    }
  }
  if (!any) return null;
  return { mask: from01(dilate(m, cw, ch, 3, 4)), w: cw, h: ch, bounds: [cx1, cy1, cx2, cy2] };
}

// ---- build_block_mask_data ----------------------------------------------------------
// Returns {mask: 0/255 Uint8Array, w, h, bounds:[x1,y1,x2,y2]} or null.
export function buildBlockMaskData(pageRgba, pageW, pageH, pageGray, blk, defaultPadding = 5) {
  if (!blk.text && !blk.translation) return null;
  if (Array.isArray(blk.src_bands) && blk.src_bands.length) {
    const bm = buildBandMaskData(pageRgba, pageW, pageH, blk);
    if (bm) return bm;
  }
  const [cx1, cy1, cx2, cy2] = resolveBlockCropBounds(pageW, pageH, blk, defaultPadding);
  const cw = cx2 - cx1, ch = cy2 - cy1;
  if (cw <= 0 || ch <= 0) return null;
  const crop = cropPageRgba(pageRgba, pageW, cx1, cy1, cx2, cy2);

  let cropMask = detectContentMaskInBbox(crop, cw, ch);
  let any = false;
  for (let i = 0; i < cropMask.length; i++) { if (cropMask[i]) { any = true; break; } }
  if (!any) return null;
  cropMask = from01(morphClose(to01(cropMask), cw, ch));
  // Artwork the source text wrapped around (a character, a drawing): the lines
  // next to it were indented, so the strip at the column's left edge, from the
  // first indented line down, is not text. Its dark/white shapes would otherwise
  // pass for glyph-like components and get erased (e.g. a character's face).
  if (Array.isArray(blk.src_indents) && blk.src_indents.length) {
    const minInd = Math.min(...blk.src_indents.map(b => b.x));
    const topY = Math.min(...blk.src_indents.map(b => b.y1));
    const zx1 = Math.max(0, Math.round(blk.xyxy[0] - cx1) - 6);
    const zx2 = Math.min(cw, Math.round(blk.xyxy[0] - cx1 + minInd * 0.85));
    const zy1 = Math.max(0, Math.round(topY - cy1) - 4);
    for (let y = zy1; y < ch; y++) for (let x = zx1; x < zx2; x++) cropMask[y * cw + x] = 0;
  }

  const isBubble = blk.text_class === 'text_bubble' && blk.bubble_xyxy && blk.bubble_xyxy.length >= 4;
  const [tx1, ty1, tx2, ty2] = blk.xyxy.map(v => Math.round(v));
  const textBounds = [tx1 - cx1, ty1 - cy1, tx2 - cx1, ty2 - cy1];
  const searchPadding = Math.max(16, Math.min(defaultPadding + 23, 32));
  // Filter to text-like components for BOTH bubble and free text. Free text
  // on textured/photo backgrounds otherwise masks huge non-text areas,
  // producing giant LaMa patches (slow, blurry, OOM-prone).
  const sel = selectTextLikeComponents({ data: cropMask, w: cw, h: ch }, textBounds, searchPadding);
  cropMask = sel.data;
  // Artwork beside a left-aligned column (a character the text wraps around):
  // in the LOWER half of the block, a mask component whose centre lies outside
  // every detected source text line is artwork, not text, and is dropped. The
  // top half is exempt so a drop cap (taller than a text line) is still erased.
  if (Array.isArray(blk.src_line_boxes) && blk.src_line_boxes.length) {
    const bin = new Uint8Array(cw * ch);
    for (let i = 0; i < bin.length; i++) bin[i] = cropMask[i] ? 1 : 0;
    const { numLabels, labels, stats } = connectedComponentsWithStats(bin, cw, ch, 8);
    const midY = blk.xyxy[1] + 0.5 * (blk.xyxy[3] - blk.xyxy[1]);
    const drop = new Set();
    for (let l = 1; l <= numLabels; l++) {
      const st = stats[l];
      const cxp = cx1 + st.left + st.width / 2, cyp = cy1 + st.top + st.height / 2;
      if (cyp <= midY) continue;
      // Right-hand tolerance of ~1.2 line heights: an end-of-line hyphen is too
      // small to count when the line boxes were built, so it sits just past x2.
      const inside = blk.src_line_boxes.some(L => cxp >= L.x1 - 6 && cxp <= L.x2 + Math.max(6, (L.y2 - L.y1) * 1.2) && cyp >= L.y1 - 6 && cyp <= L.y2 + 6);
      if (!inside) drop.add(l);
    }
    if (drop.size) for (let i = 0; i < labels.length; i++) if (drop.has(labels[i])) cropMask[i] = 0;
  }

  const k = Math.min(defaultPadding, 3), iters = 2;
  let dilated;
  if (isBubble) {
    const inset = Math.max(1, k);
    dilated = clipMaskComponentsToBubble(cropMask, cw, ch, [cx1, cy1, cx2, cy2],
      blk.bubble_xyxy, inset, pageGray, pageW, pageH, blk.xyxy, k, iters);
    // final envelope: detector envelope + 2px, plus 5x5x1 halo of admitted components
    const fp = 2;
    const ex1 = Math.max(0, tx1 - cx1 - fp), ey1 = Math.max(0, ty1 - cy1 - fp);
    const ex2 = Math.min(cw, tx2 - cx1 + fp), ey2 = Math.min(ch, ty2 - cy1 + fp);
    const halo = dilate(to01(cropMask), cw, ch, 5, 1);
    const out = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const inEnv = x >= ex1 && x < ex2 && y >= ey1 && y < ey2;
      out[y * cw + x] = (inEnv || halo[y * cw + x]) ? dilated[y * cw + x] : 0;
    }
    dilated = out;
  } else {
    // Free text has no bubble outline to protect, and its anti-aliased edges,
    // halos and drop shadows survive a 3px x 2 dilation as ghost text after
    // inpainting. Grow wider (3 passes), and one more for big lettering
    // (titles), where the halo scales with the glyph size.
    const big = Math.min(tx2 - tx1, ty2 - ty1) > 60;
    dilated = from01(dilate(to01(cropMask), cw, ch, k, iters + (big ? 2 : 1)));
  }
  return { mask: dilated, w: cw, h: ch, bounds: [cx1, cy1, cx2, cy2] };
}

// ---- generate_mask ------------------------------------------------------------------
// Full-page 0/255 mask from all blocks.
export function generateMask(pageRgba, pageW, pageH, pageGray, blkList, defaultPadding = 5) {
  const full = new Uint8Array(pageW * pageH);
  const entries = [];
  for (const blk of blkList) {
    const e = buildBlockMaskData(pageRgba, pageW, pageH, pageGray, blk, defaultPadding);
    if (!e) continue;
    entries.push({ block: blk, ...e });
    const [cx1, cy1] = e.bounds;
    for (let y = 0; y < e.h; y++) {
      for (let x = 0; x < e.w; x++) {
        if (e.mask[y * e.w + x]) full[(cy1 + y) * pageW + (cx1 + x)] = 255;
      }
    }
  }
  return { mask: full, entries };
}

// ---- flat-background fill ---------------------------------------------------------
// LaMa on a big dense text mask over plain paper leaves blurry grey remnants
// ("ghost text"). Where the background right around the text is a single
// plain colour, the right fill is exactly that colour. The test is LOCAL: the
// mask is walked in 32px tiles and each tile is judged on the unmasked pixels
// in its own 56px window, so a tile over artwork (a character the mask
// reaches into, a gradient edge) fails and keeps the LaMa result, while the
// plain paper next to it is still cleaned. A tile needs >= 80% of its window's
// background samples within +-10 luminance of the dominant brightness.
// Writes into `img` (full-page RGBA); returns { filled, total } tile counts.
export function flatFillMasked(img, pageW, entries, minInlier = 0.85, TILE = 32, MARGIN = 12) {
  let filled = 0, total = 0;
  const lumAt = (o) => 0.299 * img[o] + 0.587 * img[o + 1] + 0.114 * img[o + 2];
  for (const e of entries) {
    const { mask, w, h } = e;
    const [cx1, cy1] = e.bounds;
    if (!(w > 0 && h > 0)) continue;
    // Display lettering sits on a sky/halo gradient, not plain paper: tiles there
    // would come out as visible patches, so those stay with the LaMa result.
    if (e.block && Array.isArray(e.block.src_bands) && e.block.src_bands.length) continue;
    const grown = dilate(to01(mask), w, h, 3, 2);   // what gets filled (mask + ~2px)
    for (let ty = 0; ty < h; ty += TILE) {
      for (let tx = 0; tx < w; tx += TILE) {
        const ex = Math.min(w, tx + TILE), ey = Math.min(h, ty + TILE);
        let any = false;
        for (let y = ty; y < ey && !any; y++) for (let x = tx; x < ex; x++) if (grown[y * w + x]) { any = true; break; }
        if (!any) continue;
        total++;
        const wx1 = Math.max(0, tx - MARGIN), wy1 = Math.max(0, ty - MARGIN);
        const wx2 = Math.min(w, ex + MARGIN), wy2 = Math.min(h, ey + MARGIN);
        const hist = new Uint32Array(64);
        let n = 0;
        for (let y = wy1; y < wy2; y++) {
          const row = ((cy1 + y) * pageW + cx1) * 4;
          for (let x = wx1; x < wx2; x++) {
            if (grown[y * w + x]) continue;
            hist[Math.min(63, lumAt(row + x * 4) >> 2)]++; n++;
          }
        }
        if (n < 100) continue;
        let mode = 0;
        for (let b = 1; b < 64; b++) if (hist[b] > hist[mode]) mode = b;
        const center = mode * 4 + 2;
        let inl = 0, sr = 0, sg = 0, sb = 0;
        for (let y = wy1; y < wy2; y++) {
          const row = ((cy1 + y) * pageW + cx1) * 4;
          for (let x = wx1; x < wx2; x++) {
            if (grown[y * w + x]) continue;
            const o = row + x * 4;
            if (Math.abs(lumAt(o) - center) <= 6) { inl++; sr += img[o]; sg += img[o + 1]; sb += img[o + 2]; }
          }
        }
        if (inl / n < minInlier) continue;
        const R = Math.round(sr / inl), G = Math.round(sg / inl), B = Math.round(sb / inl);
        for (let y = ty; y < ey; y++) {
          const row = ((cy1 + y) * pageW + cx1) * 4;
          for (let x = tx; x < ex; x++) {
            if (!grown[y * w + x]) continue;
            const o = row + x * 4;
            img[o] = R; img[o + 1] = G; img[o + 2] = B;
          }
        }
        filled++;
      }
    }
  }
  return { filled, total };
}
