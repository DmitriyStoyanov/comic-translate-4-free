# comic-translate-4-free

**Sprache:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

Lesen Sie Manga in Ihrer Sprache — direkt im Browser.

comic-translate-4-free übersetzt Manga- und Comicseiten beim Surfen automatisch. Es liest Japanisch, Englisch, Vereinfachtes und Traditionelles Chinesisch (mit automatischer Erkennung) und übersetzt in 114 Sprachen. Öffnen Sie eine Seite, und die übersetzte Version ersetzt das Originalbild direkt an Ort und Stelle — Sprechblasen, gefüllt mit Ihrer Sprache.

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

- **Automatische Übersetzung** — Öffnen Sie eine Manga-Seite auf einer zugelassenen Website, und die übersetzte Version erscheint direkt an Ort und Stelle, ganz ohne Klick.
- **Rechtsklick auf jedes Bild** — wählen Sie „Send to comic-translate-4-free", um ein bestimmtes Bild zu übersetzen, selbst wenn es kleiner als die Mindestgröße ist.
- **114 Zielsprachen** über Google Translate, Azure Translator oder Ihren eigenen lokalen LM-Studio-Server.
- **Automatische Spracherkennung** — Japanisch, Englisch sowie Vereinfachtes/Traditionelles Chinesisch werden automatisch aus dem per OCR erkannten Text identifiziert.
- **Long-Strip-/Webtoon-Unterstützung** — sehr hohe Seiten werden in überlappenden Segmenten verarbeitet, damit der Text scharf bleibt.
- **17 UI-Sprachen** — die Benutzeroberfläche der Erweiterung folgt der Spracheinstellung Ihres Browsers.

### 🔒 Datenschutz

- **Die KI läuft auf Ihrem Rechner.** Sprechblasenerkennung, OCR und Inpainting laufen lokal in Ihrem Browser per WebAssembly. Ihre Seiten verlassen niemals Ihr Gerät.
- **Nur der übersetzte Text wird gesendet** — lediglich die extrahierten Zeichenfolgen gehen an den von Ihnen gewählten Übersetzungsdienst (Google / Azure / Ihr lokales LM Studio).
- **Kein Konto, kein Tracking, keine Telemetrie.** Alle Einstellungen und zwischengespeicherten Modelle bleiben im lokalen Speicher Ihres Browsers.

---

## 🚀 Installation

**Chrome / Edge / Brave:**

[**Im Chrome Web Store installieren**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — mit einem Klick und automatischen Updates.

**Firefox:**

[**Aus Firefox Add-ons installieren**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — ein Klick, automatische Updates.

Öffnen Sie nach der Installation die Einstellungsseite und klicken Sie einmal auf **Alle Modelle herunterladen** (~350 MB: Detektor, OCR, Inpainter). Sie werden im Browser zwischengespeichert und anhand der Byte-Größe verifiziert.

![Die Modelle von der Einstellungsseite herunterladen](docs/images/options-models.png)

---

## 💡 Verwendung

1. **Zuerst die Website freigeben** — klicken Sie auf das Erweiterungssymbol und drücken Sie **Diese Website zulassen** (oder aktivieren Sie **Alle Websites zulassen**). Die Übersetzung läuft nur dort, wo Sie die Berechtigung erteilt haben.

   ![Die Website über das Popup freigeben](docs/images/popup.png)

2. **Manga-Seite neu laden** — beim Laden der Seite beginnt die Übersetzung automatisch. Eine Pille oben rechts zeigt den Live-Fortschritt (Capturing → Detecting → OCR → …).
3. **Fertig** — das Bild der Seite wird direkt durch die übersetzte Version ersetzt.

**Tipps:**
- Rechtsklick auf ein beliebiges Bild → **An comic-translate-4-free senden**, um nur dieses Bild zu übersetzen.

  ![Rechtsklick, um ein Bild zu senden](docs/images/right-click.png)

- Blockiert eine Website Downloads (HTTP 403), versucht es die Erweiterung automatisch über einen Hintergrund-Tab erneut.
- Wählen Sie Ihre Übersetzungs-Engine in den Einstellungen: Google (kostenlos, kein Schlüssel), Azure Translator (Schlüssel unten beantragen — 2 Mio. Zeichen/Monat kostenlos) oder LM Studio (lokaler Server).
- Aktivieren Sie den **Debug-Modus** in den Einstellungen, um jede Pipeline-Stufe zu prüfen.

---

## 🔑 Ein Microsoft-Azure-Konto beantragen

Um Azure Translator als Übersetzungs-Engine zu verwenden:

1. Ein Microsoft-/Hotmail-/Azure-Konto erstellen oder sich anmelden
2. Ein Azure-Abonnement erstellen
3. Eine Azure-Translator-Ressource erstellen
4. Die Preisstufe F0 (kostenlos) wählen — 2 Millionen Zeichen/Monat, läuft nicht ab
5. Ressourcenverwaltung → Schlüssel und Endpunkt → **KEY 1** und **Location/Region** kopieren
6. Beides auf der Einstellungsseite der Erweiterung einfügen

---

## ❤️ Dieses Projekt unterstützen

Wenn Ihnen diese Erweiterung nützlich ist, unterstützen Sie bitte ihre Weiterentwicklung:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Bekannte Probleme

- **Noch kein koreanisches OCR** — Quellsprachen sind Japanisch, Englisch sowie Vereinfachtes/Traditionelles Chinesisch. (Koreanisch bleibt als Übersetzungsziel verfügbar.)
- **Ein Bild pro Seite** für die automatische Übersetzung (das Hauptbild der Seite). Verwenden Sie Rechtsklick → Senden, um andere zu übersetzen.
- **Große Sitzungen** — die Übersetzung von Dutzenden Bildern in einer Sitzung kann den Browser zum Absturz bringen. Leeren Sie in diesem Fall den Seitencache in den Einstellungen.
- **Firefox** — die Modelle laufen auf der Hintergrundseite (keine Offscreen-Dokumente) und teilen sich den Speicher mit allem anderen. Starten Sie den Browser neu, wenn Sie „no available backend found" sehen.
- Google Translate nutzt den inoffiziellen kostenlosen Endpunkt und kann gedrosselt werden.

---

## 📄 Hinweise zu Drittanbieter-Software

Dieses Projekt ist inspiriert von [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — der Sprechblasen-/Texterkenner und der Manga-finetunede LaMa-Inpainter sind dessen ONNX-Exporte, und die Inferenzlogik ist daraus portiert. (OCR verwendet [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) von genshiai-daichi.)

Mitgelieferte Bibliotheken, portierter Code und zur Laufzeit heruntergeladene Modelle sind mit ihren Lizenzen in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) aufgeführt.

MIT-Lizenz — siehe [LICENSE](LICENSE).
