// Inference logic ported from ogkalu2/comic-translate
// (Apache License 2.0, https://github.com/ogkalu2/comic-translate).
// TextBlock: the unit of translation. Port of modules/utils/textblock.py (fields that
// the extension pipeline actually uses). Plain JSON-serializable objects.

export function makeTextBlock(o = {}) {
  return {
    xyxy: o.xyxy || null,           // [x1,y1,x2,y2] text box (float)
    bubble_xyxy: o.bubble_xyxy || null,
    text_class: o.text_class || 'text_free', // 'text_bubble' | 'text_free'
    text: o.text || '',
    translation: o.translation || '',
    source_lang: o.source_lang || 'ja',
    target_lang: o.target_lang || 'en',
    font_color: o.font_color || null, // css color detected from image
    direction: o.direction || 'horizontal', // or 'vertical'
    min_font_size: o.min_font_size || 0,
    max_font_size: o.max_font_size || 0,
    alignment: o.alignment || 'center',
    line_spacing: o.line_spacing || 1,
    render_xyxy: o.render_xyxy || null, // computed render area (stage 7)
    render_font_size: o.render_font_size || 0,
  };
}

export function center(b) {
  const [x1, y1, x2, y2] = b.xyxy;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

// Reading order: top-to-bottom, then right-to-left for vertical/JP text.
export function sortBlocks(blocks, rtl = true) {
  return [...blocks].sort((a, b) => {
    const ca = center(a), cb = center(b);
    const ay = (a.xyxy[0] + a.xyxy[2]) / 2, by = (b.xyxy[0] + b.xyxy[2]) / 2;
    // rough row grouping: same row if y-centers within half of min height
    const ha = a.xyxy[3] - a.xyxy[1], hb = b.xyxy[3] - b.xyxy[1];
    if (Math.abs(ca[1] - cb[1]) < Math.min(ha, hb) * 0.5) {
      return rtl ? cb[0] - ca[0] : ca[0] - cb[0];
    }
    return ca[1] - cb[1];
  });
}

export function shrinkBbox(xyxy, pct) {
  const [x1, y1, x2, y2] = xyxy;
  const w = x2 - x1, h = y2 - y1;
  return [x1 + w * pct, y1 + h * pct, x2 - w * pct, y2 - h * pct];
}

export function clampBox(xyxy, w, h) {
  let [x1, y1, x2, y2] = xyxy;
  x1 = Math.max(0, Math.min(w, x1)); x2 = Math.max(0, Math.min(w, x2));
  y1 = Math.max(0, Math.min(h, y1)); y2 = Math.max(0, Math.min(h, y2));
  return [x1, y1, x2, y2];
}

// adjust_text_line_coordinates port: expand by x%/y% of box size, clamp to image.
export function adjustTextLineCoords(xyxy, expXpct, expYpct, imgW, imgH) {
  const [x1, y1, x2, y2] = xyxy;
  const w = x2 - x1, h = y2 - y1;
  const ex = (w * expXpct) / 100, ey = (h * expYpct) / 100;
  const nx1 = Math.max(0, Math.floor(x1 - ex)), ny1 = Math.max(0, Math.floor(y1 - ey));
  const nx2 = Math.min(imgW, Math.ceil(x2 + ex)), ny2 = Math.min(imgH, Math.ceil(y2 + ey));
  return [nx1, ny1, nx2, ny2];
}

function boxArea(xyxy) {
  return Math.max(0, xyxy[2] - xyxy[0]) * Math.max(0, xyxy[3] - xyxy[1]);
}

export function boxIoU(a, b) {
  const ix1 = Math.max(a[0], b[0]), iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]), iy2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  if (!inter) return 0;
  return inter / (boxArea(a) + boxArea(b) - inter);
}

// Merge overlapping text boxes (port of merge_overlapping_boxes, IoU-based).
export function mergeOverlappingBoxes(boxes, iouThresh = 0.3) {
  const boxesLeft = boxes.map(b => [...b]);
  const merged = [];
  while (boxesLeft.length) {
    const cur = boxesLeft.pop();
    let didMerge = true;
    while (didMerge) {
      didMerge = false;
      for (let i = boxesLeft.length - 1; i >= 0; i--) {
        if (boxIoU(cur, boxesLeft[i]) > iouThresh) {
          const o = boxesLeft.splice(i, 1)[0];
          cur[0] = Math.min(cur[0], o[0]); cur[1] = Math.min(cur[1], o[1]);
          cur[2] = Math.max(cur[2], o[2]); cur[3] = Math.max(cur[3], o[3]);
          didMerge = true;
        }
      }
    }
    merged.push(cur);
  }
  return merged;
}

// Two boxes from a seam-split bubble? Their edges abut at the same seam
// line (within tolerance) on opposite sides, with >50% overlap on the
// perpendicular axis.
export function seamAdjacent(a, b, seams, vertical, tol = 24) {
  const [ax1, ay1, ax2, ay2] = a.xyxy;
  const [bx1, by1, bx2, by2] = b.xyxy;
  for (const s of seams) {
    let touches = false, overlap = 0, minSpan = 1;
    if (vertical) {
      // Horizontal seam at y=s: A above / B below, or vice versa.
      touches = (Math.abs(ay2 - s) < tol && Math.abs(by1 - s) < tol) ||
                (Math.abs(by2 - s) < tol && Math.abs(ay1 - s) < tol);
      overlap = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
      minSpan = Math.min(ax2 - ax1, bx2 - bx1);
    } else {
      // Vertical seam at x=s: A left / B right, or vice versa.
      touches = (Math.abs(ax2 - s) < tol && Math.abs(bx1 - s) < tol) ||
                (Math.abs(bx2 - s) < tol && Math.abs(ax1 - s) < tol);
      overlap = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
      minSpan = Math.min(ay2 - ay1, by2 - by1);
    }
    if (touches && overlap > minSpan * 0.5) return true;
  }
  return false;
}

// Dedup boxes detected in slice/strip overlap zones (keep higher score),
// then merge bubbles split across slice seams. A bubble larger than the
// overlap straddling a seam is detected as two partial boxes (one per
// slice) with ~0 IoU, so plain dedup keeps both — each half would be OCR'd
// and translated separately. `seams` are the slice boundary positions in
// the same coordinate space as the boxes; `vertical` means the slices were
// stacked vertically (seams are horizontal lines at y=s).
export function dedupAndMergeSeams(boxes, seams, vertical) {
  const all = [...boxes].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const b of all) {
    if (kept.some(k => boxIoU(k.xyxy, b.xyxy) >= 0.5)) continue;
    kept.push(b);
  }
  // Containment dedup (same label only): a slice may see a partial bubble
  // while another slice sees the whole bubble. Their IoU is ~0.49 (below the
  // 0.5 line, since the partial is half the full's area), and seamAdjacent
  // fails because the full bubble's edges don't touch the seam — so both
  // survive as duplicates. Drop the smaller box when it's >=80% inside a
  // same-label box. Same-label only: text boxes live inside bubble boxes
  // and must not be dropped.
  const contained = new Set();
  for (let i = 0; i < kept.length; i++) {
    if (contained.has(i)) continue;
    for (let j = 0; j < kept.length; j++) {
      if (i === j || contained.has(j)) continue;
      if (kept[i].label !== kept[j].label) continue;
      const [ax1, ay1, ax2, ay2] = kept[i].xyxy;
      const [bx1, by1, bx2, by2] = kept[j].xyxy;
      const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
      const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
      const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
      const areaI = (ax2 - ax1) * (ay2 - ay1);
      const areaJ = (bx2 - bx1) * (by2 - by1);
      if (areaI > 0 && areaI < areaJ && inter / areaI >= 0.8) { contained.add(i); break; }
    }
  }
  const deduped = kept.filter((_, i) => !contained.has(i));
  const merged = [];
  const consumed = new Set();
  for (let i = 0; i < deduped.length; i++) {
    if (consumed.has(i)) continue;
    let cur = deduped[i];
    for (let j = i + 1; j < deduped.length; j++) {
      if (consumed.has(j)) continue;
      if (seamAdjacent(cur, deduped[j], seams, vertical)) {
        const [ax1, ay1, ax2, ay2] = cur.xyxy;
        const [bx1, by1, bx2, by2] = deduped[j].xyxy;
        cur = {
          xyxy: [Math.min(ax1, bx1), Math.min(ay1, by1), Math.max(ax2, bx2), Math.max(ay2, by2)],
          label: cur.label,
          score: Math.max(cur.score, deduped[j].score),
        };
        consumed.add(j);
      }
    }
    merged.push(cur);
  }
  merged.sort((a, b) => b.score - a.score);
  return merged;
}

// ---- Inpaint tiling + cost model (2.0.14) ---------------------------------
// Tiling moved here from offscreen/ml/inpaint.js so the service worker
// (which merges patches before any ML runs) and the ML host share one
// tiling. TILE_MAX is 512, not 1024: a tile's WASM run is synchronous,
// and on Firefox it blocks the main thread — while it runs, no timer can
// fire and no progress updates, so a slow 1024 tile looked like a silent
// hang. That cap is for WASM only. A WebGPU run is async, so the handler
// passes tileMax 1024 when the provider is webgpu (2.0.10).
export const TILE_MAX = 512;
export const TILE_OVERLAP = 128;

// Tile origins/sizes covering [0, len): first tile starts at 0, last ends at
// len, neighbours overlap by >= TILE_OVERLAP, no tile exceeds tileMax.
export function tileOrigins(len, tileMax = TILE_MAX) {
  if (len <= tileMax) return [{ o: 0, n: len }];
  const step = tileMax - TILE_OVERLAP;
  const count = Math.ceil((len - TILE_OVERLAP) / step);
  const tiles = [];
  for (let i = 0; i < count; i++) {
    const o = Math.round(i * (len - tileMax) / (count - 1));
    tiles.push({ o, n: Math.min(tileMax, len - o) });
  }
  return tiles;
}

// Cost model for one LaMa tile run, fitted from James's runs on the
// standard test page (2.0.9/2.0.10): time(tile) = fixedMs + perPxMs * area.
// The fixed part is per-run overhead (copy tile+mask to the GPU, set the
// run up, copy the result back) — not model warm-up, which happens once.
// perPxMs rises with tile size (big tiles cost more per pixel than small
// ones: 0.0022 at <=100k px, 0.0029 at ~700k px on GPU), so the merge
// below charges the union at perPxMs * SPREAD. The spread is the measured
// GPU ratio, big-tile k / small-tile k (0.002855/0.002189 = 1.304).
//   gpu:   Chrome WebGPU, tileMax 1024. Fitted from 4 points (3 one-tile
//          patches + the 8-tile big patch at 512); fits within ~5%.
//   wasm:  Chrome WASM, 10 threads, tileMax 512. Fitted from the 2.0.11
//          GPU-hang fallback run (patch 1 20,888ms + the other 3 patches
//          2,700ms). Two points only — rough.
//   wasm1: Firefox WASM, 1 thread, tileMax 512. Fixed cost taken from the
//          Chrome WASM fit; per-pixel cost solved from the ~80s Firefox
//          inpaint total on the same page (11 tiles, 2,266,187 computed
//          px). Very rough — but the direction (much slower per pixel
//          than 10-thread WASM) is certain.
export const INPAINT_COST = {
  gpu: { fixedMs: 123, perPxMs: 0.002189 },
  wasm: { fixedMs: 432, perPxMs: 0.008314 },
  wasm1: { fixedMs: 432, perPxMs: 0.0332 },
};
export const INPAINT_COST_SPREAD = 1.3;

// Predicted ms for one patch (w x h) at the given tile size: sum over its
// tiles of (fixedMs + perPxMs * tile area). Same tiling the pipeline uses.
export function patchCostMs(w, h, tileMax, fixedMs, perPxMs) {
  const xs = tileOrigins(w, tileMax), ys = tileOrigins(h, tileMax);
  let ms = 0;
  for (const x of xs) for (const y of ys) ms += fixedMs + perPxMs * x.n * y.n;
  return ms;
}

// Cost-based merge (2.0.14, replaces mergePaddedBoxes): merge two boxes
// only when the merged patch is predicted cheaper than the two apart.
// Greedy: repeatedly merge the pair with the largest saving, stop when no
// pair saves. The split cost uses perPxMs; the union cost uses
// perPxMs * spread, so a merge must win even charged at the worst observed
// per-pixel rate — when the model is unsure, boxes stay separate. That is
// the never-worse rule: close/overlapping boxes merge (the union adds
// almost no area, so the saved fixed cost wins); distant boxes never do
// (the gap area costs more than the saved fixed cost). No distance number,
// no tuned threshold — the threshold comes from the cost model.
// Returns { boxes: [[x1,y1,x2,y2], ...], predictedMs } (predictedMs is the
// sum of patchCostMs at perPxMs for the final boxes).
export function mergeBoxesByCost(entries, { tileMax, fixedMs, perPxMs, spread = INPAINT_COST_SPREAD }) {
  const boxes = entries.map((e) => e.bounds.slice());
  const cost = (b, k) => patchCostMs(b[2] - b[0], b[3] - b[1], tileMax, fixedMs, k);
  let changed = true;
  while (changed && boxes.length > 1) {
    changed = false;
    let bestI = -1, bestJ = -1, bestSaving = 0;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const u = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
        const saving = cost(a, perPxMs) + cost(b, perPxMs) - cost(u, perPxMs * spread);
        if (saving > bestSaving) { bestSaving = saving; bestI = i; bestJ = j; }
      }
    }
    if (bestI >= 0) {
      const a = boxes[bestI], b = boxes[bestJ];
      boxes[bestI] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
      boxes.splice(bestJ, 1);
      changed = true;
    }
  }
  let predictedMs = 0;
  for (const b of boxes) predictedMs += cost(b, perPxMs);
  return { boxes, predictedMs };
}
