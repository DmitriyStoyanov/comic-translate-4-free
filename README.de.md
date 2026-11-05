# comic-translate-4-free

**Sprache:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

Lies Manga in deiner Sprache!
comic-translate-4-free übersetzt Manga und Comics automatisch. Es liest Japanisch, Englisch, Vereinfachtes/Traditionelles Chinesisch (Auto-Erkennung) und übersetzt in 114 Sprachen, ersetzt das Bild an Ort und Stelle.

### 📸 Vorher & Nachher

| Vorher (Japanisch) | Nachher (Deutsch) |
| --- | --- |
| ![Japanische Manga-Originalseite](docs/images/wikipe-tan-original.jpg) | ![Ins Deutsche übersetzt](docs/images/wikipe-tan-de.jpg) |

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

*Original-Wikipe-tan-Illustration von Kasuga, aus [Wikipedias Manga-Artikel](https://en.wikipedia.org/wiki/Manga) via Wikimedia Commons — lizenziert unter [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Die übersetzten Screenshots sind bearbeitete abgeleitete Werke des Originals.*

---

## ✨ Funktionen

- **Automatische Übersetzung** — öffne eine Mangaseite auf einer erlaubten Website, und die übersetzte Version erscheint an Ort und Stelle, ganz ohne Klick.
- **Rechtsklick auf ein beliebiges Bild** — wähle „An comic-translate-4-free senden“, um ein bestimmtes Bild zu übersetzen, auch wenn es kleiner als die Mindestgröße ist.
- **114 Zielsprachen** über Google Translate, Azure Translator oder deinen eigenen lokalen LM-Studio-Server.
- **Automatische Quellspracherkennung** — Japanisch, Englisch, Vereinfachtes/Traditionelles Chinesisch werden automatisch aus dem per OCR gelesenen Text erkannt.
- **Unterstützung für lange Strips / Webtoons** — hohe Seiten werden in überlappenden Abschnitten verarbeitet, damit der Text scharf bleibt.
- **17 UI-Sprachen** — die Oberfläche der Erweiterung folgt der Spracheinstellung deines Browsers.

### 🔒 Datenschutz

- **Die KI läuft auf deinem Rechner.** Blasenerkennung, OCR und Inpainting laufen alle lokal in deinem Browser. Erkennung und OCR laufen über WebAssembly. Inpainting läuft in Chrome auf der GPU (mit WebAssembly-Fallback) und in Firefox über WebAssembly. Deine Seiten verlassen dein Gerät nie.
- **Nur übersetzter Text wird nach außen gesendet** — nur die extrahierten Zeichenketten gehen an den Übersetzungsdienst deiner Wahl (Google / Azure / dein lokales LM Studio).
- **Kein Konto, kein Tracking, keine Telemetrie.** Alle Einstellungen und zwischengespeicherten Modelle bleiben im lokalen Speicher deines Browsers.

---

## 🚀 Installation

**Chrome / Edge / Brave:**

[**Im Chrome Web Store installieren**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — mit einem Klick und automatischen Updates.

**Firefox:**

[**Aus Firefox Add-ons installieren**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — ein Klick, automatische Updates.

Öffne nach der Installation die Einstellungen und klicke einmal auf **Alle Modelle herunterladen** (~350 MB: Detektor, OCR, Inpainter). Sie werden im Browser zwischengespeichert und anhand der Byte-Größe geprüft.

![Die Modelle von der Einstellungsseite herunterladen](docs/images/options-models.png)

---

## 💡 So benutzt du es

1. **Erlaube zuerst die Website** — klicke auf das Erweiterungssymbol und drücke **Diese Website zulassen** (oder aktiviere **Alle Websites zulassen**). Die Übersetzung läuft nur dort, wo du die Erlaubnis erteilt hast.

   ![Die Website über das Popup freigeben](docs/images/popup.png)

2. **Lade die Mangaseite neu** — sie beginnt automatisch zu übersetzen, sobald die Seite lädt. Eine Pille oben rechts zeigt den Live-Fortschritt (Capturing → Detecting → OCR → …).
3. **Fertig** — das Bild der Seite wird an Ort und Stelle durch die übersetzte Version ersetzt.

**Tipps:**
- Rechtsklick auf ein beliebiges Bild → **An comic-translate-4-free senden**, um nur dieses Bild zu übersetzen.

  ![Rechtsklick, um ein Bild zu senden](docs/images/right-click.png)

- Wenn eine Website Downloads blockiert (HTTP 403), versucht es die Erweiterung automatisch über einen Hintergrund-Tab erneut.
- Wähle deine Übersetzungs-Engine in den Einstellungen: Google (kostenlos, kein Schlüssel), Azure Translator (Schlüssel unten beantragen — 2 Mio. Zeichen/Monat kostenlos) oder LM Studio (lokaler Server).
- Aktiviere den **Debug-Modus** (Stufen-Inspektor) in den Einstellungen, um jede Pipeline-Stufe zu prüfen.

---

## 🔑 Microsoft-Azure-Konto beantragen

Um Azure Translator als Übersetzungs-Engine zu verwenden:

1. Microsoft-/Hotmail-/Azure-Konto erstellen oder anmelden
2. Azure-Abonnement erstellen
3. Azure-Translator-Ressource erstellen
4. Preistarif F0 (kostenlos) auswählen — 2 Mio. Zeichen/Monat, läuft nicht ab
5. Ressourcenverwaltung → Schlüssel und Endpunkt → **KEY 1** und **Location/Region** kopieren
6. In die Einstellungsseite der Erweiterung einfügen

---

## ❤️ Unterstütze dieses Projekt

Wenn dir diese Erweiterung nützlich ist, erwäge, ihre Entwicklung zu unterstützen:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Bekannte Probleme

- **Noch kein koreanisches OCR** — Quellsprachen sind Japanisch, Englisch und Vereinfachtes/Traditionelles Chinesisch. (Koreanisch bleibt als Übersetzungssprache verfügbar.)
- **Ein Bild pro Seite** für die automatische Übersetzung (das Hauptbild der Seite). Verwende Rechtsklick → Senden, um andere zu übersetzen.
- **Große Sitzungen** — das Übersetzen von Dutzenden Bildern in einer Sitzung kann den Browser zum Absturz bringen. Leere in diesem Fall den Seiten-Cache in den Einstellungen.
- **Firefox** — die Modelle laufen auf der Hintergrundseite (ohne Offscreen-Dokumente) und teilen sich den Speicher mit allem anderen. Starte den Browser neu, wenn du „no available backend found“ siehst.
- **Firefox ist langsamer als Chrome** — Firefox-Erweiterungen können keinen gemeinsamen Speicher für Multithreading (SharedArrayBuffer) verwenden, daher läuft das Modell auf einem einzigen CPU-Thread. Das ist eine Grenze der Firefox-Plattform, kein Fehler der Erweiterung. ([Mozilla-Bug 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- Google Translate nutzt den inoffiziellen kostenlosen Endpunkt und kann ratenbegrenzt sein.

---

## 📄 Hinweise zu Drittanbietern

Dieses Projekt ist inspiriert von [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — der Blasen-/Textdetektor und der manga-trainierte LaMa-Inpainter sind dessen ONNX-Exporte, und die Inferenzlogik ist daraus portiert. (OCR verwendet [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) von genshiai-daichi.)

Gebündelte Bibliotheken, portierter Code und zur Laufzeit heruntergeladene Modelle sind mit ihren Lizenzen in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) aufgeführt.

MIT-Lizenz — siehe [LICENSE](LICENSE).
