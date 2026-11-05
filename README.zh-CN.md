# comic-translate-4-free

语言： [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

直接在浏览器里，用你的语言看漫画。

comic-translate-4-free 会在你浏览时自动翻译漫画页面。它可以读取日语、英语、简体中文和繁体中文（自动识别），并翻译成 114 种语言。打开页面后，翻译好的版本会原位替换原图——对话框里填满你的语言。

### 📸 翻译前后对比

| 之前（日语） | 之后（简体中文） |
| --- | --- |
| ![原版日语漫画页面](docs/images/wikipe-tan-original.jpg) | ![翻译成简体中文](docs/images/wikipe-tan-zh-CN.jpg) |

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

*Wikipe-tan 原画由 Kasuga 创作，取自[维基百科 Manga 条目](https://en.wikipedia.org/wiki/Manga)，经 Wikimedia Commons 发布 — 采用 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 许可。翻译后的截图为原图的修改衍生作品。*

---

## ✨ 功能

- 自动翻译 —— 在已授权的网站上打开漫画页面，翻译版本自动原位出现，无需点击按钮。
- 右键翻译任意图片 —— 选择 "发送到 comic-translate-4-free" 即可翻译指定的图片，即使小于最小尺寸也行。
- 114 种目标语言 —— 通过 Google Translate、Azure Translator，或你自己的本地 LM Studio 服务器。
- 源语言自动识别 —— 从 OCR 识别的文字中自动判断日语、英语或简体/繁体中文。
- 支持长条/条漫 —— 高而长的页面按重叠分段处理，文字保持清晰。
- 17 种界面语言 —— 扩展界面跟随浏览器的语言设置。

### 🔒 隐私

- AI 在你的设备上运行。气泡检测、OCR 和图像修复全部通过 WebAssembly 在浏览器本地执行。你的页面从不离开你的设备。
- 只向外发送待翻译的文字 —— 只有提取出的字符串会发送给你所选的翻译服务（Google / Azure / 本地 LM Studio）。
- 无账号、无追踪、无遥测。所有设置和缓存的模型都保存在浏览器的本地存储中。

---

## 🚀 安装

Chrome / Edge / Brave：

[从 Chrome 应用商店安装](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) —— 一键安装，自动更新。

**Firefox:**

[**从 Firefox 附加组件安装**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — 一键安装，自动更新。

安装完成后，打开设置页面，点击一次 下载所有模型（约 350 MB：检测器、OCR、修复器）。模型会缓存在浏览器中，并按字节大小校验。

![在设置页面下载模型](docs/images/options-models.png)

---

## 💡 使用方法

1. 先授权站点 —— 点击扩展图标，按 允许此网站（或启用 允许所有网站）。翻译只在你授权过的站点上运行。

   ![在弹窗中授权站点](docs/images/popup.png)

2. 刷新漫画页面 —— 页面加载时自动开始翻译。右上角的小胶囊会显示实时进度（Capturing → Detecting → OCR → …）。
3. 完成 —— 页面的图片会被原位替换为翻译后的版本。

小贴士：
- 右键点击任意图片 → 发送到 comic-translate-4-free，只翻译那一张图。

  ![右键发送图片](docs/images/right-click.png)

- 如果站点禁止下载（HTTP 403），扩展会自动通过后台标签页重试。
- 在设置中选择翻译引擎：Google（免费，无需密钥）、Azure Translator（按下方指引申请密钥 —— 每月 200 万字符免费），或 LM Studio（本地服务器）。
- 在设置中开启 调试模式（阶段检查器），可查看流水线的每个阶段。

---

## 🔑 申请 Microsoft Azure 账号

要使用 Azure Translator 作为翻译引擎：

1. 创建或登录 Microsoft / hotmail / Azure 账号
2. 创建 Azure 订阅
3. 创建 Azure Translator 资源
4. 选择 F0（免费）定价层 —— 每月 200 万字符，永久有效
5. 资源管理 → 密钥和终结点 → 复制 KEY 1 和 Location/Region
6. 粘贴到扩展的设置页面

---

## ❤️ 支持本项目

如果这个扩展对你有用，欢迎支持它的开发：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ 已知问题

- 暂不支持韩语 OCR —— 源语言为日语、英语和简体/繁体中文。（韩语仍可作为翻译目标语言。）
- 自动翻译每次只处理一张图片（页面的主图）。右键 → 发送可翻译其他图片。
- 大批量翻译 —— 一次翻译几十张图片可能导致浏览器崩溃。如果发生，请在设置中清除页面缓存。
- Firefox —— 模型在后台页面中运行（没有 offscreen 文档），与其他内容共享内存。如果看到 "no available backend found"，请重启浏览器。
- Google 翻译使用非官方免费接口，可能会被限流。

---

## 📄 第三方声明

本项目受 [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) 启发 —— 气泡/文本检测器和漫画微调版 LaMa 修复器是它的 ONNX 导出，推理逻辑也移植自该项目。（OCR 使用 genshiai-daichi 的 [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr)。）

打包的第三方库、移植的代码和运行时下载的模型及其许可协议见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

MIT 许可协议 —— 详见 [LICENSE](LICENSE)。
