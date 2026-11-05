# comic-translate-4-free

語言： [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

用你的語言讀漫畫！
comic-translate-4-free 會在你瀏覽時自動翻譯漫畫和連環畫。它能辨識日語、英語、簡體/繁體中文（自動偵測），並翻譯成 114 種語言，在原地取代原始圖片。

### 📸 翻譯前後對比

| 之前（日語） | 之後（繁體中文） |
| --- | --- |
| ![原版日語漫畫頁面](docs/images/wikipe-tan-original.jpg) | ![翻譯成繁體中文](docs/images/wikipe-tan-zh-TW.jpg) |

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

*Wikipe-tan 原畫由 Kasuga 創作，取自[維基百科 Manga 條目](https://en.wikipedia.org/wiki/Manga)，經 Wikimedia Commons 發布 — 採用 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 授權。翻譯後的截圖為原圖的修改衍生作品。*

---

## ✨ 功能

- 自動翻譯 — 在已允許的網站上開啟漫畫頁面，翻譯後的版本就會在原地出現，無需點擊按鈕。
- 在任意圖片上按右鍵 — 選擇「傳送到 comic-translate-4-free」來翻譯特定圖片，即使它小於最小尺寸也可以。
- 透過 Google Translate、Azure Translator 或你自己的本機 LM Studio 伺服器，支援 114 種目標語言。
- 來源語言自動偵測 — 根據 OCR 辨識的文字自動辨識日語、英語、簡體/繁體中文。
- 長條 / 網路漫畫支援 — 高頁面按重疊分段處理，文字保持清晰。
- 17 種介面語言 — 擴充功能介面遵循瀏覽器的語言設定。

### 🔒 隱私

- AI 在你的電腦上執行。氣泡偵測、OCR 和修補填充（inpainting）都在瀏覽器中本機執行。偵測和 OCR 透過 WebAssembly 執行。修補填充在 Chrome 上透過 GPU 執行（可退回 WebAssembly），在 Firefox 上透過 WebAssembly 執行。你的頁面永遠不會離開你的裝置。
- 只有翻譯後的文字會被傳送出去 — 只有擷取出的字串會傳送到你選擇的翻譯服務（Google / Azure / 你本機的 LM Studio）。
- 無帳號、無追蹤、無遙測。所有設定和快取的模型都保留在瀏覽器的本機儲存空間中。

---

## 🚀 安裝

Chrome / Edge / Brave：

[從 Chrome Web Store 安裝](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) —— 一鍵安裝，自動更新。

Firefox:

[從 Firefox 附加元件安裝](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — 一鍵安裝，自動更新。

安裝後，開啟設定頁面，點擊一次下載所有模型（約 350 MB：偵測器、OCR、修補器）。它們會快取在瀏覽器中，並按位元組大小驗證。

![在設定頁面下載模型](docs/images/options-models.png)

---

## 💡 使用方式

1. 先允許該網站 — 點擊擴充功能圖示，按允許此網站（或啟用允許所有網站）。翻譯只在你授予權限的地方執行。

   ![在彈出視窗中授權網站](docs/images/popup.png)

2. 重新載入漫畫頁面 — 頁面載入時會自動開始翻譯。右上角的氣泡會顯示即時進度（Capturing → Detecting → OCR → …）。
3. 完成 — 頁面圖片會在原地取代為翻譯後的版本。

小提示：
- 在任意圖片上按右鍵 → 傳送到 comic-translate-4-free，只翻譯那張圖片。

  ![按右鍵傳送圖片](docs/images/right-click.png)

- 如果網站封鎖下載（HTTP 403），擴充功能會自動透過背景分頁重試。
- 在設定中選擇你的翻譯引擎：Google（免費，不需金鑰）、Azure Translator（在下方申請金鑰 — 每月 200 萬字元免費）或 LM Studio（本機伺服器）。
- 在設定中開啟除錯模式（階段檢視器），可以檢查管線的每個階段。

---

## 🔑 申請 Microsoft Azure 帳號

要將 Azure Translator 用作翻譯引擎：

1. 建立 Microsoft/hotmail/Azure 帳號或登入
2. 建立 Azure 訂閱
3. 建立 Azure Translator 資源
4. 選擇 F0（免費）定價層 — 每月 200 萬字元，永不過期
5. 資源管理 → 金鑰和端點 → 複製 KEY 1 和 Location/Region
6. 將它們貼到擴充功能的設定頁面

---

## ❤️ 支持本專案

如果這個擴充功能對你有幫助，歡迎支持它的開發：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ 已知問題

- 暫無韓語 OCR — 來源語言為日語、英語和簡體/繁體中文。（韓語仍可作為翻譯目標語言使用。）
- 自動翻譯每頁只有一張圖片（頁面的主圖）。要翻譯其他圖片，請使用右鍵 → 傳送。
- 大型工作階段 — 在一個工作階段中翻譯數十張圖片可能會導致瀏覽器當機。如果發生這種情況，請在設定中清除頁面快取。
- Firefox — 模型在背景頁面中執行（沒有離屏文件），與其他所有內容共用記憶體。如果看到「no available backend found」，請重新啟動瀏覽器。
- Firefox 比 Chrome 慢 — Firefox 擴充功能無法使用共享記憶體進行多執行緒處理（SharedArrayBuffer），因此模型只在一個 CPU 執行緒上執行。這是 Firefox 平台的限制，不是擴充功能的錯誤。([Mozilla 錯誤 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477))
- Google Translate 使用非官方免費端點，可能會受到速率限制。

---

## 📄 第三方聲明

本專案受 [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) 啟發 — 氣泡/文字偵測器和漫畫微調的 LaMa 修補器是它的 ONNX 匯出，推論邏輯也是從它移植而來。（OCR 使用 genshiai-daichi 的 [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr)。）

捆綁的程式庫、移植的程式碼和執行時下載的模型及其授權列在 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 中。

MIT 授權 — 見 [LICENSE](LICENSE)。
