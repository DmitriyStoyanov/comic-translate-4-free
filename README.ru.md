# comic-translate-4-free

**Язык:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

Читайте мангу на своём языке — прямо в браузере.

comic-translate-4-free автоматически переводит страницы манги и комиксов, пока вы их смотрите. Оно читает на японском, английском, упрощённом и традиционном китайском (с автоопределением) и переводит на 114 языков. Откройте страницу — и переведённая версия заменит исходное изображение прямо на месте: облачка с текстом на вашем языке.

### 📸 До и после

| До (японский) | После (русский) |
| --- | --- |
| ![Original Japanese manga page](docs/images/wikipe-tan-original.jpg) | ![Translated to Russian](docs/images/wikipe-tan-ru.jpg) |

<details>
<summary>См. переводы ещё на 14 языках</summary>

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

*Оригинальная иллюстрация Wikipe-tan художника Kasuga, из [статьи «Манга» в Википедии](https://en.wikipedia.org/wiki/Manga) через Wikimedia Commons — лицензия [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Переведённые скриншоты являются изменёнными производными произведениями оригинала.*

---

## ✨ Возможности

- **Автоматический перевод** — откройте страницу манги на разрешённом сайте, и переведённая версия появится прямо на месте, без нажатия кнопки.
- **Правый клик по любому изображению** — выберите «Send to comic-translate-4-free», чтобы перевести конкретную картинку, даже меньше минимального размера.
- **114 целевых языков** через Google Translate, Azure Translator или ваш собственный локальный сервер LM Studio.
- **Автоопределение исходного языка** — японский, английский, упрощённый/традиционный китайский определяются автоматически по распознанному тексту.
- **Поддержка длинных полос / вебтунов** — высокие страницы обрабатываются перекрывающимися фрагментами, чтобы текст оставался чётким.
- **17 языков интерфейса** — интерфейс расширения следует настройке языка вашего браузера.

### 🔒 Конфиденциальность

- **ИИ работает на вашем устройстве.** Обнаружение облачков, OCR и восстановление фона выполняются локально в вашем браузере через WebAssembly. Ваши страницы никогда не покидают ваше устройство.
- **Отправляется только переведённый текст** — на выбранный вами сервис перевода (Google / Azure / ваш локальный LM Studio) уходят только извлечённые строки.
- **Без аккаунта, без отслеживания, без телеметрии.** Все настройки и кэшированные модели хранятся в локальном хранилище вашего браузера.

---

## 🚀 Установка

**Chrome / Edge / Brave:**

[**Установить из Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — один клик, автоматические обновления.

**Firefox:**

[**Установить из Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — в один клик, автоматические обновления.

После установки откройте страницу настроек и один раз нажмите **Скачать все модели** (~350 МБ: детектор, OCR, inpainter). Они кэшируются в браузере и проверяются по размеру в байтах.

![Downloading the models from the Settings page](docs/images/options-models.png)

---

## 💡 Как пользоваться

1. **Сначала разрешите сайт** — нажмите на значок расширения и нажмите **Разрешить этот сайт** (или включите **Разрешить все сайты**). Перевод работает только там, где вы дали разрешение.

   ![Allow the site from the popup](docs/images/popup.png)

2. **Перезагрузите страницу манги** — перевод начинается автоматически при загрузке страницы. Пилюля в правом верхнем углу показывает прогресс в реальном времени (Capturing → Detecting → OCR → …).
3. **Готово** — картинка на странице заменяется на месте переведённой версией.

**Советы:**
- Правый клик по любому изображению → **Отправить в comic-translate-4-free**, чтобы перевести только эту картинку.

  ![Right-click to send an image](docs/images/right-click.png)

- Если сайт блокирует скачивание (HTTP 403), расширение автоматически повторит попытку через фоновую вкладку.
- Выберите движок перевода в настройках: Google (бесплатно, без ключа), Azure Translator (заявка на ключи ниже — 2 млн символов в месяц бесплатно) или LM Studio (локальный сервер).
- Включите **Режим отладки** в настройках, чтобы проверить каждый этап конвейера.

---

## 🔑 Получение аккаунта Microsoft Azure

Чтобы использовать Azure Translator как движок перевода:

1. Создайте/войдите в аккаунт Microsoft/hotmail/Azure
2. Создайте подписку Azure
3. Создайте ресурс Azure Translator
4. Выберите тарифный план F0 (Free) — 2 миллиона символов в месяц, без срока действия
5. Управление ресурсом → Ключи и конечная точка → скопируйте **KEY 1** и **Location/Region**
6. Вставьте их на страницу настроек расширения

---

## ❤️ Поддержите проект

Если это расширение вам полезно, рассмотрите возможность поддержать его разработку:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Известные проблемы

- **OCR для корейского пока нет** — исходные языки: японский, английский и упрощённый/традиционный китайский. (Корейский остаётся доступным как целевой язык перевода.)
- **Одна картинка на страницу** для автоперевода (главное изображение страницы). Используйте правый клик → Send, чтобы перевести другие.
- **Большие сессии** — перевод десятков изображений за одну сессию может привести к сбою браузера. В таком случае очистите кэш страниц в настройках.
- **Firefox** — модели работают в фоновой странице (без offscreen-документов), разделяя память со всем остальным. Перезапустите браузер, если увидите «no available backend found».
- Google Translate использует неофициальный бесплатный эндпоинт и может быть ограничен по скорости.

---

## 📄 Уведомления о сторонних компонентах

Этот проект вдохновлён [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — детектор облачков/текста и манга-дообученный inpainter LaMa являются его ONNX-экспортами, а логика инференса портирована из него. (OCR использует [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) от genshiai-daichi.)

Встроенные библиотеки, портированный код и модели, скачиваемые во время работы, перечислены с лицензиями в [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Лицензия MIT — см. [LICENSE](LICENSE).
