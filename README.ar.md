# comic-translate-4-free

**اللغة:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

اقرأ المانغا بلغتك — مباشرة في المتصفح.

comic-translate-4-free يترجم صفحات المانغا والقصص المصورة تلقائيًا أثناء تصفحك. يقرأ اليابانية والإنجليزية والصينية المبسطة والتقليدية (مع كشف تلقائي للغة)، ويترجم إلى 114 لغة. افتح صفحة، وستحل النسخة المترجمة محل الصورة الأصلية في مكانها — فقاعات الحوار مليئة بلغتك.

### 📸 قبل & بعد

| قبل (اليابانية) | بعد (العربية) |
| --- | --- |
| ![صفحة مانغا يابانية أصلية](docs/images/wikipe-tan-original.jpg) | ![after](docs/images/wikipe-tan-ar.jpg) |

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

*رسم Wikipe-tan الأصلي بريشة Kasuga، من [مقالة المانغا في Wikipedia](https://en.wikipedia.org/wiki/Manga) عبر Wikimedia Commons — مرخّص بموجب [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). لقطات الشاشة المترجمة هي أعمال مشتقة معدّلة من الأصل.*

---

## ✨ الميزات

- **ترجمة تلقائية** — افتح صفحة مانغا على موقع مسموح وستظهر النسخة المترجمة في مكانها، دون الحاجة إلى الضغط على أي زر.
- **زر الفأرة الأيمن على أي صورة** — اختر "Send to comic-translate-4-free" لترجمة صورة معينة، حتى لو كانت أصغر من الحد الأدنى للحجم.
- **114 لغة مستهدفة** عبر Google Translate أو Azure Translator أو خادم LM Studio المحلي الخاص بك.
- **كشف تلقائي للغة المصدر** — تُحدد اليابانية والإنجليزية والصينية المبسطة/التقليدية تلقائيًا من النص المستخرج.
- **دعم الشرائط الطويلة / الويبتون** — تُعالج الصفحات الطويلة في مقاطع متداخلة ليبقى النص حادًا.
- **17 لغة لواجهة المستخدم** — تتبع واجهة الإضافة لغة المتصفح.

### 🔒 الخصوصية

- **الذكاء الاصطناعي يعمل على جهازك.** كشف الفقاعات والتعرف الضوئي على الحروف (OCR) وإعادة الرسم الداخلي (inpainting) تعمل كلها محليًا في متصفحك عبر WebAssembly. صفحاتك لا تغادر جهازك أبدًا.
- **يُرسل النص المترجم فقط** — تُرسل النصوص المستخرجة فقط إلى خدمة الترجمة التي تختارها (Google / Azure / خادم LM Studio المحلي).
- **لا حساب، لا تتبع، لا قياس عن بُعد.** تبقى جميع الإعدادات والنماذج المخزنة في التخزين المحلي للمتصفح.

---

## 🚀 التثبيت

**Chrome / Edge / Brave:**

[**ثبّت من Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — بضغطة واحدة، مع تحديثات تلقائية.

**Firefox:**

[**ثبّت من إضافات Firefox**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — نقرة واحدة، تحديثات تلقائية.

بعد التثبيت، افتح صفحة الإعدادات واضغط **تنزيل كل النماذج** مرة واحدة (~350 ميجابايت: الكاشف، وOCR، وأداة إعادة الرسم الداخلي). تُحفظ في المتصفح ويُتحقق منها بحجم البايت.

![تنزيل النماذج من صفحة الإعدادات](docs/images/options-models.png)

---

## 💡 كيفية الاستخدام

1. **اسمح للموقع أولًا** — انقر أيقونة الإضافة واضغط **السماح لهذا الموقع** (أو فعّل **السماح لكل المواقع**). تعمل الترجمة فقط حيث منحت الإذن.

   ![السماح للموقع من النافذة المنبثقة](docs/images/popup.png)

2. **أعد تحميل صفحة المانغا** — تبدأ الترجمة تلقائيًا عند تحميل الصفحة. تعرض حبة (pill) في أعلى اليمين التقدم المباشر (Capturing ← Detecting ← OCR ← …).
3. **انتهى** — تُستبدل صورة الصفحة في مكانها بالنسخة المترجمة.

**نصائح:**
- انقر بزر الفأرة الأيمن على أي صورة ← **إرسال إلى comic-translate-4-free** لترجمة تلك الصورة فقط.

  ![النقر بزر الفأرة الأيمن لإرسال صورة](docs/images/right-click.png)

- إذا حظر موقع ما التنزيلات (خطأ HTTP 403)، تعيد الإضافة المحاولة تلقائيًا عبر علامة تبويب خلفية.
- اختر محرك الترجمة في الإعدادات: Google (مجاني، بدون مفتاح)، أو Azure Translator (قدّم طلبًا للمفاتيح أدناه — مليوني حرف شهريًا مجانًا)، أو LM Studio (خادم محلي).
- فعّل **وضع التصحيح** في الإعدادات لفحص كل مرحلة من مراحل المعالجة.

---

## 🔑 التقديم للحصول على حساب Microsoft Azure

لاستخدام Azure Translator كمحرك ترجمة:

1. أنشئ حساب Microsoft/hotmail/Azure أو سجّل الدخول إليه
2. أنشئ اشتراك Azure
3. أنشئ مورد Azure Translator
4. اختر شريحة التسعير F0 (المجانية) — مليوني حرف شهريًا، لا تنتهي
5. إدارة المورد ← المفاتيح ونقطة النهاية (Keys and Endpoint) ← انسخ **KEY 1** و**Location/Region**
6. الصقهما في صفحة إعدادات الإضافة

---

## ❤️ ادعم هذا المشروع

إذا كانت هذه الإضافة مفيدة لك، ففكّر في دعم تطويرها:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ مشكلات معروفة

- **لا يوجد OCR للكورية بعد** — لغات المصدر هي اليابانية والإنجليزية والصينية المبسطة/التقليدية. (تبقى الكورية متاحة كلغة ترجمة مستهدفة.)
- **صورة واحدة لكل صفحة** للترجمة التلقائية (الصورة الرئيسية في الصفحة). استخدم زر الفأرة الأيمن ← إرسال لترجمة صور أخرى.
- **الجلسات الكبيرة** — ترجمة عشرات الصور في جلسة واحدة قد تُعطّل المتصفح. امسح ذاكرة التخزين المؤقت للصفحات في الإعدادات إذا حدث ذلك.
- **Firefox** — تعمل النماذج في صفحة الخلفية (بدون مستندات offscreen)، وتتقاسم الذاكرة مع كل شيء آخر. أعد تشغيل المتصفح إذا رأيت "no available backend found".
- يستخدم Google Translate نقطة النهاية المجانية غير الرسمية وقد يُحدَّد معدل استخدامه.

---

## 📄 إشعارات الجهات الخارجية

هذا المشروع مستوحى من [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — كاشف الفقاعات/النص وأداة إعادة الرسم الداخلي LaMa المُدرَّبة على المانغا هما تصديرات ONNX الخاصة به، ومنطق الاستدلال منقول منه. (يستخدم OCR نموذج [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) من genshiai-daichi.)

المكتبات المرفقة والأكواد المنقولة والنماذج المُنزلة أثناء التشغيل مدرجة مع تراخيصها في [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

رخصة MIT — انظر [LICENSE](LICENSE).
