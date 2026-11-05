# comic-translate-4-free

**Language:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

Leia mangá no seu idioma!
comic-translate-4-free traduz mangá e quadrinhos automaticamente enquanto você navega. Ele lê japonês, inglês, chinês simplificado/tradicional (detecção automática) e traduz para 114 idiomas, substituindo a imagem no lugar.

### 📸 Antes e depois

| Antes (japonês) | Depois (português) |
| --- | --- |
| ![Página de mangá original em japonês](docs/images/wikipe-tan-original.jpg) | ![Traduzida para o português](docs/images/wikipe-tan-pt.jpg) |

<details>
<summary>Ver traduções em mais 14 idiomas</summary>

| hindi | coreano | chinês simplificado |
| --- | --- | --- |
| ![Hindi](docs/images/wikipe-tan-hi.jpg) | ![Korean](docs/images/wikipe-tan-ko.jpg) | ![Simplified Chinese](docs/images/wikipe-tan-zh-CN.jpg) |

| chinês tradicional | espanhol | árabe |
| --- | --- | --- |
| ![Traditional Chinese](docs/images/wikipe-tan-zh-TW.jpg) | ![Spanish](docs/images/wikipe-tan-es.jpg) | ![Arabic](docs/images/wikipe-tan-ar.jpg) |

| francês | bengali | português |
| --- | --- | --- |
| ![French](docs/images/wikipe-tan-fr.jpg) | ![Bengali](docs/images/wikipe-tan-bn.jpg) | ![Portuguese](docs/images/wikipe-tan-pt.jpg) |

| russo | vietnamita | indonésio |
| --- | --- | --- |
| ![Russian](docs/images/wikipe-tan-ru.jpg) | ![Vietnamese](docs/images/wikipe-tan-vi.jpg) | ![Indonesian](docs/images/wikipe-tan-id.jpg) |

| urdu | alemão |
| --- | --- |
| ![Urdu](docs/images/wikipe-tan-ur.jpg) | ![German](docs/images/wikipe-tan-de.jpg) |

</details>

*Ilustração Wikipe-tan original por Kasuga, do [artigo Manga da Wikipedia](https://en.wikipedia.org/wiki/Manga) via Wikimedia Commons — licenciada sob [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). As capturas traduzidas são obras derivadas modificadas do original.*

---

## ✨ Recursos

- **Tradução automática** — abra uma página de mangá em um site permitido e a versão traduzida aparece no lugar, sem precisar clicar em nenhum botão.
- **Clique com o botão direito em qualquer imagem** — escolha "Enviar para comic-translate-4-free" para traduzir uma imagem específica, mesmo que seja menor que o tamanho mínimo.
- **114 idiomas de destino** via Google Translate, Azure Translator ou o seu próprio servidor local LM Studio.
- **Detecção automática do idioma de origem** — japonês, inglês, chinês simplificado/tradicional identificados automaticamente a partir do texto lido por OCR.
- **Suporte a tiras longas / webtoon** — páginas altas são processadas em segmentos sobrepostos para que o texto fique nítido.
- **17 idiomas de interface** — a interface da extensão segue a configuração de idioma do seu navegador.

### 🔒 Privacidade

- **A IA roda na sua máquina.** A detecção de balões, o OCR e o inpainting rodam todos localmente no seu navegador. A detecção e o OCR rodam via WebAssembly. O inpainting roda na GPU no Chrome (com fallback para WebAssembly) e via WebAssembly no Firefox. Suas páginas nunca saem do seu dispositivo.
- **Apenas o texto traduzido é enviado** — apenas as strings extraídas vão para o serviço de tradução que você escolher (Google / Azure / seu LM Studio local).
- **Sem conta, sem rastreamento, sem telemetria.** Todas as configurações e modelos em cache ficam no armazenamento local do seu navegador.

---

## 🚀 Instalação

**Chrome / Edge / Brave:**

[**Instalar da Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — um clique, atualizações automáticas.

**Firefox:**

[**Instalar do Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — um clique, atualizações automáticas.

Após instalar, abra a página de Configurações e clique uma vez em **Baixar todos os modelos** (~350 MB: detector, OCR, inpainter). Eles ficam em cache no navegador e são verificados pelo tamanho em bytes.

![Baixando os modelos na página de Configurações](docs/images/options-models.png)

---

## 💡 Como usar

1. **Permita o site primeiro** — clique no ícone da extensão e pressione **Permitir este site** (ou ative **Permitir todos os sites**). A tradução só roda onde você concedeu permissão.

   ![Permitindo o site pelo popup](docs/images/popup.png)

2. **Recarregue a página do mangá** — ela começa a traduzir automaticamente ao carregar. Uma pílula no canto superior direito mostra o progresso ao vivo (Capturing → Detecting → OCR → …).
3. **Pronto** — a imagem da página é substituída no lugar pela versão traduzida.

**Dicas:**
- Clique com o botão direito em qualquer imagem → **Enviar para comic-translate-4-free** para traduzir só aquela imagem.

  ![Clique com o botão direito para enviar uma imagem](docs/images/right-click.png)

- Se um site bloquear downloads (HTTP 403), a extensão tenta novamente automaticamente por meio de uma aba em segundo plano.
- Escolha seu mecanismo de tradução em Configurações: Google (grátis, sem chave), Azure Translator (solicite as chaves abaixo — 2 milhões de caracteres/mês grátis) ou LM Studio (servidor local).
- Ative o **Modo de depuração** (inspetor de etapas) em Configurações para inspecionar cada etapa do pipeline.

---

## 🔑 Solicitar uma conta do Microsoft Azure

Para usar o Azure Translator como mecanismo de tradução:

1. Crie uma conta Microsoft/hotmail/Azure ou faça login
2. Crie uma assinatura do Azure
3. Crie um recurso do Azure Translator
4. Selecione o nível de preços F0 (gratuito) — 2 milhões de caracteres/mês, não expira
5. Gerenciamento de recursos → Chaves e Ponto de extremidade → copie **KEY 1** e **Location/Region**
6. Cole-as na página de Configurações da extensão

---

## ❤️ Apoie este projeto

Se esta extensão for útil para você, considere apoiar seu desenvolvimento:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Problemas conhecidos

- **Ainda não há OCR de coreano** — os idiomas de origem são japonês, inglês e chinês simplificado/tradicional. (O coreano continua disponível como idioma de tradução.)
- **Uma imagem por página** para a tradução automática (a imagem principal da página). Use o botão direito → Enviar para traduzir as outras.
- **Sessões grandes** — traduzir dezenas de imagens em uma sessão pode travar o navegador. Limpe o cache da página em Configurações se isso acontecer.
- **Firefox** — os modelos rodam na página de fundo (sem documentos offscreen), compartilhando memória com todo o resto. Reinicie o navegador se vir "no available backend found".
- **O Firefox é mais lento que o Chrome** — as extensões do Firefox não podem usar memória compartilhada para multithreading (SharedArrayBuffer), então o modelo roda em um único thread de CPU. Isso é um limite da plataforma Firefox, não um bug da extensão. ([Bug da Mozilla 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- O Google Translate usa o endpoint gratuito não oficial e pode ter limite de taxa.

---

## 📄 Avisos de terceiros

Este projeto é inspirado em [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — o detector de balões/texto e o inpainter LaMa treinado com mangá são suas exportações ONNX, e a lógica de inferência foi portada dele. (O OCR usa [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) de genshiai-daichi.)

As bibliotecas incluídas, o código portado e os modelos baixados em tempo de execução estão listados com suas licenças em [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Licença MIT — ver [LICENSE](LICENSE).
