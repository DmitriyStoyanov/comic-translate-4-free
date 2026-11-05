# comic-translate-4-free

**Language:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

Leia mangás no seu idioma — direto no navegador.

O comic-translate-4-free traduz páginas de mangás e quadrinhos automaticamente enquanto você navega. Ele lê japonês, inglês, chinês simplificado e tradicional (com detecção automática) e traduz para 114 idiomas. Abra uma página e a versão traduzida substitui a imagem original no lugar — balões de fala preenchidos com o seu idioma.

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

- **Tradução automática** — abra uma página de mangá em um site permitido e a versão traduzida aparece no lugar, sem precisar clicar em botão.
- **Clique com o botão direito em qualquer imagem** — escolha "Send to comic-translate-4-free" para traduzir uma imagem específica, mesmo menor que o tamanho mínimo.
- **114 idiomas de destino** via Google Tradutor, Azure Translator ou seu próprio servidor LM Studio local.
- **Detecção automática do idioma de origem** — japonês, inglês, chinês simplificado/tradicional identificados automaticamente a partir do texto reconhecido pelo OCR.
- **Suporte a páginas longas / webtoon** — páginas altas são processadas em segmentos sobrepostos para manter o texto nítido.
- **17 idiomas na interface** — a interface da extensão acompanha o idioma do seu navegador.

### 🔒 Privacidade

- **A IA roda na sua máquina.** Detecção de balões, OCR e inpainting executam localmente no seu navegador via WebAssembly. Suas páginas nunca saem do seu dispositivo.
- **Só o texto traduzido é enviado** — apenas as strings extraídas vão para o serviço de tradução que você escolher (Google / Azure / seu LM Studio local).
- **Sem conta, sem rastreamento, sem telemetria.** Todas as configurações e modelos baixados ficam no armazenamento local do seu navegador.

---

## 🚀 Instalação

**Chrome / Edge / Brave:**

[**Instalar da Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — um clique, atualizações automáticas.

**Firefox:**

[**Instalar do Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — um clique, atualizações automáticas.

Após instalar, abra a página de Configurações e clique em **Download all models** uma vez (~350 MB: detector, OCR, inpainter). Eles ficam em cache no navegador e são verificados pelo tamanho em bytes.

![Baixando os modelos na página de Configurações](docs/images/options-models.png)

---

## 💡 Como usar

1. **Permita o site primeiro** — clique no ícone da extensão e pressione **Allow this site** (ou ative **ALLOW ALL SITES**). A tradução só roda onde você concedeu permissão.

   ![Permitindo o site pelo popup](docs/images/popup.png)

2. **Recarregue a página do mangá** — ela começa a traduzir automaticamente ao carregar. Uma pílula no canto superior direito mostra o progresso ao vivo (Capturando → Detectando → OCR → …).
3. **Pronto** — a imagem da página é substituída no lugar pela versão traduzida.

**Dicas:**
- Clique com o botão direito em qualquer imagem → **Send to comic-translate-4-free** para traduzir só aquela imagem.

  ![Clique com o botão direito para enviar uma imagem](docs/images/right-click.png)

- Se um site bloquear downloads (HTTP 403), a extensão tenta de novo automaticamente via uma aba em segundo plano.
- Escolha seu mecanismo de tradução nas Configurações: Google (grátis, sem chave), Azure Translator (peça as chaves abaixo — 2 milhões de caracteres/mês grátis) ou LM Studio (servidor local).
- Ative **Debug mode** nas Configurações para inspecionar cada etapa do pipeline.

---

## 🔑 Como criar uma conta Microsoft Azure

Para usar o Azure Translator como mecanismo de tradução:

1. Crie uma conta Microsoft/hotmail/Azure ou entre nela
2. Crie uma assinatura Azure
3. Crie um recurso do Azure Translator
4. Selecione o plano F0 (Gratuito) — 2 milhões de caracteres/mês, não expira
5. Gerenciamento de recursos → Chaves e Ponto de Extremidade → copie **KEY 1** e **Location/Region**
6. Cole-os na página de Configurações da extensão

---

## ❤️ Apoie este projeto

Se esta extensão for útil para você, considere apoiar o desenvolvimento dela:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Problemas conhecidos

- **Sem OCR de coreano ainda** — os idiomas de origem são japonês, inglês e chinês simplificado/tradicional. (O coreano continua disponível como idioma de destino.)
- **Uma imagem por página** na tradução automática (a imagem principal da página). Use o botão direito → Enviar para traduzir as outras.
- **Sessões grandes** — traduzir dezenas de imagens em uma sessão pode travar o navegador. Limpe o cache de páginas nas Configurações se isso acontecer.
- **Firefox** — os modelos rodam na página de segundo plano (sem offscreen documents), dividindo memória com todo o resto. Reinicie o navegador se vir "no available backend found".
- O Google Tradutor usa o endpoint gratuito não oficial e pode sofrer limitação de taxa.

---

## 📄 Avisos de terceiros

Este projeto foi inspirado em [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — o detector de balões/texto e o inpainter LaMa ajustado para mangás são suas exportações ONNX, e a lógica de inferência foi portada dele. (O OCR usa [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) de genshiai-daichi.)

As bibliotecas incluídas, o código portado e os modelos baixados em tempo de execução estão listados com suas licenças em [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Licença MIT — veja [LICENSE](LICENSE).
