# comic-translate-4-free

**Langue :** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

Lisez des mangas dans votre langue !
comic-translate-4-free traduit mangas et BD automatiquement. Il lit japonais, anglais, chinois simplifié/traditionnel (détection auto), et traduit vers 114 langues, remplaçant l'image sur place.

### 📸 Avant & Après

| Avant (japonais) | Après (français) |
| --- | --- |
| ![Page de manga japonaise d'origine](docs/images/wikipe-tan-original.jpg) | ![Traduit en français](docs/images/wikipe-tan-fr.jpg) |

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

*Illustration Wikipe-tan originale par Kasuga, tirée de [l'article Manga de Wikipédia](https://en.wikipedia.org/wiki/Manga) via Wikimedia Commons — sous licence [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Les captures traduites sont des œuvres dérivées modifiées de l'original.*

---

## ✨ Fonctionnalités

- **Traduction automatique** — ouvrez une page de manga sur un site autorisé et la version traduite apparaît sur place, sans avoir besoin de cliquer sur un bouton.
- **Clic droit sur n'importe quelle image** — choisissez « Envoyer vers comic-translate-4-free » pour traduire une image précise, même si elle est plus petite que la taille minimale.
- **114 langues cibles** via Google Translate, Azure Translator ou votre propre serveur local LM Studio.
- **Détection automatique de la langue source** — le japonais, l'anglais, le chinois simplifié/traditionnel sont identifiés automatiquement à partir du texte lu par OCR.
- **Prise en charge des longues bandes / webtoons** — les pages hautes sont traitées en segments qui se chevauchent pour que le texte reste net.
- **17 langues d'interface** — l'interface de l'extension suit le réglage de langue de votre navigateur.

### 🔒 Confidentialité

- **L'IA tourne sur votre machine.** La détection des bulles, l'OCR et l'inpainting tournent tous localement dans votre navigateur. La détection et l'OCR tournent via WebAssembly. L'inpainting tourne sur GPU dans Chrome (avec repli WebAssembly), et via WebAssembly dans Firefox. Vos pages ne quittent jamais votre appareil.
- **Seul le texte traduit est envoyé** — seules les chaînes extraites vont vers le service de traduction que vous choisissez (Google / Azure / votre LM Studio local).
- **Aucun compte, aucun suivi, aucune télémétrie.** Tous les réglages et modèles en cache restent dans le stockage local de votre navigateur.

---

## 🚀 Installation

**Chrome / Edge / Brave :**

[**Installer depuis le Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — en un clic, avec mises à jour automatiques.

**Firefox :**

[**Installer depuis Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — en un clic, mises à jour automatiques.

Après l'installation, ouvrez la page Paramètres et cliquez une fois sur **Télécharger tous les modèles** (~350 Mo : détecteur, OCR, inpainter). Ils sont mis en cache dans le navigateur et vérifiés par taille en octets.

![Téléchargement des modèles depuis la page des réglages](docs/images/options-models.png)

---

## 💡 Comment l'utiliser

1. **Autorisez d'abord le site** — cliquez sur l'icône de l'extension et appuyez sur **Autoriser ce site** (ou activez **Autoriser tous les sites**). La traduction ne s'exécute que là où vous avez accordé l'autorisation.

   ![Autoriser le site depuis la fenêtre popup](docs/images/popup.png)

2. **Rechargez la page de manga** — elle commence à traduire automatiquement quand la page se charge. Une pastille en haut à droite montre la progression en direct (Capturing → Detecting → OCR → …).
3. **Terminé** — l'image de la page est remplacée sur place par la version traduite.

**Conseils :**
- Clic droit sur n'importe quelle image → **Envoyer vers comic-translate-4-free** pour traduire juste cette image.

  ![Clic droit pour envoyer une image](docs/images/right-click.png)

- Si un site bloque les téléchargements (HTTP 403), l'extension réessaie automatiquement via un onglet en arrière-plan.
- Choisissez votre moteur de traduction dans Paramètres : Google (gratuit, sans clé), Azure Translator (demandez les clés ci-dessous — 2 millions de caractères/mois gratuits) ou LM Studio (serveur local).
- Activez le **Mode débogage** (inspecteur d'étapes) dans Paramètres pour inspecter chaque étape du pipeline.

---

## 🔑 Demander un compte Microsoft Azure

Pour utiliser Azure Translator comme moteur de traduction :

1. Créez un compte Microsoft/hotmail/Azure ou connectez-vous
2. Créez un abonnement Azure
3. Créez une ressource Azure Translator
4. Sélectionnez le niveau de tarification F0 (gratuit) — 2 millions de caractères/mois, sans expiration
5. Gestion des ressources → Clés et point de terminaison → copiez **KEY 1** et **Location/Region**
6. Collez-les dans la page Paramètres de l'extension

---

## ❤️ Soutenez ce projet

Si cette extension vous est utile, pensez à soutenir son développement :

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Problèmes connus

- **Pas encore d'OCR coréen** — les langues sources sont le japonais, l'anglais et le chinois simplifié/traditionnel. (Le coréen reste disponible comme langue de traduction.)
- **Une image par page** pour la traduction automatique (l'image principale de la page). Utilisez clic droit → Envoyer pour traduire les autres.
- **Grosses sessions** — traduire des dizaines d'images en une session peut faire planter le navigateur. Videz le cache de la page dans Paramètres si cela arrive.
- **Firefox** — les modèles tournent dans la page d'arrière-plan (sans documents offscreen), en partageant la mémoire avec tout le reste. Redémarrez le navigateur si vous voyez « no available backend found ».
- **Firefox est plus lent que Chrome** — les extensions Firefox ne peuvent pas utiliser la mémoire partagée pour le multithreading (SharedArrayBuffer), donc le modèle tourne sur un seul thread CPU. C'est une limite de la plateforme Firefox, pas un bug de l'extension. ([Bug Mozilla 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- Google Translate utilise le point de terminaison gratuit non officiel et peut être limité en débit.

---

## 📄 Avis de tiers

Ce projet s'inspire de [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — le détecteur de bulles/texte et l'inpainter LaMa entraîné sur le manga sont ses exports ONNX, et la logique d'inférence en est portée. (L'OCR utilise [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) de genshiai-daichi.)

Les bibliothèques incluses, le code porté et les modèles téléchargés à l'exécution sont listés avec leurs licences dans [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Licence MIT — voir [LICENSE](LICENSE).
