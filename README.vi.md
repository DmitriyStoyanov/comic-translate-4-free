# comic-translate-4-free

**Ngôn ngữ:** [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md)

Đọc manga bằng ngôn ngữ của bạn — ngay trong trình duyệt.

comic-translate-4-free dịch các trang manga và truyện tranh tự động khi bạn lướt web. Tiện ích đọc được tiếng Nhật, tiếng Anh, tiếng Trung giản thể và phồn thể (kèm tự động nhận diện), và dịch sang 114 ngôn ngữ. Mở một trang web, bản dịch sẽ thay thế ảnh gốc ngay tại chỗ — các bong bóng thoại được điền bằng ngôn ngữ của bạn.

### 📸 Trước & Sau

| Trước (tiếng Nhật) | Sau (Tiếng Việt) |
| --- | --- |
| ![Original Japanese manga page](docs/images/wikipe-tan-original.jpg) | ![after](docs/images/wikipe-tan-vi.jpg) |

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

*Minh họa Wikipe-tan gốc của Kasuga, từ [bài viết Manga trên Wikipedia](https://en.wikipedia.org/wiki/Manga) qua Wikimedia Commons — được cấp phép theo [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Các ảnh chụp màn hình đã dịch là tác phẩm phái sinh đã chỉnh sửa từ bản gốc.*

---

## ✨ Tính năng

- **Dịch tự động** — mở một trang manga trên trang web đã được cấp quyền và bản dịch sẽ hiện ra ngay tại chỗ, không cần bấm nút.
- **Nhấp chuột phải vào bất kỳ ảnh nào** — chọn "Send to comic-translate-4-free" để dịch một ảnh cụ thể, kể cả ảnh nhỏ hơn kích thước tối thiểu.
- **114 ngôn ngữ đích** qua Google Translate, Azure Translator, hoặc máy chủ LM Studio cục bộ của bạn.
- **Tự động nhận diện ngôn ngữ nguồn** — tiếng Nhật, tiếng Anh, tiếng Trung giản thể/phồn thể được nhận diện tự động từ văn bản OCR.
- **Hỗ trợ truyện dải dài / webtoon** — các trang cao được xử lý theo từng đoạn chồng lấn để chữ luôn sắc nét.
- **17 ngôn ngữ giao diện** — giao diện tiện ích theo ngôn ngữ của trình duyệt bạn.

### 🔒 Quyền riêng tư

- **AI chạy trên máy của bạn.** Nhận diện bong bóng thoại, OCR và inpainting đều chạy cục bộ trong trình duyệt qua WebAssembly. Trang web của bạn không bao giờ rời khỏi thiết bị.
- **Chỉ văn bản dịch được gửi đi** — chỉ các chuỗi ký tự đã trích xuất được gửi tới dịch vụ dịch thuật bạn chọn (Google / Azure / LM Studio cục bộ của bạn).
- **Không tài khoản, không theo dõi, không telemetry.** Mọi cài đặt và mô hình đã tải đều lưu trong bộ nhớ cục bộ của trình duyệt.

---

## 🚀 Cài đặt

**Chrome / Edge / Brave:**

[**Cài đặt từ Chrome Web Store**](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — một cú nhấp chuột, tự động cập nhật.

**Firefox:**

[**Cài đặt từ Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — một cú nhấp chuột, tự động cập nhật.

Sau khi cài đặt, mở trang Cài đặt và bấm **Tải xuống tất cả mô hình** một lần (~350 MB: bộ nhận diện, OCR, bộ inpainting). Chúng được lưu trong bộ nhớ đệm của trình duyệt và kiểm chứng theo kích thước byte.

![Tải các mô hình từ trang Cài đặt](docs/images/options-models.png)

---

## 💡 Cách sử dụng

1. **Cấp quyền cho trang web trước** — nhấp vào biểu tượng tiện ích và bấm **Cho phép trang này** (hoặc bật **Cho phép mọi trang web**). Tiện ích chỉ dịch trên các trang bạn đã cấp quyền.

   ![Cấp quyền cho trang web từ cửa sổ bật lên](docs/images/popup.png)

2. **Tải lại trang manga** — trang sẽ tự động bắt đầu dịch khi tải xong. Một viên thuốc ở góc trên bên phải hiển thị tiến trình trực tiếp (Capturing → Detecting → OCR → …).
3. **Xong** — ảnh trên trang được thay thế ngay tại chỗ bằng bản dịch.

**Mẹo:**
- Nhấp chuột phải vào bất kỳ ảnh nào → **Gửi đến comic-translate-4-free** để chỉ dịch ảnh đó.

  ![Nhấp chuột phải để gửi một ảnh](docs/images/right-click.png)

- Nếu trang web chặn tải xuống (HTTP 403), tiện ích sẽ tự động thử lại qua một tab nền.
- Chọn công cụ dịch trong Cài đặt: Google (miễn phí, không cần key), Azure Translator (đăng ký key bên dưới — miễn phí 2 triệu ký tự/tháng), hoặc LM Studio (máy chủ cục bộ).
- Bật **Chế độ gỡ lỗi** trong Cài đặt để kiểm tra từng giai đoạn của quy trình.

---

## 🔑 Đăng ký tài khoản Microsoft Azure

Để dùng Azure Translator làm công cụ dịch:

1. Tạo/đăng nhập tài khoản Microsoft/hotmail/Azure
2. Tạo một gói đăng ký Azure
3. Tạo một tài nguyên Azure Translator
4. Chọn mức giá F0 (Miễn phí) — 2 triệu ký tự/tháng, không hết hạn
5. Quản lý tài nguyên → Khóa và Điểm cuối → sao chép **KEY 1** và **Location/Region**
6. Dán chúng vào trang Cài đặt của tiện ích

---

## ❤️ Hỗ trợ dự án này

Nếu tiện ích này hữu ích với bạn, hãy cân nhắc hỗ trợ quá trình phát triển:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Vấn đề đã biết

- **Chưa có OCR tiếng Hàn** — ngôn ngữ nguồn gồm tiếng Nhật, tiếng Anh và tiếng Trung giản thể/phồn thể. (Tiếng Hàn vẫn có sẵn dưới dạng ngôn ngữ đích.)
- **Một ảnh mỗi trang** đối với chế độ tự dịch (ảnh chính của trang). Dùng chuột phải → Send để dịch các ảnh khác.
- **Phiên dài** — dịch hàng chục ảnh trong một phiên có thể làm trình duyệt bị treo. Xóa bộ nhớ đệm trang trong Cài đặt nếu gặp tình trạng này.
- **Firefox** — các mô hình chạy trong trang nền (không có tài liệu offscreen), dùng chung bộ nhớ với mọi thứ khác. Khởi động lại trình duyệt nếu thấy "no available backend found".
- Google Translate dùng điểm cuối miễn phí không chính thức và có thể bị giới hạn tốc độ.

---

## 📄 Thông báo bên thứ ba

Dự án này lấy cảm hứng từ [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — bộ nhận diện bong bóng thoại/văn bản và bộ inpainting LaMa tinh chỉnh cho manga là các bản xuất ONNX của nó, và logic suy luận được chuyển từ đó. (OCR dùng [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) của genshiai-daichi.)

Các thư viện đi kèm, mã được chuyển và mô hình tải trong lúc chạy được liệt kê kèm giấy phép trong [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Giấy phép MIT — xem [LICENSE](LICENSE).
