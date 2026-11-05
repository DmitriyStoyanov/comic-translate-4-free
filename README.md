# comic-translate-4-free

Language: [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

Read manga in your language — right in the browser.

comic-translate-4-free translates manga and comic pages automatically as you browse. It reads Japanese, English, Simplified and Traditional Chinese (with auto-detect), and translates into 114 languages. Open a page, and the translated version replaces the original image in place — speech bubbles filled with your language.

### 📸 Before & After

| Before (Japanese) | After (English) |
| --- | --- |
| ![Original Japanese manga page](docs/images/wikipe-tan-original.jpg) | ![Translated to English](docs/images/wikipe-tan-en.jpg) |

<details>
<summary>See translations in 14 more languages</summary>

| Hindi | Korean | Simplified Chinese |
| --- | --- | --- |
| ![Hindi](docs/images/wikipe-tan-hi.jpg) | ![Korean](docs/images/wikipe-tan-ko.jpg) | ![Simplified Chinese](docs/images/wikipe-tan-zh-CN.jpg) |

| Traditional Chinese | Spanish | Arabic |
| --- | --- | --- |
| ![Traditional Chinese](docs/images/wikipe-tan-zh-TW.jpg) | ![Spanish](docs/images/wikipe-tan-es.jpg) | ![Arabic](docs/images/wikipe-tan-ar.jpg) |

| French | Bengali | Portuguese |
| --- | --- | --- |
| ![French](docs/images/wikipe-tan-fr.jpg) | ![Bengali](docs/images/wikipe-tan-bn.jpg) | ![Portuguese](docs/images/wikipe-tan-pt.jpg) |

| Russian | Vietnamese | Indonesian |
| --- | --- | --- |
| ![Russian](docs/images/wikipe-tan-ru.jpg) | ![Vietnamese](docs/images/wikipe-tan-vi.jpg) | ![Indonesian](docs/images/wikipe-tan-id.jpg) |

| Urdu | German |
| --- | --- |
| ![Urdu](docs/images/wikipe-tan-ur.jpg) | ![German](docs/images/wikipe-tan-de.jpg) |

</details>

*Original Wikipe-tan illustration by Kasuga, from [Wikipedia's Manga article](https://en.wikipedia.org/wiki/Manga) via Wikimedia Commons — licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The translated screenshots are modified derivatives of the original.*

---

## ✨ Features

- Automatic translation — open a manga page on an allowed site and the translated version appears in place, no button click needed.
- Right-click any image — choose "Send to comic-translate-4-free" to translate a specific picture, even one smaller than the minimum size.
- 114 target languages via Google Translate, Azure Translator, or your own local LM Studio server.
- Source language auto-detect — Japanese, English, Simplified/Traditional Chinese identified automatically from the OCR'd text.
- Long-strip / webtoon support — tall pages are processed in overlapping segments so text stays sharp.
- 17 UI languages — the extension interface follows your browser's language setting.

### 🔒 Privacy

- The AI runs on your machine. Bubble detection, OCR, and inpainting all run locally in your browser. Detection and OCR run via WebAssembly. Inpainting runs on GPU on Chrome (with WebAssembly fallback), and via WebAssembly on Firefox. Your pages never leave your device.
- Only translated text is sent out — just the extracted strings go to the translation service you choose (Google / Azure / your local LM Studio).
- No account, no tracking, no telemetry. All settings and cached models stay in your browser's local storage.

---

## 🚀 Installation

Chrome / Edge / Brave:

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — one click, automatic updates.

Firefox:

[Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — one click, automatic updates.

After installing, open the Settings page and click Download all models once (~350 MB: detector, OCR, inpainter). They're cached in the browser and verified by byte size.

![Downloading the models from the Settings page](docs/images/options-models.png)

---

## 💡 How to Use

1. Allow the site first — click the extension icon and press Allow this site (or enable ALLOW ALL SITES). Translation only runs where you've granted permission.

   ![Allow the site from the popup](docs/images/popup.png)

2. Reload the manga page — it starts translating automatically when the page loads. A pill in the top-right shows live progress (Capturing → Detecting → OCR → …).
3. Done — the page's picture is replaced in place with the translated version.

Tips:
- Right-click any image → Send to comic-translate-4-free to translate just that picture.

  ![Right-click to send an image](docs/images/right-click.png)

- If a site blocks downloads (HTTP 403), the extension automatically retries via a background tab.
- Pick your translation engine in Settings: Google (free, no key), Azure Translator (apply for keys below — 2M characters/month free), or LM Studio (local server).
- Enable Debug mode in Settings to inspect every pipeline stage.

---

## 🔑 Apply for a Microsoft Azure account

To use Azure Translator as the translation engine:

1. Create/sign in to a Microsoft/hotmail/Azure account
2. Create an Azure subscription
3. Create an Azure Translator resource
4. Select F0 (Free) pricing tier — 2 million characters/month, does not expire
5. Resource Management → Keys and Endpoint → copy KEY 1 and Location/Region
6. Paste them into the extension's Settings page

---

## ❤️ Support this project

If this extension is useful to you, consider supporting its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Known Issues

- No Korean OCR yet — source languages are Japanese, English, and Simplified/Traditional Chinese. (Korean remains available as a translation target.)
- One picture per page for auto-translate (the page's main image). Use right-click → Send to translate others.
- Large sessions — translating dozens of images in one session can crash the browser. Clear the page cache in Settings if this happens.
- Firefox — models run in the background page (no offscreen documents), sharing memory with everything else. Restart the browser if you see "no available backend found".
- Firefox is slower than Chrome — Firefox extensions cannot use shared memory for multi-threading (SharedArrayBuffer), so the model runs on one CPU thread. This is a Firefox platform limit, not an extension bug ([Mozilla bug 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- Google Translate uses the unofficial free endpoint and may be rate-limited.

---

## 📄 Third-party notices

This project is inspired by [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — the bubble/text detector and the manga-finetuned LaMa inpainter are its ONNX exports, and the inference logic is ported from it. (OCR uses [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) by genshiai-daichi.)

Bundled libraries, ported code, and runtime-downloaded models are listed with their licenses in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

MIT License — see [LICENSE](LICENSE).
