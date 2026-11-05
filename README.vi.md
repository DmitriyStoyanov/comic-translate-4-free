# comic-translate-4-free

Ngôn ngữ: [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

Đọc manga bằng ngôn ngữ của bạn!
comic-translate-4-free tự động dịch manga và truyện tranh khi bạn duyệt web. Nó đọc tiếng Nhật, tiếng Anh, tiếng Trung giản thể/phồn thể (tự động phát hiện), và dịch sang 114 ngôn ngữ, thay thế hình ảnh ngay tại chỗ.

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

- Dịch tự động — mở một trang manga trên một trang web được phép và bản dịch sẽ xuất hiện ngay tại chỗ, không cần bấm nút.
- Nhấp chuột phải vào bất kỳ hình ảnh nào — chọn "Gửi đến comic-translate-4-free" để dịch một hình ảnh cụ thể, ngay cả khi nó nhỏ hơn kích thước tối thiểu.
- 114 ngôn ngữ đích qua Google Translate, Azure Translator, hoặc máy chủ LM Studio cục bộ của riêng bạn.
- Tự động phát hiện ngôn ngữ nguồn — tiếng Nhật, tiếng Anh, tiếng Trung giản thể/phồn thể được xác định tự động từ văn bản đã OCR.
- Hỗ trợ truyện dài / webtoon — các trang cao được xử lý thành các đoạn chồng lên nhau để chữ vẫn sắc nét.
- 17 ngôn ngữ giao diện — giao diện của tiện ích mở rộng tuân theo cài đặt ngôn ngữ của trình duyệt của bạn.

### 🔒 Quyền riêng tư

- AI chạy trên máy của bạn. Phát hiện bong bóng, OCR và inpainting đều chạy cục bộ trong trình duyệt của bạn. Phát hiện và OCR chạy qua WebAssembly. Inpainting chạy trên GPU trên Chrome (với WebAssembly dự phòng), và qua WebAssembly trên Firefox. Trang của bạn không bao giờ rời khỏi thiết bị của bạn.
- Chỉ văn bản đã dịch được gửi ra ngoài — chỉ các chuỗi đã trích xuất mới đến dịch vụ dịch thuật bạn chọn (Google / Azure / LM Studio cục bộ của bạn).
- Không tài khoản, không theo dõi, không đo từ xa. Mọi cài đặt và mô hình đã lưu trong bộ nhớ đệm đều ở trong bộ nhớ cục bộ của trình duyệt của bạn.

---

## 🚀 Cài đặt

Chrome / Edge / Brave:

[Cài đặt từ Chrome Web Store](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — một cú nhấp chuột, cập nhật tự động.

Firefox:

[Cài đặt từ Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — một cú nhấp chuột, cập nhật tự động.

Sau khi cài đặt, mở trang Cài đặt và nhấp một lần vào Tải xuống tất cả mô hình (~350 MB: trình phát hiện, OCR, inpainter). Chúng được lưu trong bộ nhớ đệm của trình duyệt và được xác minh theo kích thước byte.

![Tải các mô hình từ trang Cài đặt](docs/images/options-models.png)

---

## 💡 Cách sử dụng

1. Cho phép trang web trước — nhấp vào biểu tượng tiện ích mở rộng và nhấn Cho phép trang này (hoặc bật Cho phép mọi trang web). Dịch chỉ chạy ở nơi bạn đã cấp quyền.

   ![Cấp quyền cho trang web từ cửa sổ bật lên](docs/images/popup.png)

2. Tải lại trang manga — nó bắt đầu dịch tự động khi trang tải. Một viên thuốc ở góc trên bên phải hiển thị tiến trình trực tiếp (Capturing → Detecting → OCR → …).
3. Xong — hình ảnh của trang được thay thế ngay tại chỗ bằng bản dịch.

Mẹo:
- Nhấp chuột phải vào bất kỳ hình ảnh nào → Gửi đến comic-translate-4-free để chỉ dịch hình ảnh đó.

  ![Nhấp chuột phải để gửi một ảnh](docs/images/right-click.png)

- Nếu một trang web chặn tải xuống (HTTP 403), tiện ích mở rộng sẽ tự động thử lại qua một tab nền.
- Chọn công cụ dịch của bạn trong Cài đặt: Google (miễn phí, không cần khóa), Azure Translator (đăng ký khóa bên dưới — 2 triệu ký tự/tháng miễn phí), hoặc LM Studio (máy chủ cục bộ).
- Bật Chế độ gỡ lỗi (xem từng giai đoạn) trong Cài đặt để kiểm tra từng giai đoạn của quy trình.

---

## 🔑 Đăng ký tài khoản Microsoft Azure

Để sử dụng Azure Translator làm công cụ dịch:

1. Tạo/đăng nhập tài khoản Microsoft/hotmail/Azure
2. Tạo đăng ký Azure
3. Tạo tài nguyên Azure Translator
4. Chọn gói giá F0 (Miễn phí) — 2 triệu ký tự/tháng, không hết hạn
5. Quản lý tài nguyên → Khóa và Điểm cuối → sao chép KEY 1 và Location/Region
6. Dán chúng vào trang Cài đặt của tiện ích mở rộng

---

## ❤️ Hỗ trợ dự án này

Nếu tiện ích mở rộng này hữu ích với bạn, hãy cân nhắc hỗ trợ quá trình phát triển của nó:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Vấn đề đã biết

- Chưa có OCR tiếng Hàn — ngôn ngữ nguồn là tiếng Nhật, tiếng Anh và tiếng Trung giản thể/phồn thể. (Tiếng Hàn vẫn có sẵn dưới dạng ngôn ngữ đích của bản dịch.)
- Một hình ảnh trên mỗi trang cho dịch tự động (hình ảnh chính của trang). Dùng nhấp chuột phải → Gửi để dịch các hình khác.
- Phiên lớn — dịch hàng chục hình ảnh trong một phiên có thể làm trình duyệt bị sập. Xóa bộ nhớ đệm của trang trong Cài đặt nếu điều này xảy ra.
- Firefox — các mô hình chạy trong trang nền (không có tài liệu offscreen), chia sẻ bộ nhớ với mọi thứ khác. Khởi động lại trình duyệt nếu bạn thấy "no available backend found".
- Firefox chậm hơn Chrome — các tiện ích mở rộng của Firefox không thể dùng bộ nhớ dùng chung cho đa luồng (SharedArrayBuffer), vì vậy mô hình chạy trên một luồng CPU duy nhất. Đây là giới hạn của nền tảng Firefox, không phải lỗi của tiện ích mở rộng. ([Lỗi Mozilla 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- Google Translate sử dụng endpoint miễn phí không chính thức và có thể bị giới hạn tốc độ.

---

## 📄 Thông báo của bên thứ ba

Dự án này lấy cảm hứng từ [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — trình phát hiện bong bóng/văn bản và trình inpainting LaMa được huấn luyện trên manga là các bản xuất ONNX của nó, và logic suy luận được chuyển từ đó. (OCR sử dụng [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) của genshiai-daichi.)

Các thư viện đi kèm, mã đã chuyển và các mô hình tải xuống trong thời gian chạy được liệt kê cùng với giấy phép của chúng trong [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Giấy phép MIT — xem [LICENSE](LICENSE).
