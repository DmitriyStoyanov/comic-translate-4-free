// Content script: final render overlay + debug inspector panel.
// Injected on demand by the service worker when a run finishes a stage.
// Classic script (no modules) — everything lives in this file.
(function () {
  if (window.__ctContentLoaded) return;
  window.__ctContentLoaded = true;

  const FONT_STACK = '"Noto Sans CJK JP","Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans",sans-serif';

  // Browser canvas size guards (mirrors src/shared/image-ops.js renderScale —
  // this is a classic script, no modules, so the constants are duplicated).
  // Chrome ~16384px side, Firefox ~11180, Safari ~4096-8192.
  const MAX_RENDER_MP = 16;
  const MAX_RENDER_SIDE = 8192;
  function renderScale(w, h) {
    if (!(w > 0 && h > 0)) return 1;
    return Math.min(1,
      Math.sqrt(MAX_RENDER_MP * 1e6 / (w * h)),
      MAX_RENDER_SIDE / Math.max(w, h));
  }

  // ------------------------------------------------------------ text utils
  // Port of ogkalu2/comic-translate's shrink_bbox (Apache License 2.0,
  // https://github.com/ogkalu2/comic-translate): `pct` is the TOTAL shrink, applied
  // centered, i.e. pct/2 inset per side. shrink_bbox(b, 0.3) leaves 70% of
  // the bubble's width/height (15% per side), NOT 40% (30% per side).
  function shrinkBbox(xyxy, pct) {
    const [x1, y1, x2, y2] = xyxy;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const w = (x2 - x1) * (1 - pct), h = (y2 - y1) * (1 - pct);
    if (w <= 0 || h <= 0) return [x1, y1, x2, y2];
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  }

  // Port of get_best_render_area + adjust_blks_size: bubble interior (ogkalu2's
  // shrink_bbox with 0.3 = 30% total shrink, i.e. 15% inset per side), else
  // the text box; -5px each side except zh source.
  function renderAreaFor(block, srcLang) {
    let area = (block.text_class === 'text_bubble' && block.bubble_xyxy)
      ? shrinkBbox(block.bubble_xyxy, 0.3)
      : block.xyxy.slice();
    // 5px inset was for Latin source text (to avoid bubble outlines).
    // Don't apply it to CJK sources — vertical CJK in small bubbles
    // gets over-shrunk (e.g. 44px bubble -> 20px render width).
    const isCjkSrc = ['ja', 'zh-CN', 'zh-TW', 'ko'].includes(srcLang);
    if (!isCjkSrc) {
      area = [area[0] + 5, area[1] + 5, area[2] - 5, area[3] - 5];
    }
    return area;
  }

  const isCJK = s => /[\u3040-\u30ff\u4e00-\u9faf\uac00-\ud7af]/.test(s);

  function wrapGreedy(ctx, text, maxW) {
    // word wrap for spaced text, char wrap for CJK / long words
    const words = text.split(/(\s+)/).filter(t => t.length);
    const lines = [];
    let cur = '';
    const push = () => { if (cur) lines.push(cur); cur = ''; };
    for (const w of words) {
      if (/^\s+$/.test(w)) { cur += w; continue; }
      const trial = cur + w;
      if (ctx.measureText(trial).width <= maxW || !cur.trim()) {
        if (ctx.measureText(trial).width <= maxW) { cur = trial; continue; }
        // single word too long: char-break it
        push();
        let cw = '';
        for (const ch of w) {
          if (ctx.measureText(cw + ch).width > maxW && cw) { lines.push(cw); cw = ''; }
          cw += ch;
        }
        cur = cw;
      } else {
        push();
        cur = w;
      }
    }
    push();
    // CJK: also break lines that are still too wide, char by char
    const out = [];
    for (const line of lines) {
      if (ctx.measureText(line).width <= maxW || !isCJK(line)) { out.push(line); continue; }
      let cw = '';
      for (const ch of line) {
        if (ctx.measureText(cw + ch).width > maxW && cw) { out.push(cw); cw = ''; }
        cw += ch;
      }
      if (cw) out.push(cw);
    }
    return out.filter(l => l.length);
  }

  // Largest font size in [minSize, initSize] whose wrapped text fits.
  // Binary search (~7 iterations) replaces the old 0.75px linear scan (~40
  // iterations, each doing a full wrap + measure pass). "Fits" is monotonic
  // in size, so the search converges to the largest fitting size.
  function fitFont(ctx, text, rw, rh, initSize, minSize, vertical) {
    // Early exit: degenerate box — skip the binary search entirely.
    if (!(rw > 0 && rh > 0)) {
      const size = minSize;
      ctx.font = `${size}px ${FONT_STACK}`;
      return vertical
        ? { size, lines: wrapVertical(text, 1), lh: size * 1.18 }
        : { size, lines: [text], lh: size * 1.18 };
    }
    const fits = (size) => {
      // Cache the font string per size probe — wrapGreedy/wrapVertical call
      // measureText many times but the font only changes here.
      ctx.font = `${size}px ${FONT_STACK}`;
      const lh = size * 1.18;
      if (vertical) {
        // charsPerCol must be >= 1: rh < lh (tiny box) would give 0 and hang
        // wrapVertical forever on `i += 0`.
        const cols = wrapVertical(text, Math.max(1, Math.floor(rh / lh)));
        return { ok: cols.length * (size * 1.05) <= rw, lines: cols, lh };
      }
      const lines = wrapGreedy(ctx, text, rw);
      const maxW = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
      return { ok: lines.length * lh <= rh && maxW <= rw, lines, lh };
    };
    let best = null;
    let lo = minSize, hi = initSize;
    // 10 iterations: 0.5px precision is enough (16 was overkill — each
    // iteration re-wraps and re-measures every line).
    for (let i = 0; i < 10 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2;
      const r = fits(mid);
      if (r.ok) { best = { size: mid, lines: r.lines, lh: r.lh }; lo = mid; }
      else hi = mid;
    }
    if (!best) {
      const size = minSize;
      ctx.font = `${size}px ${FONT_STACK}`;
      best = vertical
        ? { size, lines: wrapVertical(text, Math.max(1, Math.floor(rh / (size * 1.18)))), lh: size * 1.18 }
        : { size, lines: wrapGreedy(ctx, text, rw), lh: size * 1.18 };
    }
    return best;
  }

  function wrapVertical(text, charsPerCol) {
    const clean = text.replace(/\s+/g, '');
    const cols = [];
    for (let i = 0; i < clean.length; i += charsPerCol) cols.push(clean.slice(i, i + charsPerCol));
    return cols.length ? cols : [''];
  }

  function luminance(css) {
    const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(css || '');
    if (!m) return 0;
    return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
  }

  // Auto font size from the ORIGINAL text: estimate the glyph size the source
  // text was set in from its detector text box and character count (area
  // model: each glyph occupies ~size^2 * lineHeight). The render starts
  // from 1.2x this size (capped by the maximum, floored by the minimum)
  // and only shrinks until the translation fits the area.
  function estimateFontSize(block, maxSize, minSize) {
    const text = (block.text || '').replace(/\s+/g, '');
    const n = Math.max(1, [...text].length);
    const xy = block.xyxy || [0, 0, 0, 0];
    const w = Math.max(1, xy[2] - xy[0]), h = Math.max(1, xy[3] - xy[1]);
    let est = Math.sqrt((w * h) / (n * 1.18));
    if (!isFinite(est) || est <= 0) est = maxSize;
    return Math.min(maxSize, Math.max(minSize, est));
  }

  function drawBlock(ctx, block, srcLang, maxSize, minSize) {
    const text = (block.translation || block.text || '').trim();
    if (!text) return null;
    const area = renderAreaFor(block, srcLang);
    const [x1, y1, x2, y2] = area;
    const rw = Math.max(8, x2 - x1), rh = Math.max(8, y2 - y1);
    const vertical = isCJK(text) && rh > rw * 1.5;
    const autoSize = estimateFontSize(block, maxSize, minSize);
    // Start from 1.2x the estimated original size (not maxSize): the estimate
    // is approximate (box area + char count), so 1.2x gives headroom to reach
    // the original size. fitFont then shrinks until it fits the box.
    // Capped by maxSize, floored by minSize — "not too big nor too small".
    const startSize = Math.min(maxSize, Math.max(minSize, autoSize * 1.2));
    const { size, lines, lh } = fitFont(ctx, text, rw, rh, startSize, minSize, vertical);
    ctx.font = `${size}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fg = block.font_color || '#000000';
    const outline = luminance(fg) > 0.5 ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, size / 7);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.fillStyle = fg;
    // Hard guarantee: wrapped text stays inside the render area even when the
    // translation cannot fit at the minimum font size. The fit loop above
    // shrinks until it fits; this clip only bites in the fallback case.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x1, y1, rw, rh);
    ctx.clip();
    if (vertical) {
      const colW = size * 1.05;
      const totalW = lines.length * colW;
      const startX = (x1 + x2) / 2 + totalW / 2 - colW / 2;
      lines.forEach((col, ci) => {
        const x = startX - ci * colW;
        const chars = [...col];
        const totalH = chars.length * lh;
        let y = y1 + (rh - totalH) / 2 + lh / 2;
        for (const ch of chars) {
          ctx.strokeText(ch, x, y);
          ctx.fillText(ch, x, y);
          y += lh;
        }
      });
    } else {
      const cx = (x1 + x2) / 2;
      const totalH = lines.length * lh;
      let y = y1 + (rh - totalH) / 2 + lh / 2;
      for (const line of lines) {
        ctx.strokeText(line, cx, y);
        ctx.fillText(line, cx, y);
        y += lh;
      }
    }
    ctx.restore();
    return { render_xyxy: area.map(v => Math.round(v)), render_font_size: Math.round(size * 10) / 10, auto_font_size: Math.round(autoSize * 10) / 10, vertical };
  }

  // ------------------------------------------------------------ main image
  // The page's own picture: largest fully-loaded <img> on the page.
  let mainImgEl = null;

  // Collect <img> elements from light DOM and shadow DOMs (some readers
  // render pages inside shadow roots; document.images misses those).
  // The shadow-root scan is cached per "image run" (see _imgScanCache) —
  // querySelectorAll('*') on every find is slow on large pages.
  let _imgScanCache = null;
  function invalidateImageCache() { _imgScanCache = null; }

  function collectShadowImages(root, depth, out) {
    if (depth > 3) return;
    let els;
    try { els = root.querySelectorAll('*'); } catch { return; }
    for (const el of els) {
      let sr = null;
      try { sr = el.shadowRoot; } catch { continue; }
      if (sr) {
        try { out.push(...sr.querySelectorAll('img')); } catch { /* best-effort */ }
        collectShadowImages(sr, depth + 1, out);
      }
    }
  }

  function allImages() {
    if (_imgScanCache) return _imgScanCache;
    const out = [...document.images];
    try {
      collectShadowImages(document, 0, out);
    } catch { /* shadow scan is best-effort */ }
    _imgScanCache = out;
    return out;
  }

  // Placeholder test matches only the path/filename — never the query
  // string (a legit URL like /img.png?placeholder=0 is not a placeholder).
  function isPlaceholderUrl(url) {
    const path = String(url || '').split(/[?#]/)[0];
    return /placeholder|blank|1x1|spacer/i.test(path);
  }

  // Lazy-load fallback: if the <img> src is a placeholder, try data-src /
  // data-original / data-lazy-src for the real URL. Falls back to `cur`
  // (even a placeholder) when no data-src is present — better than ''.
  function realSrc(im) {
    const cur = im.currentSrc || im.src || '';
    if (cur && !isPlaceholderUrl(cur)) return cur;
    return im.dataset.src || im.dataset.original || im.dataset.lazySrc ||
           im.getAttribute('data-src') || im.getAttribute('data-original') || cur;
  }

  function findMainImage() {
    const imgs = allImages().filter(im => {
      if (!im.isConnected || !im.complete || !im.naturalWidth) return false;
      const r = im.getBoundingClientRect();
      return r.width >= 120 && r.height >= 120;
    });
    if (!imgs.length) { mainImgEl = null; return null; }
    imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
    const im = imgs[0];
    mainImgEl = im;
    const cur = realSrc(im);
    // Already translated in place: the <img> now shows our rendered data URL
    // (the real url was kept in dataset.ctOriginal). Report the ORIGINAL url:
    // a multi-MB data URL in this message can break tabs.sendMessage (the
    // worker then reports "no picture found"), and the worker must download
    // the original — page-canvas pixels would be the already-translated
    // image, which would translate the translation and poison the page-cache
    // key so revisits never hit the cache.
    const wasTranslated = !!im.dataset.ctOriginal && /^data:/i.test(cur);
    return {
      src: wasTranslated ? im.dataset.ctOriginal : cur,
      w: im.naturalWidth, h: im.naturalHeight,
      translated: wasTranslated,
    };
  }

  // The image the user right-clicked ("Send to comic-translate-4-free"): match
  // by live src, by the translated data URL now shown, or by the stashed
  // original (re-send of an already-translated image). No size filter — the
  // manual send bypasses the minimum image size on purpose.
  function findImageBySrc(srcUrl) {
    if (!srcUrl) return null;
    const im = allImages().find(im => {
      if (!im.isConnected || !im.complete || !im.naturalWidth) return false;
      const cur = realSrc(im);
      return cur === srcUrl || im.dataset.ctOriginal === srcUrl;
    });
    if (!im) return null;
    const cur = realSrc(im);
    const wasTranslated = !!im.dataset.ctOriginal && /^data:/i.test(cur);
    return {
      src: wasTranslated ? im.dataset.ctOriginal : cur,
      w: im.naturalWidth, h: im.naturalHeight,
      translated: wasTranslated,
    };
  }

  // Direct pixels via page canvas. With srcUrl, captures that specific image
  // (the manual-send path); otherwise the main image. Throws (tainted
  // canvas) when the image host sends no CORS headers — the worker then
  // tries a direct fetch.
  async function mainImagePixels(srcUrl) {
    let im = null;
    if (srcUrl) {
      im = allImages().find(im => {
        if (!im.isConnected || !im.complete || !im.naturalWidth) return false;
        const cur = im.currentSrc || im.src || '';
        return cur === srcUrl || im.dataset.ctOriginal === srcUrl;
      });
    } else {
      im = mainImgEl && mainImgEl.isConnected ? mainImgEl : null;
    }
    if (!im) throw new Error(srcUrl ? 'image not found on page' : 'no main image');
    // Canvas guard: natural size can exceed browser limits (e.g. 2000x15000).
    // Downscale to fit — the pipeline downscales to 6.5MP anyway.
    const s = renderScale(im.naturalWidth, im.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s));
    c.height = Math.max(1, Math.round(im.naturalHeight * s));
    const cx = c.getContext('2d');
    cx.drawImage(im, 0, 0, c.width, c.height);
    // NOTE: raw pixel buffers CANNOT travel via extension messaging — Chrome
    // silently turns ArrayBuffers into {} in both directions (verified). So
    // the pixels go as a WebP data URL string, the same trick the render path
    // uses for the translated image. Throws (tainted canvas) when the image
    // host sends no CORS headers — the pipeline then tries a direct fetch.
    // Async blob encode (not toDataURL): toDataURL is fully synchronous and
    // freezes the page for 1-3s on multi-MP images. Note: HTMLCanvasElement
    // has toBlob (callback), not convertToBlob (that's OffscreenCanvas only).
    const blob = await new Promise((resolve, reject) =>
      c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/webp', 0.95));
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, w: c.width, h: c.height };
  }

  function replaceMainImage(dataUrl) {
    let im = mainImgEl && mainImgEl.isConnected ? mainImgEl : null;
    // The stored element can go stale over a long pipeline (page re-rendered
    // the <img>); re-find it before giving up.
    if (!im) { findMainImage(); im = mainImgEl && mainImgEl.isConnected ? mainImgEl : null; }
    if (!im) return false;
    // Always refresh the marker: on SPA-reused elements the old marker
    // points at a previous picture. Never overwrite with a data: URL —
    // on a re-render the element shows the old translation, and the
    // existing marker is the true original.
    const cur = im.currentSrc || im.src;
    if (cur && !/^data:/i.test(cur)) im.dataset.ctOriginal = cur;
    im.removeAttribute('srcset');
    im.src = dataUrl;
    return true;
  }

  // In-place replace for the manual-send path: swap the <img> matching
  // srcUrl (live src, shown data URL, or stashed original).
  function replaceImageBySrc(srcUrl, dataUrl) {
    const im = allImages().find(im => {
      if (!im.isConnected) return false;
      const cur = im.currentSrc || im.src || '';
      return cur === srcUrl || im.dataset.ctOriginal === srcUrl;
    });
    if (!im) return false;
    // Always refresh the marker to this render's original (srcUrl): on
    // SPA-reused elements the old marker points at a previous picture.
    // Never overwrite with a data: URL (re-translate after the run-start
    // clear wiped the marker) — any existing marker stays.
    if (srcUrl && !/^data:/i.test(srcUrl)) im.dataset.ctOriginal = srcUrl;
    im.removeAttribute('srcset');
    im.src = dataUrl;
    return true;
  }

  // ------------------------------------------------------------ status pill
  let pill = null, pillTimer = null;
  function ensurePill() {
    if (pill) {
      // The debug overlay shares the pill's max z-index but is appended
      // later, so it paints on top and hides the pill in debug mode.
      // Re-appending the pill moves it after the overlay, so it stays
      // visible even with the panel open.
      if (overlay) document.documentElement.appendChild(pill);
      return pill;
    }
    pill = document.createElement('div');
    pill.id = 'ct-pill';
    pill.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;background:#1c1c22;color:#eee;' +
      'font:13px/1.4 sans-serif;padding:10px 14px;border-radius:10px;border:1px solid #444;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.5);display:none;max-width:340px;white-space:pre-wrap;';
    document.documentElement.appendChild(pill);
    return pill;
  }
  // Mirror of the pill's latest text inside the debug panel, so everything
  // the pill shows is also visible in the panel (plain text only — the
  // pill's buttons must not be duplicated with the same ids).
  function mirrorPillStatus(text) {
    try { if (debugStatus) debugStatus.textContent = text; } catch { /* never break the pill */ }
  }
  function showPill(html, sticky) {
    const p = ensurePill();
    p.innerHTML = html;
    p.style.display = 'block';
    p.style.borderColor = '#444';
    mirrorPillStatus(p.textContent);
    clearTimeout(pillTimer);
    if (!sticky) pillTimer = setTimeout(() => { p.style.display = 'none'; }, 4000);
  }
  function pillAllowLabel(host) {
    try {
      const m = chrome.i18n.getMessage('pill_allow_host', host);
      if (m) return m;
    } catch { /* fall through */ }
    return 'Allow ' + host;
  }
  function pillDeniedLabel() {
    try {
      const m = chrome.i18n.getMessage('pill_grant_denied');
      if (m) return m;
    } catch { /* fall through */ }
    return 'access denied — allow it from the popup';
  }
  function showPillError(text, grant) {
    const p = ensurePill();
    const errLabel = stageLabel('error');
    let html = 'comic-translate-4-free — ' + esc(errLabel) + ': ' + esc(text);
    if (grant && grant.host) {
      html += ' <button id="ct-pill-grant" style="margin-left:8px;padding:4px 10px;border:1px solid #1a73e8;border-radius:6px;' +
        'background:#1a73e8;color:#fff;font:600 12px sans-serif;cursor:pointer">' +
        esc(pillAllowLabel(grant.label || grant.host)) + '</button>';
    }
    html += ' <a href="#" id="ct-pill-x" style="color:#8ab4f8;margin-left:8px">' +
      esc(dismissLabel()) + '</a>';
    p.innerHTML = html;
    p.style.display = 'block';
    p.style.borderColor = '#a33';
    mirrorPillStatus(p.textContent);
    const x = document.getElementById('ct-pill-x');
    if (x) x.onclick = e => { e.preventDefault(); p.style.display = 'none'; };
    const g = document.getElementById('ct-pill-grant');
    if (g) g.onclick = e => {
      e.preventDefault();
      g.disabled = true;
      g.style.opacity = '.6';
      // Classic script (no modules): use the literal message type.
      chrome.runtime.sendMessage({ type: 'ct/grant-image-host', host: grant.host }, r => {
        if (r && r.ok) {
          // Granted — the worker re-runs the pipeline; hide the error.
          p.style.display = 'none';
        } else {
          g.disabled = false;
          g.style.opacity = '';
          g.textContent = pillDeniedLabel();
        }
      });
    };
  }
  // Stage labels come from the shared stage_* i18n keys (also used by the
  // popup), English fallback if a locale is missing one.
  const PILL_STAGE_FALLBACK = {
    capture: 'Capturing', detect: 'Detecting bubbles', blocks: 'Building blocks',
    ocr: 'Reading text', mask: 'Masking', translate: 'Translating',
    inpaint: 'Inpainting', render: 'Rendering',
  };
  function stageLabel(stage) {
    try {
      const m = chrome.i18n.getMessage('stage_' + stage);
      if (m) return m;
    } catch { /* extension contexts without i18n */ }
    return PILL_STAGE_FALLBACK[stage] || stage;
  }
  function dismissLabel() {
    try {
      const m = chrome.i18n.getMessage('pill_dismiss');
      if (m) return m;
    } catch { /* fall through */ }
    return 'dismiss';
  }
  // Generic pill message lookup with English fallback map for new keys.
  const PILL_MSG_FALLBACK = {
    pill_err_page_changed: 'the page image changed before translation finished — reload the page to retry',
    pill_err_render_mode: 'unexpected render mode — reload the page to retry',
  };
  function pillMsg(key) {
    try {
      const m = chrome.i18n.getMessage(key);
      if (m) return m;
    } catch { /* fall through */ }
    return PILL_MSG_FALLBACK[key] || key;
  }
  function pillProgress(stage, progress) {
    // Sticky for the whole run: the old non-sticky call armed a 4s auto-hide
    // on every update, so long stages (inpaint, translate) left the page with
    // no visible progress between updates. done/cancelled still auto-hide;
    // errors stay until dismissed.
    showPill('comic-translate-4-free — ' + esc(stageLabel(stage)) +
      ' ' + Math.round((progress || 0) * 100) + '%', true);
  }

  // ------------------------------------------------------------ completion chime
  // Short synthesized "ding" when a translation finishes. WebAudio only —
  // no audio file to ship. Best-effort: if the browser's autoplay policy
  // keeps the context suspended (no user interaction with the page yet),
  // we stay silent rather than show an error.
  let dingCtx = null;
  async function maybeDing() {
    try {
      const { settings } = await chrome.storage.local.get('settings');
      if (settings && settings.playDing === false) return; // default on
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      dingCtx = dingCtx || new AC();
      if (dingCtx.state === 'suspended') {
        try { await dingCtx.resume(); } catch { /* stay silent */ }
      }
      if (dingCtx.state !== 'running') return;
      const t0 = dingCtx.currentTime;
      for (const [freq, dt] of [[1046.5, 0], [1568.0, 0.14]]) { // C6 -> G6
        const o = dingCtx.createOscillator(), g = dingCtx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0 + dt);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.6);
        o.connect(g);
        g.connect(dingCtx.destination);
        o.start(t0 + dt);
        o.stop(t0 + dt + 0.65);
      }
    } catch { /* sound must never break the page */ }
  }

  // ------------------------------------------------------------ overlay DOM
  let overlay = null, debugPanel = null, debugBody = null, dbgBtn = null, debugStatus = null;  const stageTabs = {};   // stage -> payload
  const stageOrder = ['capture', 'detect', 'blocks', 'ocr', 'mask', 'inpaint', 'translate', 'render', 'diaglog'];
  let currentRunId = null;
  let latestRunId = null;   // run the service worker last started for this tab

  // FIX3: content-script-held keep-alive Port. FIX2's self-connect Port
  // (both ends in the background) did not prevent the background dying
  // mid-run — a third run died at inpaint the same way. A Port whose
  // opener lives in a DIFFERENT context (this tab's content script) is
  // the documented keep-alive: an event page / worker stays alive while
  // it has an open channel to another context, and messages across it
  // count as activity resetting the idle timer (mere open, with no
  // messages, does not reliably reset timers on modern Chromium, and
  // Firefox likewise stays alive while the background "is doing
  // something periodically"). So this port also sends a heartbeat every
  // 20s while a run is active. Held in module scope so it is not GC'd.
  // Page unload disconnects it automatically, which is fine: the run
  // ends on navigation anyway. Best-effort everywhere; never throws.
  let tabKeepAlivePort = null;
  let tabKeepAliveRunId = null;
  let tabKeepAliveTimer = null;
  function openTabKeepAlive(runId) {
    try {
      if (tabKeepAlivePort && tabKeepAliveRunId === runId) return;
      closeTabKeepAlive();
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.connect) return;
      const port = chrome.runtime.connect({ name: 'ct-keepalive-tab' });
      port.onDisconnect.addListener(() => {
        if (tabKeepAlivePort === port) {
          tabKeepAlivePort = null;
          tabKeepAliveRunId = null;
          if (tabKeepAliveTimer) { clearInterval(tabKeepAliveTimer); tabKeepAliveTimer = null; }
        }
      });
      tabKeepAlivePort = port;
      tabKeepAliveRunId = runId;
      // Heartbeat: a silent open port alone does not reliably reset idle
      // timers. One small message every 20s (under the ~30s idle clock)
      // is the activity that keeps the background alive during long runs.
      tabKeepAliveTimer = setInterval(() => {
        try {
          if (tabKeepAlivePort) tabKeepAlivePort.postMessage({ type: 'ct-keepalive-tab', runId: tabKeepAliveRunId });
          else if (tabKeepAliveTimer) { clearInterval(tabKeepAliveTimer); tabKeepAliveTimer = null; }
        } catch { closeTabKeepAlive(); }
      }, 20000);
    } catch { closeTabKeepAlive(); }
  }
  function closeTabKeepAlive(runId) {
    try {
      if (runId && tabKeepAliveRunId && tabKeepAliveRunId !== runId) return;
      if (tabKeepAliveTimer) { clearInterval(tabKeepAliveTimer); tabKeepAliveTimer = null; }
      if (tabKeepAlivePort) { try { tabKeepAlivePort.disconnect(); } catch {} }
    } catch {}
    tabKeepAlivePort = null;
    tabKeepAliveRunId = null;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'ct-overlay';
    // Debug UI floats over the page WITHOUT dimming it: the backdrop is
    // transparent and click-through, so the original picture stays fully
    // visible (and the page stays usable) while stages are inspected.
    // pointer-events are re-enabled on the bar and the debug panel only.
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:transparent;pointer-events:none;display:none;flex-direction:column;align-items:flex-end;justify-content:flex-start;';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;padding:8px;align-items:center;color:#eee;font:13px sans-serif;pointer-events:auto;background:rgba(10,10,12,0.85);border-radius:0 0 0 8px;';
    const mkBtn = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'padding:6px 12px;border:1px solid #555;border-radius:6px;background:#222;color:#eee;cursor:pointer;font:13px sans-serif;';
      b.onclick = fn;
      return b;
    };
    const title = document.createElement('span');
    title.textContent = 'comic-translate-4-free';
    title.style.cssText = 'font-weight:600;margin-right:8px;';
    bar.appendChild(title);
    const dbgBtnEl = mkBtn('Debug: off', () => {
      const on = debugPanel.style.display === 'none';
      debugPanel.style.display = on ? 'flex' : 'none';
      dbgBtnEl.textContent = on ? 'Debug: on' : 'Debug: off';
    });
    dbgBtn = dbgBtnEl;
    bar.appendChild(dbgBtn);
    bar.appendChild(mkBtn('✕ Close', closeOverlay));
    overlay.appendChild(bar);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;display:flex;min-height:0;width:100%;justify-content:flex-end;';
    debugPanel = document.createElement('div');
    debugPanel.style.cssText = 'display:none;pointer-events:auto;width:340px;max-height:calc(100vh - 60px);overflow:auto;background:rgba(18,18,24,0.96);color:#ddd;font:12px sans-serif;border-left:1px solid #333;flex-direction:column;';
    // Status line mirroring the pill (first child, so it is visible when
    // the panel opens). Initialized from the pill's current text, then kept
    // in sync by showPill/showPillError.
    debugStatus = document.createElement('div');
    debugStatus.style.cssText = 'padding:8px;border-bottom:1px solid #333;color:#eee;white-space:pre-wrap;';
    debugStatus.textContent = pill ? pill.textContent : '';
    debugPanel.appendChild(debugStatus);
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:8px;position:sticky;top:0;background:#16161a;';
    debugPanel.appendChild(tabBar);
    debugBody = document.createElement('div');
    debugBody.style.cssText = 'padding:8px;';
    debugPanel.appendChild(debugBody);
    stageOrder.forEach(st => {
      const b = document.createElement('button');
      b.textContent = st;
      b.style.cssText = 'padding:4px 8px;background:#222;border:1px solid #444;color:#ccc;border-radius:4px;cursor:pointer;font:11px sans-serif;';
      b.onclick = () => renderDebugTab(st);
      tabBar.appendChild(b);
    });
    wrap.appendChild(debugPanel);
    overlay.appendChild(wrap);
    document.documentElement.appendChild(overlay);
  }

  function closeOverlay() {
    if (overlay) overlay.remove();
    overlay = null; debugPanel = null; debugBody = null; debugStatus = null;
    for (const k of Object.keys(stageTabs)) delete stageTabs[k];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function renderDebugTab(stage) {
    const p = stageTabs[stage];
    if (!p) { debugBody.innerHTML = `<p style="color:#888">no data for "${esc(stage)}" yet</p>`; return; }
    let html = `<h3 style="margin:0 0 8px">${esc(p.title || stage)}`;
    if (stage === 'diaglog' && p.log) html += ` <button id="ct-copy-log" style="margin-left:8px;padding:4px 8px;background:#222;border:1px solid #444;color:#ccc;border-radius:4px;cursor:pointer;font:11px sans-serif;vertical-align:middle">Copy</button>`;
    html += `</h3>`;
    if (p.log) html += `<pre style="white-space:pre-wrap;word-break:break-all;color:#ddd;font:11px monospace;max-height:60vh;overflow:auto;border:1px solid #444;padding:8px">${esc(p.log)}</pre>`;
    if (p.totalMs != null) {
      html += `<p style="color:#eee;font-size:14px;margin:0 0 4px">total: <b>${p.totalMs}ms</b>`;
      if (p.seqMs != null && p.seqMs > p.totalMs) {
        html += ` <span style="color:#8f8;font-size:12px">(parallelism saved ${p.seqMs - p.totalMs}ms vs sequential ${p.seqMs}ms)</span>`;
      }
      html += `</p>`;
      if (p.breakdown) html += `<p style="color:#888;margin:0 0 8px">${esc(p.breakdown)}</p>`;
    }
    if (p.ms != null) html += `<p style="color:#888">${p.ms} ms</p>`;
    if (p.error) html += `<p style="color:#f66">${esc(p.error)}</p>`;
    if (p.image) html += `<img src="${p.image}" style="max-width:100%;border:1px solid #444">`;
    if (p.mask) html += `<img src="${p.mask}" style="max-width:100%;border:1px solid #444">`;
    if (p.boxes) {
      html += `<p>${p.boxes.length} boxes (threshold ${esc(p.threshold)})</p>`;
      html += '<table style="width:100%;border-collapse:collapse">' +
        p.boxes.slice(0, 60).map(b =>
          `<tr><td style="border:1px solid #333;padding:2px">${b.label === 0 ? 'bubble' : 'text'}</td>` +
          `<td style="border:1px solid #333;padding:2px">${b.score.toFixed(2)}</td>` +
          `<td style="border:1px solid #333;padding:2px">${b.xyxy.map(v => Math.round(v)).join(',')}</td></tr>`
        ).join('') + '</table>';
      if (p.boxes.length > 60) html += `<p style="color:#888">…and ${p.boxes.length - 60} more</p>`;
    }
    if (p.blocks) {
      html += '<table style="width:100%;border-collapse:collapse">' +
        p.blocks.map(b =>
          `<tr><td style="border:1px solid #333;padding:2px">${b.i}</td>` +
          `<td style="border:1px solid #333;padding:2px">${esc(b.text_class)}</td>` +
          `<td style="border:1px solid #333;padding:2px">${b.xyxy.join(',')}</td></tr>`
        ).join('') + '</table>';
    }
    if (p.crops) {
      html += p.crops.map(c => {
        const n = c.chars != null ? c.chars : (c.text || '').length;
        // Baberu v1.1 reads up to ~256 chars; a crop hitting that ceiling gets
        // re-OCR'd in overlapping chunks (rare).
        const cap = c.hitCeiling
          ? ` <span style="color:#fc6">⚠ 256-char model cap` +
            (c.chunks > 1 ? ` — re-OCR'd in ${c.chunks} chunks` : ' — could not split further') + `</span>`
          : '';
        const looped = c.stopped === 'limit'
          ? ` <span style="color:#f88">⚠ hit the 128-token safety cap (output degenerate)</span>` : '';
        return `<div style="margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px">` +
          `<img src="${c.thumb}" style="max-width:100%;background:#fff">` +
          `<div>#${c.id}: ${esc(c.text) || '<i style="color:#888">empty</i>'}</div>` +
          `<div style="color:#888">${n} chars${cap}${looped}</div></div>`;
      }).join('');
    }
    if (p.rows) {
      html += '<table style="width:100%;border-collapse:collapse">' +
        p.rows.map(r =>
          `<tr><td style="border:1px solid #333;padding:3px">${esc(r.text)}</td>` +
          `<td style="border:1px solid #333;padding:3px;color:#8f8">${esc(r.translation)}</td></tr>`
        ).join('') + '</table>';
    }
    debugBody.innerHTML = html;
    // Copy button (diaglog tab only): copies the full log text.
    const copyBtn = debugBody.querySelector('#ct-copy-log');
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const done = (t) => { copyBtn.textContent = t; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); };
        try { await navigator.clipboard.writeText(p.log); done('Copied'); }
        catch {
          try {
            const ta = document.createElement('textarea');
            ta.value = p.log; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); ta.remove();
            done('Copied');
          } catch { done('Copy failed'); }
        }
      };
    }
  }

  // ------------------------------------------------------------ messages
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('ct/')) return false;
    // Fresh image scan per message ("run"): the DOM may have changed since
    // the last scan (lazy-load, SPA navigation).
    invalidateImageCache();
    if (msg.type === 'ct/find-image') {
      try { sendResponse({ ok: true, image: findMainImage() }); }
      catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); }
      return false;
    }
    if (msg.type === 'ct/find-image-by-src') {
      try { sendResponse({ ok: true, image: findImageBySrc(msg.srcUrl) }); }
      catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); }
      return false;
    }
    if (msg.type === 'ct/get-image-pixels') {
      mainImagePixels(msg.srcUrl).then(
        r => sendResponse({ ok: true, ...r }),
        e => sendResponse({ ok: false, error: String((e && e.message) || e) })
      );
      return true; // async response
    }
    if (msg.type === 'ct/fetch-image-bytes') {
      // Download the image inside the PAGE (not the service worker): the
      // browser applies the page's real referrer policy and cookies, exactly
      // like the page's own <img> load. Some image hosts / WAFs 403 the
      // service worker's fetch because its Referer and Sec-Fetch-* headers
      // don't match what the page itself sends. The extension's host
      // permissions let the content script read the cross-origin response.
      // The bytes travel back as a data URL string: raw ArrayBuffers are
      // silently emptied by extension messaging (verified), so binary goes
      // the same string route the render path uses for the translated PNG.
      (async () => {
        try {
          // credentials:'include' — send the page's cookies like its own
          // <img> does. Cookie-gated image hosts 403 without them.
          const res = await fetch(msg.srcUrl, { credentials: 'include' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const blob = await res.blob();
          if (!blob.size) throw new Error('empty response body');
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('read failed'));
            reader.readAsDataURL(blob);
          });
          sendResponse({ ok: true, dataUrl });
        } catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e).slice(0, 120) }); }
      })();
      return true;
    }
    if (msg.type === 'ct/pill-notice') {
      // Custom pill message from the SW (e.g. 403-fallback status). Sticky
      // keeps it visible while the background work runs.
      showPill('comic-translate-4-free — ' + esc(msg.text || ''), !!msg.sticky);
      return false;
    }
    if (msg.type === 'ct/run-progress') {
      if (!msg.direct) return false; // broadcasts are for the popup; the pill takes targeted copies
      const st = msg.stage;
      // FIX3: terminal progress ends the run — release the tab-held keep-alive.
      if (st === 'error' || st === 'done' || st === 'cancelled') closeTabKeepAlive(msg.runId);
      if (st === 'error') showPillError(msg.error || stageLabel('error'),
        msg.grantHost ? { host: msg.grantHost, label: msg.grantLabel } : null);
      else if (st === 'done') { showPill('comic-translate-4-free — ' + esc(stageLabel('done')) + ' ✓' + (msg.cached ? ' (from cache)' : msg.backendLabel ? ' (' + esc(msg.backendLabel) + ')' : '')); maybeDing(); }
      else if (st === 'cancelled') showPill('comic-translate-4-free — ' + esc(stageLabel('cancelled')));
      else if (st && st !== 'idle') pillProgress(st, msg.progress);
      return false;
    }
    if (msg.type === 'ct/run-started') {
      // The service worker's current run for this tab. Renders/debug output
      // from any older run (a page the user already left) are ignored — they
      // must never touch this page's DOM.
      latestRunId = msg.runId;
      openTabKeepAlive(msg.runId); // FIX3: tab-held keep-alive for this run.
      // Clear stale original-image markers from a previous run (SPA
      // navigation can leave them behind; a new run must not resolve
      // against the old page's stashed URLs). allImages() also descends
      // into shadow roots — querySelectorAll does not, so a stale marker
      // inside a shadow box survived the clear.
      try {
        allImages().forEach(im => {
          delete im.dataset.ctOriginal;
        });
      } catch { /* best-effort */ }
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'ct/debug-stage') {
      if (msg.runId !== latestRunId) { sendResponse({ ok: false, error: 'stale run' }); return false; }
      ensureOverlay();
      // New run: drop the previous run's stage payloads (each holds a data
      // URL image). Keeps memory bounded across runs.
      if (currentRunId !== msg.runId) {
        for (const k of Object.keys(stageTabs)) delete stageTabs[k];
      }
      currentRunId = msg.runId;
      stageTabs[msg.stage] = msg.payload;
      if (msg.debug) {
        overlay.style.display = 'flex';
        debugPanel.style.display = 'flex';
        if (dbgBtn) dbgBtn.textContent = 'Debug: on';
      }
      renderDebugTab(msg.stage);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'ct/render') {
      // A render from a run that is no longer current (user changed page and
      // a new run started, or this run was cancelled) must never touch the page.
      if (msg.runId !== latestRunId) { sendResponse({ ok: false, error: 'stale run' }); return false; }
      (async () => {
        try {
          currentRunId = msg.runId;
          const { imageDataUrl, width, height, blocks, timings, debug, mode } = msg;
          // Compose the final translated page on a scratch canvas.
          // Canvas guard: downscale if over browser limits; draw blocks in
          // original coordinates via ctx.scale so text layout is unchanged.
          const renderT0 = performance.now();
          const rs = renderScale(width, height);
          const work = document.createElement('canvas');
          work.width = Math.max(1, Math.round(width * rs));
          work.height = Math.max(1, Math.round(height * rs));
          const wctx = work.getContext('2d');
          // The inpainted page arrives as a WebP data URL (raw pixel buffers do
          // not survive extension messaging from the service worker).
          const baseImg = new Image();
          await new Promise((res, rej) => {
            baseImg.onload = res;
            baseImg.onerror = () => rej(new Error('could not decode the translated page image'));
            baseImg.src = imageDataUrl;
          });
          wctx.drawImage(baseImg, 0, 0, work.width, work.height);
          if (rs < 1) wctx.scale(rs, rs);
          const settings = await chrome.storage.local.get('settings').then(r => r.settings || {});
          // Font size bounds are fixed now (the Maximum/Minimum settings
          // were removed in 1.2.6): 120px cap, 10px floor. Sizing starts
          // from the estimated original size (see drawBlock), so the
          // bounds rarely bind.
          const maxSize = 120, minSize = 10;
          const srcLang = (blocks[0] && blocks[0].source_lang) || settings.sourceLang || 'ja';
          const renderInfo = [];
          for (const b of blocks) {
            const info = drawBlock(wctx, b, srcLang, maxSize, minSize);
            if (info) {
              // render_xyxy is debug info in original coordinates; scale to
              // match the downscaled output when the guard kicked in.
              b.render_xyxy = rs < 1 ? info.render_xyxy.map(v => Math.round(v * rs)) : info.render_xyxy;
              b.render_font_size = info.render_font_size;
              renderInfo.push({ text: b.text, size: info.render_font_size, auto: info.auto_font_size, vertical: info.vertical });
            }
          }
          let replaced = false;
          if (mode === 'replace') {
            // In-place: swap the page's original <img> for the translated one.
            // No overlay mask — the translation lives in the page itself.
            // The manual-send path names the exact <img> (msg.srcUrl); the
            // auto path replaces the detected main image.
            // Async blob encode (not toDataURL): toDataURL is fully synchronous
            // and freezes the page for 1-3s on multi-MP images.
            // Note: HTMLCanvasElement has toBlob (callback), not convertToBlob
            // (that's OffscreenCanvas only).
            const blob = await new Promise((resolve, reject) =>
              work.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/webp', 0.95));
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error || new Error('read failed'));
              reader.readAsDataURL(blob);
            });
            replaced = msg.srcUrl ? replaceImageBySrc(msg.srcUrl, dataUrl)
                                  : replaceMainImage(dataUrl);
            if (replaced) {
              if (overlay) overlay.style.display = 'none';
            } else {
              showPillError(pillMsg('pill_err_page_changed'));
            }
          } else {
            showPillError(pillMsg('pill_err_render_mode'));
          }
          const allTimings = { ...(timings || {}) };
          allTimings.render = Math.round(performance.now() - renderT0);
          const totalMs = allTimings.total != null
            ? allTimings.total
            : Object.entries(allTimings).filter(([k]) => k !== 'total').reduce((a, [, v]) => a + (v || 0), 0);
          const seqMs = Object.entries(allTimings).filter(([k]) => k !== 'total' && k !== 'render').reduce((a, [, v]) => a + (v || 0), 0);
          stageTabs['render'] = {
            title: 'Render',
            ms: allTimings.render,
            rows: renderInfo.map(r => ({ text: r.text, translation: `${r.size}px (auto ${r.auto}px)${r.vertical ? ' vertical' : ''}` })),
            totalMs,
            seqMs,
            breakdown: Object.entries(allTimings).filter(([k]) => k !== 'total').map(([k, v]) => `${k} ${v}ms`).join(' · '),
          };
          if (debug) {
            ensureOverlay();
            overlay.style.display = 'flex';
            debugPanel.style.display = 'flex';
            if (dbgBtn) dbgBtn.textContent = 'Debug: on';
            renderDebugTab('render');
          }
          sendResponse({ ok: true, replaced });
          closeTabKeepAlive(msg.runId); // FIX3: render done, run over.
        } catch (e) {
          sendResponse({ ok: false, error: String((e && e.message) || e) });
        }
      })();
      return true;
    }
    return false;
  });
})();
