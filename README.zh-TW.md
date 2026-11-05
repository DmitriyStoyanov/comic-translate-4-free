# comic-translate-4-free

語言： [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

直接在瀏覽器裡，用你的語言看漫畫。

comic-translate-4-free 會在你瀏覽時自動翻譯漫畫頁面。它可以讀取日語、英語、簡體中文和繁體中文（自動識別），並翻譯成 114 種語言。開啟頁面後，翻譯好的版本會原位取代原圖——對話框裡填滿你的語言。

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

- 自動翻譯 —— 在已授權的網站上開啟漫畫頁面，翻譯版本自動原位出現，無需按任何按鈕。
- 右鍵翻譯任意圖片 —— 選擇 "傳送到 comic-translate-4-free" 即可翻譯指定的圖片，即使小於最小尺寸也行。
- 114 種目標語言 —— 透過 Google Translate、Azure Translator，或你自己的本機 LM Studio 伺服器。
- 來源語言自動識別 —— 從 OCR 識別的文字中自動判斷日語、英語或簡體／繁體中文。
- 支援長條／條漫 —— 又高又長的頁面會按重疊分段處理，文字保持清晰。
- 17 種介面語言 —— 擴充功能介面會跟隨瀏覽器的語言設定。

### 🔒 隱私

- AI 在你的裝置上執行。氣泡偵測、OCR 和圖像修補全部透過 WebAssembly 在瀏覽器本機執行。你的頁面從不離開你的裝置。
- 只向外傳送待翻譯的文字 —— 只有提取出的字串會傳給你所選的翻譯服務（Google / Azure / 本機 LM Studio）。
- 無帳號、無追蹤、無遙測。所有設定與快取的模型都保存在瀏覽器的本機儲存空間。

---

## 🚀 安裝

Chrome / Edge / Brave：

[從 Chrome 應用程式商店安裝](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) —— 一鍵安裝，自動更新。

**Firefox:**

[**從 Firefox 附加元件安裝**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — 一鍵安裝，自動更新。

安裝完成後，開啟設定頁面，點擊一次 下載所有模型（約 350 MB：偵測器、OCR、修補器）。模型會快取在瀏覽器中，並依位元組大小驗證。

![在設定頁面下載模型](docs/images/options-models.png)

---

## 💡 使用方式

1. 先授權網站 —— 點擊擴充功能圖示，按 允許此網站（或啟用 允許所有網站）。翻譯只在你授權過的網站上執行。

   ![在彈出視窗中授權網站](docs/images/popup.png)

2. 重新載入漫畫頁面 —— 頁面載入時會自動開始翻譯。右上角的膠囊會顯示即時進度（Capturing → Detecting → OCR → …）。
3. 完成 —— 頁面的圖片會被原位取代為翻譯後的版本。

小提示：
- 在任意圖片上按右鍵 → 傳送到 comic-translate-4-free，只翻譯那一張圖。

  ![按右鍵傳送圖片](docs/images/right-click.png)

- 如果網站封鎖下載（HTTP 403），擴充功能會自動透過背景分頁重試。
- 在設定中選擇翻譯引擎：Google（免費，不需金鑰）、Azure Translator（依下方指引申請金鑰 —— 每月 200 萬字元免費），或 LM Studio（本機伺服器）。
- 在設定中開啟 除錯模式（階段檢視器），可檢視管線的每個階段。

---

## 🔑 申請 Microsoft Azure 帳號

要使用 Azure Translator 作為翻譯引擎：

1. 建立或登入 Microsoft / hotmail / Azure 帳號
2. 建立 Azure 訂閱
3. 建立 Azure Translator 資源
4. 選擇 F0（免費）定價層 —— 每月 200 萬字元，永久有效
5. 資源管理 → 金鑰和端點 → 複製 KEY 1 和 Location/Region
6. 貼到擴充功能的設定頁面

---

## ❤️ 支持本專案

如果這個擴充功能對你有幫助，歡迎支持它的開發：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ 已知問題

- 暫不支援韓語 OCR —— 來源語言為日語、英語和簡體／繁體中文。（韓語仍可作為翻譯目標語言。）
- 自動翻譯每次只處理一張圖片（頁面的主圖）。右鍵 → 傳送可翻譯其他圖片。
- 大量翻譯 —— 一次翻譯幾十張圖片可能導致瀏覽器當機。若發生此情形，請在設定中清除頁面快取。
- Firefox —— 模型在背景頁面中執行（沒有 offscreen 文件），與其他內容共用記憶體。如果看到 "no available backend found"，請重新啟動瀏覽器。
- Google 翻譯使用非官方免費端點，可能會被限流。

---

## 📄 第三方聲明

本專案受 [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) 啟發 —— 氣泡／文字偵測器和漫畫微調版 LaMa 修補器是它的 ONNX 匯出，推理邏輯也移植自該專案。（OCR 使用 genshiai-daichi 的 [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr)。）

打包的第三方函式庫、移植的程式碼和執行時下載的模型及其授權條款，請見 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

MIT 授權 —— 詳見 [LICENSE](LICENSE)。
