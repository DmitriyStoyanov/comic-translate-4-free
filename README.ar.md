# comic-translate-4-free

اللغة: [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

اقرأ المانغا بلغتك!
comic-translate-4-free يترجم المانغا والقصص المصورة تلقائيًا أثناء التصفح. يقرأ اليابانية والإنجليزية والصينية المبسطة/التقليدية (الكشف التلقائي)، ويترجم إلى 114 لغة، ويحل محل الصورة في مكانها.

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

- الترجمة التلقائية — افتح صفحة مانغا على موقع مسموح به وستظهر النسخة المترجمة في مكانها، دون الحاجة إلى النقر على أي زر.
- انقر بزر الماوس الأيمن على أي صورة — اختر "إرسال إلى comic-translate-4-free" لترجمة صورة محددة، حتى لو كانت أصغر من الحد الأدنى للحجم.
- 114 لغة مستهدفة عبر Google Translate أو Azure Translator أو خادم LM Studio المحلي الخاص بك.
- الكشف التلقائي عن لغة المصدر — يتم تحديد اليابانية والإنجليزية والصينية المبسطة/التقليدية تلقائيًا من النص الذي يتعرف عليه OCR.
- دعم الشرائط الطويلة / الويبتون — تتم معالجة الصفحات الطويلة في مقاطع متداخلة ليبقى النص حادًا.
- 17 لغة لواجهة المستخدم — تتبع واجهة الإضافة إعداد لغة المتصفح.

### 🔒 الخصوصية

- يعمل الذكاء الاصطناعي على جهازك. يعمل كشف الفقاعات وOCR وإزالة النص (inpainting) محليًا في متصفحك. يعمل الكشف وOCR عبر WebAssembly. ويعمل inpainting على GPU في Chrome (مع الرجوع إلى WebAssembly)، وعبر WebAssembly في Firefox. صفحاتك لا تغادر جهازك أبدًا.
- يتم إرسال النص المترجم فقط — فقط السلاسل النصية المستخرجة تذهب إلى خدمة الترجمة التي تختارها (Google / Azure / LM Studio المحلي).
- لا حساب، لا تتبع، لا قياس عن بُعد. تبقى جميع الإعدادات والنماذج المخزنة مؤقتًا في التخزين المحلي للمتصفح.

---

## 🚀 التثبيت

Chrome / Edge / Brave:

[ثبّت من Chrome Web Store](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — بضغطة واحدة، مع تحديثات تلقائية.

Firefox:

[ثبّت من إضافات Firefox](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — نقرة واحدة، تحديثات تلقائية.

بعد التثبيت، افتح صفحة الإعدادات وانقر على تنزيل كل النماذج مرة واحدة (~350 ميغابايت: الكاشف، OCR، أداة inpainting). يتم تخزينها مؤقتًا في المتصفح والتحقق منها حسب حجم البايت.

![تنزيل النماذج من صفحة الإعدادات](docs/images/options-models.png)

---

## 💡 كيفية الاستخدام

1. اسمح للموقع أولًا — انقر على أيقونة الإضافة واضغط السماح لهذا الموقع (أو فعّل السماح لكل المواقع). الترجمة تعمل فقط حيث منحت الإذن.

   ![السماح للموقع من النافذة المنبثقة](docs/images/popup.png)

2. أعد تحميل صفحة المانغا — تبدأ الترجمة تلقائيًا عند تحميل الصفحة. تظهر فقاعة في أعلى اليمين تقدمًا مباشرًا (Capturing → Detecting → OCR → …).
3. تم — يتم استبدال صورة الصفحة في مكانها بالنسخة المترجمة.

نصائح:
- انقر بزر الماوس الأيمن على أي صورة ← إرسال إلى comic-translate-4-free لترجمة تلك الصورة فقط.

  ![النقر بزر الفأرة الأيمن لإرسال صورة](docs/images/right-click.png)

- إذا حظر موقع ما التنزيلات (HTTP 403)، تعيد الإضافة المحاولة تلقائيًا عبر علامة تبويب في الخلفية.
- اختر محرك الترجمة في الإعدادات: Google (مجاني، بدون مفتاح)، أو Azure Translator (اطلب المفاتيح أدناه — 2 مليون حرف/شهر مجانًا)، أو LM Studio (خادم محلي).
- فعّل وضع التصحيح (فاحص المراحل) في الإعدادات لفحص كل مرحلة من مراحل العملية.

---

## 🔑 التقديم للحصول على حساب Microsoft Azure

لاستخدام Azure Translator كمحرك ترجمة:

1. أنشئ حساب Microsoft/hotmail/Azure أو سجّل الدخول إليه
2. أنشئ اشتراك Azure
3. أنشئ مورد Azure Translator
4. اختر فئة التسعير F0 (مجانية) — 2 مليون حرف/شهر، لا تنتهي صلاحيتها
5. إدارة الموارد ← المفاتيح ونقطة النهاية ← انسخ KEY 1 وLocation/Region
6. الصقهما في صفحة إعدادات الإضافة

---

## ❤️ ادعم هذا المشروع

إذا كانت هذه الإضافة مفيدة لك، ففكّر في دعم تطويرها:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ مشكلات معروفة

- لا يوجد OCR للكورية بعد — لغات المصدر هي اليابانية والإنجليزية والصينية المبسطة/التقليدية. (تبقى الكورية متاحة كلغة ترجمة مستهدفة.)
- صورة واحدة لكل صفحة للترجمة التلقائية (الصورة الرئيسية للصفحة). استخدم النقر بزر الماوس الأيمن ← إرسال إلى لترجمة الصور الأخرى.
- الجلسات الكبيرة — ترجمة عشرات الصور في جلسة واحدة قد تؤدي إلى تعطل المتصفح. امسح ذاكرة التخزين المؤقت للصفحة في الإعدادات إذا حدث ذلك.
- Firefox — تعمل النماذج في صفحة الخلفية (بدون مستندات offscreen)، وتتشارك الذاكرة مع كل شيء آخر. أعد تشغيل المتصفح إذا رأيت "no available backend found".
- Firefox أبطأ من Chrome — إضافات Firefox لا يمكنها استخدام الذاكرة المشتركة للمعالجة متعددة الخيوط (SharedArrayBuffer)، لذا يعمل النموذج على خيط واحد لوحدة المعالجة المركزية. هذا قيد في منصة Firefox، وليس خطأ في الإضافة ([Mozilla bug 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- يستخدم Google Translate نقطة النهاية المجانية غير الرسمية وقد يكون محدود المعدل.

---

## 📄 إشعارات الطرف الثالث

هذا المشروع مستوحى من [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — كاشف الفقاعات/النص ومُزيل النص LaMa المُدرَّب على المانغا هما تصديرات ONNX الخاصة به، ومنطق الاستدلال منقول منه. (يستخدم OCR نموذج [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) من genshiai-daichi.)

المكتبات المضمّنة والكود المنقول والنماذج التي تُنزَّل أثناء التشغيل مدرجة مع تراخيصها في [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

رخصة MIT — انظر [LICENSE](LICENSE).
