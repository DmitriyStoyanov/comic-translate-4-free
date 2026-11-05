# comic-translate-4-free

**Язык:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

Читайте мангу на своём языке!
comic-translate-4-free автоматически переводит мангу и комиксы при просмотре. Читает японский, английский, упрощённый/традиционный китайский (автоопределение) и переводит на 114 языков, заменяя изображение на месте.

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

- **Автоматический перевод** — откройте страницу манги на разрешённом сайте, и переведённая версия появится на месте, без нажатия кнопок.
- **Щёлкните правой кнопкой мыши по любому изображению** — выберите «Отправить в comic-translate-4-free», чтобы перевести конкретную картинку, даже если она меньше минимального размера.
- **114 целевых языков** через Google Translate, Azure Translator или ваш собственный локальный сервер LM Studio.
- **Автоопределение исходного языка** — японский, английский, упрощённый/традиционный китайский определяются автоматически по тексту, распознанному OCR.
- **Поддержка длинных полос / вебтунов** — высокие страницы обрабатываются перекрывающимися сегментами, чтобы текст оставался чётким.
- **17 языков интерфейса** — интерфейс расширения следует языковой настройке вашего браузера.

### 🔒 Конфиденциальность

- **ИИ работает на вашем компьютере.** Обнаружение облачков, OCR и инпейнтинг выполняются локально в вашем браузере. Обнаружение и OCR работают через WebAssembly. Инпейнтинг работает на GPU в Chrome (с откатом на WebAssembly) и через WebAssembly в Firefox. Ваши страницы никогда не покидают ваше устройство.
- **Отправляется только переведённый текст** — только извлечённые строки уходят в выбранный вами сервис перевода (Google / Azure / ваш локальный LM Studio).
- **Без учётной записи, без отслеживания, без телеметрии.** Все настройки и кэшированные модели остаются в локальном хранилище вашего браузера.

---

## 🚀 Установка

**Chrome / Edge / Brave:**

[**Установить из Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — один клик, автоматические обновления.

**Firefox:**

[**Установить из Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — один клик, автоматические обновления.

После установки откройте страницу настроек и один раз нажмите **Скачать все модели** (~350 МБ: детектор, OCR, инпейнтер). Они кэшируются в браузере и проверяются по размеру в байтах.

![Downloading the models from the Settings page](docs/images/options-models.png)

---

## 💡 Как пользоваться

1. **Сначала разрешите сайт** — нажмите на значок расширения и нажмите **Разрешить этот сайт** (или включите **Разрешить все сайты**). Перевод работает только там, где вы дали разрешение.

   ![Allow the site from the popup](docs/images/popup.png)

2. **Перезагрузите страницу манги** — перевод начнётся автоматически при загрузке страницы. Пилюля в правом верхнем углу показывает прогресс в реальном времени (Capturing → Detecting → OCR → …).
3. **Готово** — картинка страницы заменяется на месте переведённой версией.

**Советы:**
- Щёлкните правой кнопкой мыши по любому изображению → **Отправить в comic-translate-4-free**, чтобы перевести только эту картинку.

  ![Right-click to send an image](docs/images/right-click.png)

- Если сайт блокирует загрузки (HTTP 403), расширение автоматически повторяет попытку через фоновую вкладку.
- Выберите движок перевода в настройках: Google (бесплатно, без ключа), Azure Translator (запросите ключи ниже — 2 млн символов/месяц бесплатно) или LM Studio (локальный сервер).
- Включите **Режим отладки (инспектор этапов)** в настройках, чтобы проверить каждый этап конвейера.

---

## 🔑 Подать заявку на учётную запись Microsoft Azure

Чтобы использовать Azure Translator в качестве движка перевода:

1. Создайте учётную запись Microsoft/hotmail/Azure или войдите в неё
2. Создайте подписку Azure
3. Создайте ресурс Azure Translator
4. Выберите ценовой уровень F0 (бесплатный) — 2 млн символов/месяц, срок действия не истекает
5. Управление ресурсами → Ключи и конечная точка → скопируйте **KEY 1** и **Location/Region**
6. Вставьте их на страницу настроек расширения

---

## ❤️ Поддержите этот проект

Если это расширение полезно для вас, подумайте о поддержке его разработки:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Известные проблемы

- **Пока нет OCR для корейского** — языки оригинала: японский, английский и упрощённый/традиционный китайский. (Корейский по-прежнему доступен как язык перевода.)
- **Одно изображение на страницу** для автоперевода (главное изображение страницы). Чтобы перевести другие, используйте правый клик → «Отправить».
- **Большие сессии** — перевод десятков изображений за одну сессию может привести к сбою браузера. В этом случае очистите кэш страницы в настройках.
- **Firefox** — модели работают на фоновой странице (без offscreen-документов), разделяя память со всем остальным. Перезапустите браузер, если увидите «no available backend found».
- **Firefox медленнее Chrome** — расширения Firefox не могут использовать общую память для многопоточности (SharedArrayBuffer), поэтому модель работает на одном потоке CPU. Это ограничение платформы Firefox, а не ошибка расширения ([Баг Mozilla 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- Google Translate использует неофициальную бесплатную конечную точку и может быть ограничен по скорости.

---

## 📄 Уведомления третьих сторон

Этот проект вдохновлён [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — детектор облачков/текста и обученный на манге инпейнтер LaMa являются его ONNX-экспортами, а логика вывода портирована из него. (OCR использует [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) от genshiai-daichi.)

Включённые библиотеки, портированный код и модели, загружаемые во время работы, перечислены вместе с их лицензиями в [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Лицензия MIT — см. [LICENSE](LICENSE).
