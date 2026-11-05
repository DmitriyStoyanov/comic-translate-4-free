# comic-translate-4-free

Idioma: [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

¡Lee manga en tu idioma!
comic-translate-4-free traduce manga y cómics automáticamente mientras navegas. Lee japonés, inglés, chino simplificado/tradicional (detección automática), y traduce a 114 idiomas, reemplazando la imagen en su lugar.

### 📸 Antes y después

| Antes (japonés) | Después (español) |
| --- | --- |
| ![Original Japanese manga page](docs/images/wikipe-tan-original.jpg) | ![after](docs/images/wikipe-tan-es.jpg) |

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

*Ilustración original de Wikipe-tan por Kasuga, del [artículo Manga de Wikipedia](https://en.wikipedia.org/wiki/Manga) vía Wikimedia Commons — con licencia [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Las capturas traducidas son obras derivadas modificadas del original.*

---

## ✨ Funciones

- Traducción automática — abre una página de manga en un sitio permitido y la versión traducida aparece en su lugar, sin necesidad de hacer clic en ningún botón.
- Clic derecho en cualquier imagen — elige "Enviar a comic-translate-4-free" para traducir una imagen concreta, incluso si es más pequeña que el tamaño mínimo.
- 114 idiomas de destino con Google Translate, Azure Translator o tu propio servidor local de LM Studio.
- Detección automática del idioma de origen — japonés, inglés, chino simplificado/tradicional se identifican automáticamente a partir del texto leído por OCR.
- Soporte para tiras largas / webtoon — las páginas altas se procesan en segmentos superpuestos para que el texto se mantenga nítido.
- 17 idiomas de interfaz — la interfaz de la extensión sigue el ajuste de idioma de tu navegador.

### 🔒 Privacidad

- La IA se ejecuta en tu equipo. La detección de bocadillos, el OCR y el inpainting se ejecutan localmente en tu navegador. La detección y el OCR se ejecutan con WebAssembly. El inpainting se ejecuta con GPU en Chrome (con WebAssembly como alternativa) y con WebAssembly en Firefox. Tus páginas nunca salen de tu dispositivo.
- Solo se envía el texto traducido — solo las cadenas extraídas van al servicio de traducción que elijas (Google / Azure / tu LM Studio local).
- Sin cuenta, sin rastreo, sin telemetría. Todos los ajustes y modelos en caché permanecen en el almacenamiento local de tu navegador.

---

## 🚀 Instalación

Chrome / Edge / Brave:

[Instalar desde Chrome Web Store](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — un clic, actualizaciones automáticas.

Firefox:

[Instalar desde Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — un clic, actualizaciones automáticas.

Después de instalar, abre la página de Ajustes y haz clic una vez en Descargar todos los modelos (~350 MB: detector, OCR, inpainter). Se guardan en caché en el navegador y se verifican por tamaño en bytes.

![Descargando los modelos desde la página de ajustes](docs/images/options-models.png)

---

## 💡 Cómo usarlo

1. Permite primero el sitio — haz clic en el icono de la extensión y pulsa Permitir este sitio (o activa Permitir todos los sitios). La traducción solo se ejecuta donde hayas concedido permiso.

   ![Permitir el sitio desde la ventana emergente](docs/images/popup.png)

2. Recarga la página de manga — empieza a traducir automáticamente cuando se carga la página. Una píldora en la parte superior derecha muestra el progreso en vivo (Capturing → Detecting → OCR → …).
3. Listo — la imagen de la página se reemplaza en su lugar con la versión traducida.

Consejos:
- Clic derecho en cualquier imagen → Enviar a comic-translate-4-free para traducir solo esa imagen.

  ![Clic derecho para enviar una imagen](docs/images/right-click.png)

- Si un sitio bloquea las descargas (HTTP 403), la extensión reintenta automáticamente a través de una pestaña en segundo plano.
- Elige tu motor de traducción en Ajustes: Google (gratis, sin clave), Azure Translator (solicita las claves abajo — 2M de caracteres/mes gratis) o LM Studio (servidor local).
- Activa el Modo de depuración (inspector de etapas) en Ajustes para inspeccionar cada etapa del proceso.

---

## 🔑 Solicitar una cuenta de Microsoft Azure

Para usar Azure Translator como motor de traducción:

1. Crea una cuenta de Microsoft/hotmail/Azure o inicia sesión
2. Crea una suscripción de Azure
3. Crea un recurso de Azure Translator
4. Selecciona el nivel de precios F0 (gratuito) — 2 millones de caracteres/mes, no caduca
5. Administración de recursos → Claves y punto de conexión → copia KEY 1 y Location/Region
6. Pégalas en la página de Ajustes de la extensión

---

## ❤️ Apoya este proyecto

Si esta extensión te resulta útil, considera apoyar su desarrollo:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Problemas conocidos

- Aún no hay OCR de coreano — los idiomas de origen son japonés, inglés y chino simplificado/tradicional. (El coreano sigue disponible como idioma de traducción.)
- Una imagen por página para la traducción automática (la imagen principal de la página). Usa clic derecho → Enviar para traducir otras.
- Sesiones grandes — traducir decenas de imágenes en una sesión puede hacer que el navegador se bloquee. Borra la caché de la página en Ajustes si esto ocurre.
- Firefox — los modelos se ejecutan en la página en segundo plano (sin documentos offscreen), compartiendo memoria con todo lo demás. Reinicia el navegador si ves "no available backend found".
- Firefox es más lento que Chrome — las extensiones de Firefox no pueden usar memoria compartida para multihilo (SharedArrayBuffer), por lo que el modelo se ejecuta en un solo hilo de CPU. Esto es un límite de la plataforma Firefox, no un error de la extensión. ([Bug de Mozilla 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- Google Translate usa el endpoint gratuito no oficial y puede tener límite de velocidad.

---

## 📄 Avisos de terceros

Este proyecto está inspirado en [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — el detector de bocadillos/texto y el inpainter LaMa entrenado con manga son sus exportaciones ONNX, y la lógica de inferencia está portada de él. (El OCR usa [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) de genshiai-daichi.)

Las bibliotecas incluidas, el código portado y los modelos descargados en tiempo de ejecución se enumeran con sus licencias en [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Licencia MIT — ver [LICENSE](LICENSE).
