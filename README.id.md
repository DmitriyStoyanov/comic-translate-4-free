# comic-translate-4-free

Bahasa: [English](README.md) · [हिन्दी](README.hi.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Español](README.es.md) · [العربية](README.ar.md) · [Français](README.fr.md) · [বাংলা](README.bn.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [اردو](README.ur.md) · [Deutsch](README.de.md) · [Română](README.ro.md)

Baca manga dalam bahasamu!
comic-translate-4-free menerjemahkan manga dan komik otomatis saat menjelajah. Membaca Jepang, Inggris, Tionghoa Sederhana/Tradisional (deteksi otomatis), dan menerjemahkan ke 114 bahasa, mengganti gambar di tempatnya.

### 📸 Sebelum & Sesudah

| Sebelum (Jepang) | Sesudah (Indonesia) |
| --- | --- |
| ![Original Japanese manga page](docs/images/wikipe-tan-original.jpg) | ![Translated to Indonesian](docs/images/wikipe-tan-id.jpg) |

<details>
<summary>Lihat terjemahan dalam 14 bahasa lainnya</summary>

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

*Ilustrasi Wikipe-tan asli oleh Kasuga, dari [artikel Manga Wikipedia](https://en.wikipedia.org/wiki/Manga) via Wikimedia Commons — berlisensi [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Tangkapan layar yang diterjemahkan adalah karya turunan yang dimodifikasi dari aslinya.*

---

## ✨ Fitur

- Terjemahan otomatis — buka halaman manga di situs yang diizinkan dan versi terjemahannya akan muncul di tempatnya, tanpa perlu mengeklik tombol.
- Klik kanan pada gambar apa pun — pilih "Kirim ke comic-translate-4-free" untuk menerjemahkan gambar tertentu, bahkan yang lebih kecil dari ukuran minimum.
- 114 bahasa target melalui Google Translate, Azure Translator, atau server LM Studio lokal Anda sendiri.
- Deteksi otomatis bahasa sumber — bahasa Jepang, Inggris, Tionghoa Sederhana/Tradisional dikenali secara otomatis dari teks hasil OCR.
- Dukungan strip panjang / webtoon — halaman tinggi diproses dalam segmen yang tumpang tindih sehingga teks tetap tajam.
- 17 bahasa UI — antarmuka ekstensi mengikuti pengaturan bahasa browser Anda.

### 🔒 Privasi

- AI berjalan di komputer Anda. Deteksi gelembung, OCR, dan inpainting semuanya berjalan secara lokal di browser Anda. Deteksi dan OCR berjalan melalui WebAssembly. Inpainting berjalan di GPU di Chrome (dengan fallback WebAssembly), dan melalui WebAssembly di Firefox. Halaman Anda tidak pernah meninggalkan perangkat Anda.
- Hanya teks terjemahan yang dikirim keluar — hanya string yang diekstrak yang dikirim ke layanan terjemahan yang Anda pilih (Google / Azure / LM Studio lokal Anda).
- Tanpa akun, tanpa pelacakan, tanpa telemetri. Semua pengaturan dan model yang di-cache tetap berada di penyimpanan lokal browser Anda.

---

## 🚀 Instalasi

Chrome / Edge / Brave:

[Instal dari Chrome Web Store](https://chromewebstore.google.com/detail/pndooikgcenncdohfggodonniihplppj) — sekali klik, pembaruan otomatis.

Firefox:

[Pasang dari Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/comic-translate-4-free/) — sekali klik, pembaruan otomatis.

Setelah menginstal, buka halaman Pengaturan dan klik Unduh semua model sekali (~350 MB: detektor, OCR, inpainter). Model-model itu di-cache di browser dan diverifikasi berdasarkan ukuran byte.

![Downloading the models from the Settings page](docs/images/options-models.png)

---

## 💡 Cara Menggunakan

1. Izinkan situsnya terlebih dahulu — klik ikon ekstensi dan tekan Izinkan situs ini (atau aktifkan Izinkan semua situs). Terjemahan hanya berjalan di tempat Anda memberikan izin.

   ![Allow the site from the popup](docs/images/popup.png)

2. Muat ulang halaman manga — terjemahan dimulai secara otomatis saat halaman dimuat. Sebuah pil di kanan atas menunjukkan progres langsung (Capturing → Detecting → OCR → …).
3. Selesai — gambar halaman diganti di tempatnya dengan versi terjemahan.

Tips:
- Klik kanan pada gambar apa pun → Kirim ke comic-translate-4-free untuk menerjemahkan hanya gambar itu.

  ![Right-click to send an image](docs/images/right-click.png)

- Jika sebuah situs memblokir unduhan (HTTP 403), ekstensi akan otomatis mencoba lagi melalui tab latar belakang.
- Pilih mesin terjemahan Anda di Pengaturan: Google (gratis, tanpa kunci), Azure Translator (ajukan kunci di bawah — 2 jt karakter/bulan gratis), atau LM Studio (server lokal).
- Aktifkan Mode debug (pemeriksa tahap) di Pengaturan untuk memeriksa setiap tahap pipeline.

---

## 🔑 Ajukan akun Microsoft Azure

Untuk menggunakan Azure Translator sebagai mesin terjemahan:

1. Buat/masuk ke akun Microsoft/hotmail/Azure
2. Buat langganan Azure
3. Buat sumber daya Azure Translator
4. Pilih tingkat harga F0 (Gratis) — 2 juta karakter/bulan, tidak kedaluwarsa
5. Manajemen Sumber Daya → Kunci dan Endpoint → salin KEY 1 dan Location/Region
6. Tempel ke halaman Pengaturan ekstensi

---

## ❤️ Dukung proyek ini

Jika ekstensi ini berguna bagi Anda, pertimbangkan untuk mendukung pengembangannya:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S5X627XJQW)

---

## ⚠️ Masalah yang Diketahui

- Belum ada OCR Korea — bahasa sumbernya adalah Jepang, Inggris, dan Tionghoa Sederhana/Tradisional. (Bahasa Korea tetap tersedia sebagai bahasa target terjemahan.)
- Satu gambar per halaman untuk terjemahan otomatis (gambar utama halaman). Gunakan klik kanan → Kirim untuk menerjemahkan yang lain.
- Sesi besar — menerjemahkan puluhan gambar dalam satu sesi dapat membuat browser crash. Hapus cache halaman di Pengaturan jika hal ini terjadi.
- Firefox — model berjalan di halaman latar belakang (tanpa dokumen offscreen), berbagi memori dengan yang lain. Restart browser jika Anda melihat "no available backend found".
- Firefox lebih lambat daripada Chrome — ekstensi Firefox tidak dapat menggunakan memori bersama untuk multi-threading (SharedArrayBuffer), jadi model berjalan pada satu thread CPU. Ini adalah batasan platform Firefox, bukan bug ekstensi. ([Bug Mozilla 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477)).
- Google Translate menggunakan endpoint gratis tidak resmi dan mungkin dibatasi kecepatannya.

---

## 📄 Pemberitahuan pihak ketiga

Proyek ini terinspirasi oleh [ogkalu2/comic-translate](https://github.com/ogkalu2/comic-translate) — detektor gelembung/teks dan inpainter LaMa yang dilatih manga adalah ekspor ONNX-nya, dan logika inferensinya diporting darinya. (OCR menggunakan [Baberu](https://huggingface.co/genshiai-daichi/baberu-ocr) oleh genshiai-daichi.)

Pustaka yang dibundel, kode yang diporting, dan model yang diunduh saat runtime dicantumkan beserta lisensinya di [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Lisensi MIT — lihat [LICENSE](LICENSE).
