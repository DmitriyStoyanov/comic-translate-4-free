# comic-translate-4-free

语言： [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

用你的语言读漫画！
comic-translate-4-free 会在你浏览时自动翻译漫画和连环画。它能识别日语、英语、简体/繁体中文（自动检测），并翻译成 114 种语言，在原地替换原始图片。

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

- 自动翻译 — 在已允许的网站上打开漫画页面，翻译后的版本就会在原地出现，无需点击按钮。
- 右键点击任意图片 — 选择“发送到 comic-translate-4-free”来翻译特定图片，即使它小于最小尺寸也可以。
- 通过 Google Translate、Azure Translator 或你自己的本地 LM Studio 服务器，支持 114 种目标语言。
- 源语言自动检测 — 根据 OCR 识别的文本自动识别日语、英语、简体/繁体中文。
- 长条 / 网络漫画支持 — 高页面按重叠分段处理，文字保持清晰。
- 17 种界面语言 — 扩展界面遵循浏览器的语言设置。

### 🔒 隐私

- AI 在你的电脑上运行。气泡检测、OCR 和修复填充（inpainting）都在浏览器中本地运行。检测和 OCR 通过 WebAssembly 运行。修复填充在 Chrome 上通过 GPU 运行（可回退到 WebAssembly），在 Firefox 上通过 WebAssembly 运行。你的页面永远不会离开你的设备。
- 只有翻译后的文本会被发送出去 — 只有提取出的字符串会发送到你选择的翻译服务（Google / Azure / 你本地的 LM Studio）。
- 无账号、无追踪、无遥测。所有设置和缓存的模型都保留在浏览器的本地存储中。

---

## 🚀 安装

Chrome / Edge / Brave：

[从 Chrome Web Store 安装](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) —— 一键安装，自动更新。

Firefox:

[从 Firefox 附加组件安装](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — 一键安装，自动更新。

安装后，打开设置页面，点击一次下载所有模型（约 350 MB：检测器、OCR、修复器）。它们会缓存在浏览器中，并按字节大小验证。

![在设置页面下载模型](docs/images/options-models.png)

---

## 💡 使用方法

1. 先允许该网站 — 点击扩展图标，按允许此网站（或启用允许所有网站）。翻译只在你授予权限的地方运行。

   ![在弹窗中授权站点](docs/images/popup.png)

2. 重新加载漫画页面 — 页面加载时会自动开始翻译。右上角的气泡会显示实时进度（Capturing → Detecting → OCR → …）。
3. 完成 — 页面图片会在原地替换为翻译后的版本。

小贴士：
- 右键点击任意图片 → 发送到 comic-translate-4-free，只翻译那张图片。

  ![右键发送图片](docs/images/right-click.png)

- 如果某个网站阻止下载（HTTP 403），扩展会通过后台标签页自动重试。
- 在设置中选择你的翻译引擎：Google（免费，无需密钥）、Azure Translator（在下方申请密钥 — 每月 200 万字符免费）或 LM Studio（本地服务器）。
- 在设置中启用调试模式（阶段检查器），可以检查流水线的每个阶段。

---

## 🔑 申请 Microsoft Azure 账号

要将 Azure Translator 用作翻译引擎：

1. 创建 Microsoft/hotmail/Azure 账号或登录
2. 创建 Azure 订阅
3. 创建 Azure Translator 资源
4. 选择 F0（免费）定价层 — 每月 200 万字符，永不过期
5. 资源管理 → 密钥和终结点 → 复制 KEY 1 和 Location/Region
6. 将它们粘贴到扩展的设置页面

---

## ❤️ 支持这个项目

如果这个扩展对你有用，请考虑支持它的开发：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ 已知问题

- 暂无韩语 OCR — 源语言为日语、英语和简体/繁体中文。（韩语仍可作为翻译目标语言使用。）
- 自动翻译每页只有一张图片（页面的主图）。要翻译其他图片，请使用右键 → 发送。
- 大型会话 — 在一个会话中翻译数十张图片可能会导致浏览器崩溃。如果发生这种情况，请在设置中清除页面缓存。
- Firefox — 模型在后台页面中运行（没有离屏文档），与其他所有内容共享内存。如果看到“no available backend found”，请重新启动浏览器。
- Firefox 比 Chrome 慢 — Firefox 扩展无法使用共享内存进行多线程处理（SharedArrayBuffer），因此模型只在一个 CPU 线程上运行。这是 Firefox 平台的限制，不是扩展的错误。([Mozilla 错误 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477))
- Google Translate 使用非官方免费端点，可能会受到速率限制。

---

## 📄 第三方声明

本项目受 [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) 启发 — 气泡/文本检测器和漫画微调的 LaMa 修复器是它的 ONNX 导出，推理逻辑也是从它移植而来。（OCR 使用 genshiai-daichi 的 [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr)。）

捆绑的库、移植的代码和运行时下载的模型及其许可证列在 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 中。

MIT 许可证 — 见 [LICENSE](LICENSE)。
