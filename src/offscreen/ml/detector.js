// RT-DETR-v2 bubble/text detector (ogkalu/comic-text-and-bubble-detector,
// Apache License 2.0). Box geometry ported from ogkalu2/comic-translate
// (Apache License 2.0, https://github.com/ogkalu2/comic-translate).
// Verified contract (spike 1):
//   in:  images [1,3,640,640] float32 (/255, RGB), orig_target_sizes int64 [[w,h]]
//   out: labels [1,300], boxes [1,300,4] (original-image coords), scores [1,300]
// Labels: 0 = bubble, 1 = text_bubble, 2 = text_free. NMS-free.
import { resizeBilinearRGBA, toNCHW } from '../../shared/image-ops.js';
import { dedupAndMergeSeams } from '../../shared/textblock.js';

const SIZE = 640;

// Long-strip support: squishing a 413x15402 page into the model's 640x640
// input makes text sub-pixel and undetectable (this is why words "didn't show
// up" on long-strip pages). Images more extreme than STRIP_ASPECT are split
// into overlapping ~2:1 segments along the long axis; each segment is
// detected separately and the boxes are merged back with overlap dedup.
const STRIP_ASPECT = 4;
const SEG_RATIO = 2;    // segment long side = SEG_RATIO x short side
const SEG_OVERLAP = 128; // px overlap between adjacent segments

function cropRGBA(rgba, w, x, y, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let r = 0; r < ch; r++)
    out.set(rgba.subarray(((y + r) * w + x) * 4, ((y + r) * w + x + cw) * 4), r * cw * 4);
  return out;
}

function boxIoU(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter <= 0) return 0;
  const aa = (a[2] - a[0]) * (a[3] - a[1]), bb = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (aa + bb - inter);
}

export class Detector {
  constructor() { this.session = null; }

  async load(modelBytes, executionProviders = ['wasm']) {
    if (this.session) return;
    // Bytes go straight to ORT — no Blob/object-URL round trip. (Blobs were
    // never revoked, leaking every model's bytes for the page's lifetime,
    // and the blob + ORT's blob-fetch doubled the transient peak.)
    const u8 = modelBytes instanceof Uint8Array ? modelBytes : new Uint8Array(modelBytes);
    this.session = await ort.InferenceSession.create(u8, { executionProviders });
  }

  get loaded() { return !!this.session; }

  // Drop the loaded session so the next inference re-reads the model file
  // from IndexedDB (needed after a re-download; otherwise the old bytes stay live).
  // Release frees the session's blocks for reuse (dispose does not exist
  // on sessions in this ORT version — the old dispose call was a no-op).
  // The WASM heap itself never shrinks, so its high-water mark stays
  // until the host reloads. Callers must await reset() before creating
  // a replacement session, or the free races the new load.
  async reset() { try { await this.session?.release?.(); } catch {} this.session = null; }

  // rgba: Uint8ClampedArray, w/h: image dims. Returns [{xyxy:[x1,y1,x2,y2], label, score}]
  async detect(rgba, w, h, threshold = 0.3, opts = {}) {
    const { shouldAbort = null, noStrip = false } = opts;
    // noStrip: the caller (SW detectSliced) already sliced the image; skip
    // the internal strip path so seams aren't merged twice (over-merge risk).
    if (noStrip || Math.max(w, h) / Math.min(w, h) <= STRIP_ASPECT) {
      return this.detectSingle(rgba, w, h, threshold);
    }
    const vertical = h > w;
    const shortSide = Math.min(w, h), longSide = Math.max(w, h);
    const segLen = Math.round(shortSide * SEG_RATIO);
    const step = segLen - SEG_OVERLAP;
    const count = Math.max(1, Math.ceil((longSide - SEG_OVERLAP) / step));
    const all = [];
    for (let i = 0; i < count; i++) {
      // A long strip is many seconds of WASM; bail between segments when
      // the run was cancelled (page changed) instead of burning CPU.
      if (shouldAbort && shouldAbort()) throw new Error('cancelled');
      const o = count === 1 ? 0 : Math.round(i * (longSide - segLen) / (count - 1));
      const n = Math.min(segLen, longSide - o);
      const seg = vertical ? cropRGBA(rgba, w, 0, o, w, n) : cropRGBA(rgba, w, o, 0, n, h);
      const boxes = await this.detectSingle(seg, vertical ? w : n, vertical ? n : h, threshold);
      for (const b of boxes) {
        const [x1, y1, x2, y2] = b.xyxy;
        b.xyxy = vertical ? [x1, y1 + o, x2, y2 + o] : [x1 + o, y1, x2 + o, y2];
        all.push(b);
      }
    }
    // Dedup doubles detected in the overlap zones and merge bubbles split
    // across segment seams (shared helper — also used by the service
    // worker's detectSliced for tall images).
    const seams = [];
    for (let i = 0; i < count - 1; i++) {
      const o = Math.round(i * (longSide - segLen) / (count - 1));
      seams.push(o + Math.min(segLen, longSide - o));
    }
    return dedupAndMergeSeams(all, seams, vertical);
  }

  async detectSingle(rgba, w, h, threshold = 0.3) {
    const resized = resizeBilinearRGBA(rgba, w, h, SIZE, SIZE);
    const nchw = toNCHW(resized, SIZE, SIZE);
    const tImages = new ort.Tensor('float32', nchw, [1, 3, SIZE, SIZE]);
    const tSizes = new ort.Tensor('int64', BigInt64Array.from([BigInt(w), BigInt(h)]), [1, 2]);
    const out = await this.session.run({ images: tImages, orig_target_sizes: tSizes });
    // Tensors hold WASM-heap buffers — undisposed, every run leaks until the
    // page's memory blows up (this was the 10~40-image browser crash).
    tImages.dispose();
    tSizes.dispose();
    const labels = out.labels.data, boxes = out.boxes.data, scores = out.scores.data;
    const kept = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] >= threshold) {
        kept.push({
          xyxy: [boxes[i * 4], boxes[i * 4 + 1], boxes[i * 4 + 2], boxes[i * 4 + 3]],
          label: Number(labels[i]), // int64 -> BigInt without this; breaks === 0 checks
          score: scores[i],
        });
      }
    }
    kept.sort((a, b) => b.score - a.score);
    for (const t of Object.values(out)) t.dispose();
    return kept;
  }
}
