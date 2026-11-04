# Chrome Web Store listing — comic-translate-4-free

## Short description (132 chars max)

Translate manga & comics in your browser. Reads Japanese, English, Simplified & Traditional Chinese; translates into 114 languages.

(Count: 131)

## Detailed description

**Read manga in your language — right in the browser.**

comic-translate-4-free translates comic and manga pages automatically as you
browse. Open a page, and the translated version replaces the original image
in place — speech bubbles filled with your language, nothing to click.

**How it works**

1. The extension finds the page's main image and captures it.
2. An on-device AI detector locates every speech bubble and text block.
3. Manga-trained OCR reads the text (Japanese, English, Simplified and
   Traditional Chinese — with automatic language detection).
4. The original text is cleanly removed with AI inpainting.
5. Your choice of translation engine renders the result back into the
   bubbles, sized to fit.

**Privacy-first: the AI runs on your machine**

Bubble detection and OCR run locally in your browser via WebAssembly, and
inpainting runs on your GPU (with WebAssembly fallback) — your pages never
leave your device. Only the extracted text is sent to the translation
service you choose.

**Features**

- Automatic translation when pages load — no button pressing
- Right-click any image → "Send to comic-translate-4-free" to translate it directly
- 114 target languages via Google Translate, Azure Translator, or your own
  local LM Studio server
- Source language auto-detection
- Long-strip / webtoon support
- Works on sites that block automated downloads (via background-tab fallback)
- Dark-themed popup and settings, per-site access controls
- Debug mode shows every pipeline stage for troubleshooting

**Free and open source**

MIT licensed. No account, no subscription, no tracking.
https://github.com/jameslee0623/comic-translate-4-free
