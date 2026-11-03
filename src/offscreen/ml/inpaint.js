// Inference logic ported from ogkalu2/comic-translate
// (Apache License 2.0, https://github.com/ogkalu2/comic-translate).
// LaMa-based manga inpainting. Verified contract (spike 3):
//   in:  image [1,3,h,w] float32 (/255 RGB), mask [1,1,h,w] float32 (0/1)
//   out: inpainted [1,3,h,w] float32
// Patch dims must be multiples of 8. All graph ops are WASM-safe
// (FFC is compiled to Cos/Sin/MatMul; no DFT op in the graph).
import { toNCHW, padToMod, resizeBilinearRGBA } from '../../shared/image-ops.js';

// Tiled inpainting: LaMa's peak WASM memory scales with patch area, and a
// dense page can merge its text boxes into one huge patch. On Firefox the
// sessions run in-process in the background page, so a big enough patch
// aborts the run with a wasm out-of-memory (Chrome's offscreen process has
// more headroom but the same math applies). Patches larger than TILE_MAX on
// a side are therefore processed as overlapping full-resolution tiles and
// feather-blended back together: peak memory stays bounded by one tile while
// the output stays full-resolution — no quality loss from downscaling.
// TILE_MAX is 512, not 1024: a tile's WASM run is synchronous, and on
// Firefox it blocks the main thread — while it runs, no timer can fire and
// no progress updates, so a slow 1024 tile looked like a silent hang. At
// 512 each tile costs about a quarter of the time, so the 90s timeout and
// per-tile progress get chances to fire between tiles.
export const TILE_MAX = 512;
const TILE_OVERLAP = 128;

// Tile origins/sizes covering [0, len): first tile starts at 0, last ends at
// len, neighbours overlap by >= TILE_OVERLAP, no tile exceeds TILE_MAX.
export function tileOrigins(len) {
  if (len <= TILE_MAX) return [{ o: 0, n: len }];
  const step = TILE_MAX - TILE_OVERLAP;
  const count = Math.ceil((len - TILE_OVERLAP) / step);
  const tiles = [];
  for (let i = 0; i < count; i++) {
    const o = Math.round(i * (len - TILE_MAX) / (count - 1));
    tiles.push({ o, n: Math.min(TILE_MAX, len - o) });
  }
  return tiles;
}

function cropRGBA(rgba, w, x, y, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let r = 0; r < ch; r++)
    out.set(rgba.subarray(((y + r) * w + x) * 4, ((y + r) * w + x + cw) * 4), r * cw * 4);
  return out;
}

function cropMask(mask01, w, x, y, cw, ch) {
  const out = new Uint8Array(cw * ch);
  for (let r = 0; r < ch; r++)
    out.set(mask01.subarray((y + r) * w + x, (y + r) * w + x + cw), r * cw);
  return out;
}

// Downscale a 0/1 mask by taking the MAX over each source block: if any
// source pixel is masked, the dest pixel is masked. Shrinking the mask
// (e.g. bilinear + threshold) could leave text remnants un-inpainted.
function downscaleMaskMax(mask01, w, h, sw, sh) {
  const out = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    const y0 = Math.floor(y * h / sh), y1 = Math.max(y0 + 1, Math.min(h, Math.floor((y + 1) * h / sh)));
    for (let x = 0; x < sw; x++) {
      const x0 = Math.floor(x * w / sw), x1 = Math.max(x0 + 1, Math.min(w, Math.floor((x + 1) * w / sw)));
      let m = 0;
      for (let sy = y0; sy < y1 && !m; sy++)
        for (let sx = x0; sx < x1; sx++) if (mask01[sy * w + sx]) { m = 1; break; }
      out[y * sw + x] = m;
    }
  }
  return out;
}

export class Inpainter {
  constructor() { this.session = null; }

  async load(modelBytes, executionProviders = ['wasm']) {
    if (this.session) return;
    // Bytes go straight to ORT — no Blob/object-URL round trip (see detector.js).
    const u8 = modelBytes instanceof Uint8Array ? modelBytes : new Uint8Array(modelBytes);
    this.session = await ort.InferenceSession.create(u8, { executionProviders });
  }

  get loaded() { return !!this.session; }

  // Drop the loaded session so the next inference re-reads the model file
  // from IndexedDB (needed after a re-download; otherwise old bytes stay live).
  // Best-effort WASM free (see detector.js) — no public session dispose in
  // this vendored ort; buffers persist until host reload. Avoid reset() churn.
  reset() { try { this.session?.dispose?.(); } catch {} this.session = null; }

  // rgba: Uint8ClampedArray RGBA, mask01: Uint8Array 0/1 (same w/h).
  // Returns RGBA Uint8ClampedArray of the inpainted patch. Oversized patches
  // are tiled (see above); isCancelled is an optional () => bool checked
  // between tiles, onProgress an optional (done, total) => void called per
  // tile so long inpaints stay visible instead of looking stalled.
  async inpaintPatch(rgba, mask01, w, h, isCancelled, onProgress) {
    // Large patches dominate inpaint time (many tiled LaMa runs at full
    // resolution). Run them at half resolution and upscale: LaMa work
    // scales with area, so this cuts large-patch time roughly 4-6x. The
    // inpainted background sits behind translated text, so the softening
    // from the round-trip is barely visible. Small patches (a single run)
    // stay full-resolution — already fast, best quality.
    if (Math.max(w, h) > TILE_MAX) {
      const sw = Math.max(1, Math.round(w / 2)), sh = Math.max(1, Math.round(h / 2));
      const smallRGBA = resizeBilinearRGBA(rgba, w, h, sw, sh);
      const smallMask = downscaleMaskMax(mask01, w, h, sw, sh);
      const smallOut = (sw <= TILE_MAX && sh <= TILE_MAX)
        ? await this.inpaintPatchSingle(smallRGBA, smallMask, sw, sh)
        : await this.inpaintPatchTiled(smallRGBA, smallMask, sw, sh, isCancelled, onProgress);
      return resizeBilinearRGBA(smallOut, sw, sh, w, h);
    }
    if (w <= TILE_MAX && h <= TILE_MAX) return this.inpaintPatchSingle(rgba, mask01, w, h);
    return this.inpaintPatchTiled(rgba, mask01, w, h, isCancelled, onProgress);
  }

  // One LaMa run on a patch that fits in TILE_MAX. Unchanged port logic.
  async inpaintPatchSingle(rgba, mask01, w, h) {
    const p = padToMod(rgba, w, h, 8);
    const mw = p.w, mh = p.h;
    const imgNCHW = toNCHW(p.data, mw, mh);
    const maskNCHW = new Float32Array(mw * mh);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) maskNCHW[y * mw + x] = mask01[y * w + x] ? 1 : 0;

    const tImg = new ort.Tensor('float32', imgNCHW, [1, 3, mh, mw]);
    const tMask = new ort.Tensor('float32', maskNCHW, [1, 1, mh, mw]);
    // Tensors hold WASM-heap buffers — dispose every run's inputs/outputs or
    // the leak accumulates per tile until the browser crashes (see detector.js).
    // try/finally: a throwing run() must not leak the inputs.
    let d;
    try {
      const out = await this.session.run({ image: tImg, mask: tMask });
      try {
        d = out.inpainted.data.slice();
      } finally {
        out.inpainted.dispose();
      }
    } finally {
      tImg.dispose();
      tMask.dispose();
    }
    const res = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        res[o] = Math.max(0, Math.min(255, d[y * mw + x] * 255));
        res[o + 1] = Math.max(0, Math.min(255, d[mw * mh + y * mw + x] * 255));
        res[o + 2] = Math.max(0, Math.min(255, d[2 * mw * mh + y * mw + x] * 255));
        res[o + 3] = 255;
      }
    }
    return res;
  }

  // Full-resolution tiled inpaint for patches larger than TILE_MAX.
  // Tiles overlap by >= TILE_OVERLAP and are combined with an online
  // weighted average: each tile's weight ramps linearly 0 -> 1 over the
  // overlap zone at its interior edges, so seams crossfade instead of
  // cutting. Only one tile's LaMa run is live at a time, bounding peak
  // WASM memory; out/wsum are plain JS arrays.
  async inpaintPatchTiled(rgba, mask01, w, h, isCancelled, onProgress) {
    const xs = tileOrigins(w), ys = tileOrigins(h);
    const total = xs.length * ys.length;
    let done = 0;
    const out = new Uint8ClampedArray(w * h * 4);
    const wsum = new Float32Array(w * h);
    for (const { o: tx, n: tw } of xs) {
      const leftIn = tx > 0, rightIn = tx + tw < w;
      for (const { o: ty, n: th } of ys) {
        if (isCancelled && isCancelled()) throw new Error('cancelled');
        const topIn = ty > 0, botIn = ty + th < h;
        const tileOut = await this.inpaintPatchSingle(
          cropRGBA(rgba, w, tx, ty, tw, th), cropMask(mask01, w, tx, ty, tw, th), tw, th);
        for (let ly = 0; ly < th; ly++) {
          let wy = 1;
          if (topIn && ly < TILE_OVERLAP) wy = Math.min(wy, ly / TILE_OVERLAP);
          if (botIn && ly > th - 1 - TILE_OVERLAP) wy = Math.min(wy, (th - 1 - ly) / TILE_OVERLAP);
          const gy = ty + ly;
          for (let lx = 0; lx < tw; lx++) {
            let wx = 1;
            if (leftIn && lx < TILE_OVERLAP) wx = Math.min(wx, lx / TILE_OVERLAP);
            if (rightIn && lx > tw - 1 - TILE_OVERLAP) wx = Math.min(wx, (tw - 1 - lx) / TILE_OVERLAP);
            const wt = Math.max(wx * wy, 1e-3);
            // (was: if (wt <= 0) continue — that could leave wsum[gi] = 0 for
            // edge pixels no tile claims, producing black dots. Clamping to a
            // tiny weight keeps the feather smooth and guarantees coverage.)
            const gi = gy * w + tx + lx, go = gi * 4, to = (ly * tw + lx) * 4;
            const ws = wsum[gi], wn = ws + wt;
            const k1 = ws / wn, k2 = wt / wn;
            out[go] = out[go] * k1 + tileOut[to] * k2;
            out[go + 1] = out[go + 1] * k1 + tileOut[to + 1] * k2;
            out[go + 2] = out[go + 2] * k1 + tileOut[to + 2] * k2;
            out[go + 3] = 255;
            wsum[gi] = wn;
          }
        }
        done++;
        if (onProgress) { try { onProgress(done, total); } catch { /* progress must never break inpaint */ } }
      }
    }
    return out;
  }
}
