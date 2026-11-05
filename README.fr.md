# comic-translate-4-free

**Langue :** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

Lisez vos mangas dans votre langue — directement dans le navigateur.

comic-translate-4-free traduit automatiquement les pages de mangas et de bandes dessinées pendant votre navigation. Il lit le japonais, l'anglais, le chinois simplifié et traditionnel (avec détection automatique), et traduit vers 114 langues. Ouvrez une page, et la version traduite remplace l'image d'origine en place — des bulles remplies dans votre langue.

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

- **Traduction automatique** — ouvrez une page de manga sur un site autorisé et la version traduite apparaît en place, sans cliquer sur aucun bouton.
- **Clic droit sur n'importe quelle image** — choisissez « Send to comic-translate-4-free » pour traduire une image précise, même plus petite que la taille minimale.
- **114 langues cibles** via Google Translate, Azure Translator ou votre propre serveur local LM Studio.
- **Détection automatique de la langue source** — le japonais, l'anglais et le chinois simplifié/traditionnel sont identifiés automatiquement à partir du texte reconnu par OCR.
- **Prise en charge des bandes longues / webtoons** — les pages très hautes sont traitées en segments qui se chevauchent pour que le texte reste net.
- **17 langues d'interface** — l'interface de l'extension suit le réglage de langue de votre navigateur.

### 🔒 Confidentialité

- **L'IA tourne sur votre machine.** La détection des bulles, la reconnaissance optique de caractères (OCR) et l'inpainting s'exécutent localement dans votre navigateur via WebAssembly. Vos pages ne quittent jamais votre appareil.
- **Seul le texte traduit est envoyé** — seules les chaînes extraites sont transmises au service de traduction que vous choisissez (Google / Azure / votre LM Studio local).
- **Ni compte, ni suivi, ni télémétrie.** Tous vos réglages et les modèles mis en cache restent dans le stockage local de votre navigateur.

---

## 🚀 Installation

**Chrome / Edge / Brave :**

[**Installer depuis le Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — en un clic, avec mises à jour automatiques.

**Firefox :**

[**Installer depuis Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — en un clic, mises à jour automatiques.

Après l'installation, ouvrez la page des réglages et cliquez une fois sur **Télécharger tous les modèles** (~350 Mo : détecteur, OCR, inpainter). Ils sont mis en cache dans le navigateur et vérifiés par taille d'octets.

![Téléchargement des modèles depuis la page des réglages](docs/images/options-models.png)

---

## 💡 Mode d'emploi

1. **Autorisez d'abord le site** — cliquez sur l'icône de l'extension et appuyez sur **Autoriser ce site** (ou activez **Autoriser tous les sites**). La traduction ne s'exécute que là où vous avez accordé l'autorisation.

   ![Autoriser le site depuis la fenêtre popup](docs/images/popup.png)

2. **Rechargez la page de manga** — la traduction démarre automatiquement au chargement de la page. Une pastille en haut à droite affiche la progression en direct (Capturing → Detecting → OCR → …).
3. **C'est fait** — l'image de la page est remplacée en place par la version traduite.

**Astuces :**
- Clic droit sur n'importe quelle image → **Envoyer vers comic-translate-4-free** pour ne traduire que cette image.

  ![Clic droit pour envoyer une image](docs/images/right-click.png)

- Si un site bloque les téléchargements (HTTP 403), l'extension réessaie automatiquement via un onglet d'arrière-plan.
- Choisissez votre moteur de traduction dans les réglages : Google (gratuit, sans clé), Azure Translator (demandez vos clés ci-dessous — 2 millions de caractères/mois gratuits) ou LM Studio (serveur local).
- Activez **Mode débogage** dans les réglages pour inspecter chaque étape du pipeline.

---

## 🔑 Demander un compte Microsoft Azure

Pour utiliser Azure Translator comme moteur de traduction :

1. Créez un compte Microsoft/hotmail/Azure ou connectez-vous
2. Créez un abonnement Azure
3. Créez une ressource Azure Translator
4. Sélectionnez la formule F0 (gratuite) — 2 millions de caractères/mois, sans expiration
5. Gestion des ressources → Clés et point de terminaison → copiez **KEY 1** et **Location/Region**
6. Collez-les dans la page des réglages de l'extension

---

## ❤️ Soutenez ce projet

Si cette extension vous est utile, pensez à soutenir son développement :

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Problèmes connus

- **Pas encore d'OCR pour le coréen** — les langues sources sont le japonais, l'anglais et le chinois simplifié/traditionnel. (Le coréen reste disponible comme langue cible.)
- **Une image par page** pour la traduction automatique (l'image principale de la page). Utilisez le clic droit → Send pour traduire les autres.
- **Sessions volumineuses** — traduire des dizaines d'images en une seule session peut faire planter le navigateur. Videz le cache de pages dans les réglages si cela se produit.
- **Firefox** — les modèles tournent dans la page d'arrière-plan (pas de documents offscreen) et partagent la mémoire avec tout le reste. Redémarrez le navigateur si vous voyez « no available backend found ».
- Google Translate utilise le point de terminaison gratuit non officiel et peut être limité en débit.

---

## 📄 Mentions relatives aux logiciels tiers

Ce projet est inspiré de [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — le détecteur de bulles/texte et l'inpainter LaMa entraîné pour le manga sont ses exports ONNX, et la logique d'inférence en est portée. (L'OCR utilise [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) par genshiai-daichi.)

Les bibliothèques intégrées, le code porté et les modèles téléchargés à l'exécution sont listés avec leurs licences dans [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Licence MIT — voir [LICENSE](LICENSE).
