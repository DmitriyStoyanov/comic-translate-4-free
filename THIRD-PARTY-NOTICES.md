# Third-Party Notices

This file lists the third-party software used by the comic-translate-4-free
extension: libraries bundled with it, code it was ported from, and ML models
it downloads at runtime. The extension's own code is separate from these
components.

## 1. Bundled libraries (shipped inside the extension package)

### onnxruntime-web v1.30.0
- What: ONNX model inference in the browser (WASM).
- Where: `src/offscreen/vendor/ort.min.js`, `ort-wasm-simd-threaded.jsep.mjs`,
  `ort-wasm-simd-threaded.jsep.wasm`.
- Copyright: © Microsoft Corporation.
- License: **MIT License** (full text in §5 below). The license header is
  preserved at the top of `ort.min.js`.

## 2. Ported source code

The pipeline logic below was ported (rewritten in JavaScript for the browser)
from the following projects. Per the Apache-2.0 terms, the original licenses
and attributions are retained here, and each ported file carries a header
naming its source.

### ogkalu2/comic-translate — Apache License 2.0
https://github.com/ogkalu2/comic-translate — © ogkalu and contributors.

Ported files in this repository:
- `src/offscreen/ml/inpaint.js` — patch merging from
  `modules/inpainting/.../merge_overlapping_padded_boxes`
- `src/offscreen/ml/mask.js` — text-removal mask from
  `modules/detection/utils/content.py` (`detect_content_mask_in_bbox`)
- `src/offscreen/ml/detector.js` and `src/shared/textblock.js` — box geometry
  from `modules/detection/utils/geometry.py` (`shrink_bbox`,
  `merge_overlapping_boxes`) and `modules/utils/textblock.py`
- `src/content/content.js` — `shrink_bbox` semantics (inline attribution)
- `src/background/service-worker.js` — OCR crop-bounds logic (port of the
  Python `adjust_text_line_coordinates` usage in the OCR stage; inline
  attribution)

Changes vs. upstream: rewritten from Python to JavaScript, adapted to
ONNX Runtime Web tensors and the browser extension pipeline (no Python, no
PyTorch, no OpenCV).

### genshiai-daichi/baberu-ocr — Apache License 2.0
https://huggingface.co/genshiai-daichi/baberu-ocr — © the Baberu authors.
The model card is tagged `license:apache-2.0` and the repository carries an
Apache-2.0 LICENSE file.

Ported files in this repository:
- `src/offscreen/ml/baberu.js` — the ONNX inference loop, a faithful port of
  the repository's `onnx_infer.py` (pure-numpy host loop: crop preprocessing,
  prefill + autoregressive decode with KV cache, repetition penalty 1.2,
  symbol-aware content-run cap)

Changes vs. upstream: rewritten from Python/NumPy to JavaScript, adapted to
ONNX Runtime Web tensors.

### PaddlePaddle/PaddleOCR — Apache License 2.0
https://github.com/PaddleOCR/PaddleOCR — © PaddlePaddle contributors.

Ported files in this repository:
- `src/offscreen/ml/ppocr.js` — PP-OCRv5/v6 recognition inference preprocessing
  (RecResizeImg + NormalizeImage) and CTC greedy decode (CTCLabelDecode,
  including the `use_space_char` trailing-space class), verified against
  PaddlePaddle's official PP-OCRv5 inference config; the line splitting for
  multi-line crops, the diacritic-box merge, and the light-on-dark polarity
  normalization are this repo's own code (shared/image-ops components +
  vertical-overlap grouping), not upstream.

Changes vs. upstream: rewritten from Python to JavaScript, adapted to
ONNX Runtime Web tensors; no detection model (crops come from our detector).

### jameslee0623/ComicTranslate — author's own project
- `src/background/translators.js` — LM Studio reply parsing ported from
  `lensLocalEngine.js` in the author's own public repository
  https://github.com/jameslee0623/ComicTranslate. No third-party obligation;
  listed here for provenance.

## 3. ML models and data (downloaded at runtime or bundled as data, NOT part of the extension's code)

The extension downloads the ONNX model files on first use into the browser's
IndexedDB and never bundles them in the repository or the release zips. The
character dictionaries/vocabularies below ARE bundled (they are small data
files, a few KB to ~130 KB). Their licenses belong to their publishers:

| Model / data | Source | License |
|---|---|---|
| Bubble/text detector (`detector-v4-s_int8.onnx`) | `ogkalu/comic-text-and-bubble-detector` — RT-DETR-v2 r50vd fine-tuned on ~11k manga/webtoon/manhua/western-comic images | **Apache-2.0** (license tag on the model card) |
| Manga inpainter (`lama-manga-dynamic.onnx`) | `ogkalu/lama-manga-onnx-dynamic` — ONNX export of dreMaz/AnimeMangaInpainting | **Apache-2.0** (license tag on the model card); upstream dreMaz/AnimeMangaInpainting card is **MIT**-tagged (lineage: advimman/lama, Apache-2.0) |
| Baberu OCR (`vision_int4.onnx`, `decoder_prefill_int8.onnx`, `decoder_step_int8.onnx`) — Japanese, English, Simplified/Traditional Chinese | `genshiai-daichi/baberu-ocr` — manga-bubble-trained character OCR | **Apache-2.0** (license tag on the model card; LICENSE file in the repo) |
| Baberu character vocab (`src/offscreen/ml/dicts/baberu-vocab.json`, bundled) | `tokenizer/vocab.json` from `genshiai-daichi/baberu-ocr` | **Apache-2.0** |
| Latin OCR (`inference.onnx`, used when the source language is Italian, German, French, Spanish, Portuguese, Dutch, Danish, or Norwegian) | `PaddlePaddle/PP-OCRv6_small_rec_onnx` — official ONNX export of PP-OCRv6 small rec | **Apache-2.0** (PaddlePaddle/PaddleOCR) |
| PP-OCR latin dict (`src/offscreen/ml/dicts/ppocr-latin.txt`, bundled) | `languages/latin/dict.txt` shipped with the matching `rec.onnx` in `monkt/paddleocr-onnx` (**Apache-2.0**; byte-identical to the repo's dict on 2026-11-07) | **Apache-2.0** |

## 4. Not used / not shipped

The following Python packages are dependencies of the desktop
ogkalu2/comic-translate app and are **not** used anywhere in this browser
extension (it is pure JavaScript, no Python): py7zr, PySide6, certifi,
pypdfium2, Shapely/GEOS.

**WebLLM** (`@mlc-ai/web-llm`): listed in the source tree's dev `package.json`
but **not bundled** — the `localLlm()` backend throws ("removed from this
build") and the UI maps a stored `local-llm` setting to Google Translate.
No WebLLM code ships in the extension package.

Translation backends (Google free translate endpoint, Azure Translator,
LM Studio local server) are remote services or user-supplied models,
not redistributed software.

---

## 5. MIT License (onnxruntime-web)

Copyright (c) Microsoft Corporation. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 6. Apache License 2.0 (comic-translate, baberu-ocr, RT-DETRv2, LaMa, PaddleOCR)

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.


---

## Bundled render fonts (fonts/*.woff2)

Used only to draw the translated text onto the image (served by the service
worker, loaded by the content script as "CT Sans" / "CT Serif").

- **Noto Sans** and **Noto Serif**, regular (400) and bold (700), Latin / Latin-Extended /
  Cyrillic / Cyrillic-Extended / Vietnamese subsets. Copyright 2022 The Noto Project
  Authors (https://github.com/notofonts/latin-greek-cyrillic). Licensed under the
  SIL Open Font License, Version 1.1 (full text: `fonts/LICENSE-NotoSans-OFL.txt`,
  `fonts/LICENSE-NotoSerif-OFL.txt`). Subsets via the `@fontsource/noto-sans` and
  `@fontsource/noto-serif` packages (same license). The fonts are unmodified and are
  not sold on their own.

---

## Italian word list (src/shared/it-words.js)

Used to repair Italian OCR output (glued words, lost accents).

- The 24,000 most frequent word forms of the Italian OpenSubtitles-2018 frequency list from
  **FrequencyWords** by Hermit Dave (https://github.com/hermitdave/FrequencyWords), derived
  from OpenSubtitles (http://www.opensubtitles.org/). Content licensed under
  CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Only the word order was kept;
  the list was filtered to lower-case alphabetic words.
