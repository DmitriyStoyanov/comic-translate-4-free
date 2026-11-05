# comic-translate-4-free

**언어:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

만화를 당신의 언어로 — 브라우저에서 바로 읽으세요.

comic-translate-4-free는 웹 서핑 중 만화와 코믹 페이지를 자동으로 번역합니다. 일본어, 영어, 중국어 간체·번체를 읽을 수 있으며(자동 감지), 114개 언어로 번역할 수 있습니다. 페이지를 열기만 하면 번역된 이미지가 원본 이미지를 그 자리에서 대체합니다 — 말풍선이 당신의 언어로 채워집니다.

### 📸 전 / 후

| 전 (일본어) | 후 (한국어) |
| --- | --- |
| ![원본 일본어 만화 페이지](docs/images/wikipe-tan-original.jpg) | ![한국어로 번역된 결과](docs/images/wikipe-tan-ko.jpg) |

<details>
<summary>14개 언어로의 번역 결과 더 보기</summary>

| 힌디어 | 한국어 | 중국어(간체) |
| --- | --- | --- |
| ![힌디어](docs/images/wikipe-tan-hi.jpg) | ![한국어](docs/images/wikipe-tan-ko.jpg) | ![중국어(간체)](docs/images/wikipe-tan-zh-CN.jpg) |

| 중국어(번체) | 스페인어 | 아랍어 |
| --- | --- | --- |
| ![중국어(번체)](docs/images/wikipe-tan-zh-TW.jpg) | ![스페인어](docs/images/wikipe-tan-es.jpg) | ![아랍어](docs/images/wikipe-tan-ar.jpg) |

| 프랑스어 | 벵골어 | 포르투갈어 |
| --- | --- | --- |
| ![프랑스어](docs/images/wikipe-tan-fr.jpg) | ![벵골어](docs/images/wikipe-tan-bn.jpg) | ![포르투갈어](docs/images/wikipe-tan-pt.jpg) |

| 러시아어 | 베트남어 | 인도네시아어 |
| --- | --- | --- |
| ![러시아어](docs/images/wikipe-tan-ru.jpg) | ![베트남어](docs/images/wikipe-tan-vi.jpg) | ![인도네시아어](docs/images/wikipe-tan-id.jpg) |

| 우르두어 | 독일어 |
| --- | --- |
| ![우르두어](docs/images/wikipe-tan-ur.jpg) | ![독일어](docs/images/wikipe-tan-de.jpg) |

</details>

*Kasuga가 그린 원본 Wikipe-tan 일러스트([Wikipedia의 Manga 문서](https://en.wikipedia.org/wiki/Manga), Wikimedia Commons 경유) — [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 라이선스. 번역된 스크린샷은 원본을 수정한 2차적 저작물입니다.*

---

## ✨ 기능

- **자동 번역** — 허용된 사이트에서 만화 페이지를 열면 버튼 클릭 없이 번역된 버전이 그 자리에 나타납니다.
- **이미지 우클릭** — "Send to comic-translate-4-free"를 선택하면 특정 이미지만 번역할 수 있습니다. 최소 크기보다 작은 이미지도 가능합니다.
- **114개 목표 언어** — Google 번역, Azure Translator 또는 직접 운영하는 로컬 LM Studio 서버를 통해 번역합니다.
- **원본 언어 자동 감지** — OCR로 읽은 텍스트에서 일본어, 영어, 중국어 간체/번체를 자동으로 판별합니다.
- **세로로 긴 스트립/웹툰 지원** — 긴 페이지는 겹치는 구간으로 나누어 처리하므로 텍스트가 선명하게 유지됩니다.
- **17개 UI 언어** — 확장 프로그램 인터페이스는 브라우저의 언어 설정을 따릅니다.

### 🔒 개인정보 보호

- **AI는 당신의 기기에서 실행됩니다.** 말풍선 감지, OCR, 인페인팅은 모두 WebAssembly를 통해 브라우저 내에서 로컬로 실행됩니다. 페이지가 기기를 벗어나지 않습니다.
- **외부로 전송되는 것은 번역 텍스트뿐** — 추출된 문자열만 선택한 번역 서비스(Google / Azure / 로컬 LM Studio)로 전송됩니다.
- **계정 없음, 추적 없음, 텔레메트리 없음.** 모든 설정과 캐시된 모델은 브라우저 로컬 스토리지에 보관됩니다.

---

## 🚀 설치

**Chrome / Edge / Brave:**

[**Chrome 웹 스토어에서 설치**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — 한 번의 클릭으로 설치되며 자동 업데이트됩니다.

**Firefox:**

[**Firefox 부가 기능에서 설치**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — 한 번의 클릭으로, 자동 업데이트.

설치 후 설정 페이지를 열고 **모든 모델 다운로드**를 한 번 클릭하세요(약 350MB: 감지 모델, OCR, 인페인팅 모델). 모델은 브라우저에 캐시되며 바이트 크기로 검증됩니다.

![설정 페이지에서 모델 다운로드](docs/images/options-models.png)

---

## 💡 사용 방법

1. **먼저 사이트를 허용하세요** — 확장 프로그램 아이콘을 클릭하고 **이 사이트 허용**를 누르세요(**모든 사이트 허용** 활성화도 가능). 허가한 사이트에서만 번역이 실행됩니다.

   ![팝업에서 사이트 허용](docs/images/popup.png)

2. **만화 페이지를 새로고침하세요** — 페이지가 로드되면 번역이 자동으로 시작됩니다. 오른쪽 위의 표시가 실시간 진행 상황(Capturing → Detecting → OCR → …)을 보여줍니다.
3. **완료** — 페이지의 이미지가 그 자리에서 번역된 버전으로 교체됩니다.

**팁:**
- 아무 이미지나 우클릭 → **comic-translate-4-free로 보내기**를 선택하면 해당 이미지만 번역할 수 있습니다.

  ![이미지 우클릭으로 전송](docs/images/right-click.png)

- 사이트에서 다운로드를 차단하는 경우(HTTP 403), 확장 프로그램이 백그라운드 탭을 통해 자동으로 다시 시도합니다.
- 설정에서 번역 엔진을 선택할 수 있습니다: Google(무료, 키 불필요), Azure Translator(아래에서 키 신청 — 월 200만 자 무료), LM Studio(로컬 서버).
- 설정에서 **디버그 모드**를 켜면 파이프라인의 모든 단계를 확인할 수 있습니다.

---

## 🔑 Microsoft Azure 계정 신청하기

Azure Translator를 번역 엔진으로 사용하려면:

1. Microsoft/hotmail/Azure 계정을 만들거나 로그인합니다
2. Azure 구독을 만듭니다
3. Azure Translator 리소스를 만듭니다
4. F0(무료) 요금제를 선택합니다 — 월 200만 자, 만료 없음
5. 리소스 관리 → 키 및 엔드포인트 → **KEY 1**과 **Location/Region**을 복사합니다
6. 확장 프로그램 설정 페이지에 붙여넣습니다

---

## ❤️ 이 프로젝트 지원하기

이 확장 프로그램이 유용하셨다면 개발 지원을 고려해 주세요:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ 알려진 문제

- **아직 한국어 OCR 미지원** — 원본 언어는 일본어, 영어, 중국어 간체/번체만 지원됩니다. (한국어는 번역 목표 언어로 선택할 수 있습니다.)
- 자동 번역은 **페이지당 하나의 이미지**(페이지의 주 이미지)만 처리합니다. 다른 이미지는 우클릭 → Send로 번역하세요.
- **긴 세션** — 한 세션에서 수십 개의 이미지를 번역하면 브라우저가 충돌할 수 있습니다. 이 경우 설정에서 페이지 캐시를 지우세요.
- **Firefox** — 모델은 백그라운드 페이지에서 실행됩니다(오프스크린 문서 없음). "no available backend found"가 표시되면 브라우저를 다시 시작하세요.
- Google 번역은 비공식 무료 엔드포인트를 사용하므로 요청 제한에 걸릴 수 있습니다.

---

## 📄 타사 고지

이 프로젝트는 [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate)에서 영감을 받았습니다 — 말풍선/텍스트 감지 모델과 만화용으로 파인튜닝된 LaMa 인페인팅 모델은 해당 프로젝트의 ONNX 익스포트이며, 추론 로직도 이식한 것입니다. (OCR은 genshiai-daichi의 [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr)를 사용합니다.)

포함된 라이브러리, 이식된 코드, 실행 시 다운로드되는 모델은 라이선스와 함께 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)에 기재되어 있습니다.

MIT License — [LICENSE](LICENSE)를 참조하세요.
