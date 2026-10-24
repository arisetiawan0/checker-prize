# PRD — Price Checker PWA (Beauty)


| Item     | Detail                                                |
| -------- | ----------------------------------------------------- |
| Versi    | 1.1 (Draft, sudah memuat jawaban Open Questions v1.0) |
| Tanggal  | 23 Oktober 2026                                       |
| Owner    | Ari                                                   |
| Brand    | Beauty                                                |
| Platform | Progressive Web App, mobile-first (HP &amp; tablet)   |
| Pengguna | Staff internal saja                                   |


---

## 1. Ringkasan

**Price Checker PWA** adalah aplikasi web yang bisa di-install di HP/tablet untuk mengecek harga barang dengan **scan barcode/SKU** (atau input manual). Hasil menampilkan **harga reguler** dan, jika sedang berlaku, **harga flash sale**.

Sumber data adalah **satu spreadsheet** yang berisi SKU, harga reguler, dan harga flash sale. Aplikasi hanya **membaca** data; pengelolaan harga dan promo dilakukan di spreadsheet.

### 1.1 Tujuan

1. Staff bisa cek harga &lt; 3 detik dari scan sampai hasil tampil.
2. Harga yang tampil selalu harga yang berlaku saat ini (reguler vs flash sale).
3. Berjalan di HP dan tablet tanpa install dari app store.
4. Update harga cukup dengan mengubah spreadsheet, tanpa deploy ulang.

### 1.2 Non-Goals (v1)

- Transaksi, keranjang, pembayaran.
- Stok (tidak ditampilkan).
- Kuota flash sale (tidak ada).
- Harga bertingkat, promo tumpang tindih (tidak ada).
- Mode pelanggan/publik dan login (staff internal saja; lihat 7.3 untuk pengamanan).
- Mode offline penuh (cukup cache singkat).
- Multi-brand (hanya Beauty).

---

## 2. Pengguna


| Persona                       | Kebutuhan                                                                  |
| ----------------------------- | -------------------------------------------------------------------------- |
| Staff outlet / Beauty Advisor | Cek harga cepat saat melayani pelanggan, memastikan harga flash sale benar |


Perangkat: HP dan tablet milik outlet/staff. Layout harus nyaman di layar 360 px sampai tablet (portrait dan landscape).

---

## 3. User Stories


| ID    | Sebagai staff, saya ingin                      | Agar                                                     |
| ----- | ---------------------------------------------- | -------------------------------------------------------- |
| US-01 | Scan barcode dengan kamera                     | Langsung melihat harga tanpa mengetik                    |
| US-02 | Input SKU/barcode/nama manual                  | Tetap bisa cek jika barcode rusak atau kamera bermasalah |
| US-03 | Melihat harga reguler dan flash sale sekaligus | Tahu harga mana yang berlaku dan selisihnya              |
| US-04 | Melihat sisa waktu flash sale                  | Memberi tahu pelanggan kapan promo berakhir              |
| US-05 | Melihat riwayat scan terakhir                  | Mengecek ulang tanpa scan lagi                           |
| US-06 | Aplikasi tetap terbuka saat sinyal lemah       | Tidak terhenti oleh koneksi buruk                        |


---

## 4. Fitur MVP

### F1 — Scan Barcode

- Scan via kamera belakang (EAN-13, EAN-8, UPC-A, Code 128, QR).
- Auto-detect lalu langsung query; getar/bunyi singkat saat sukses.
- Tombol senter dan pilih kamera.
- Jika izin kamera ditolak, arahkan ke input manual.

### F2 — Pencarian Manual

- Input barcode, SKU, atau nama produk (autocomplete).
- Hasil berupa daftar; pilih satu untuk melihat detail.

### F3 — Hasil Harga

- Nama produk, SKU, barcode.
- **Harga reguler** selalu tampil.
- **Flash sale aktif**: harga flash besar, label "FLASH SALE", harga reguler dicoret, persentase hemat, periode dan countdown (jika kolom periode tersedia, lihat 5.2).
- Flash sale belum mulai: tampilkan reguler + info jadwal.
- Flash sale berakhir/tidak aktif: tampil reguler saja.
- Produk tidak ditemukan: pesan jelas + opsi cari manual.
- Penanda "Data diperbarui: HH:MM" agar staff tahu kesegaran data.

### F4 — Riwayat Scan

- 20–50 scan terakhir tersimpan lokal di perangkat; tap untuk buka ulang.

### F5 — PWA

- Manifest + service worker, bisa Add to Home Screen, tampil fullscreen.
- App shell dimuat dari cache; data harga memakai **cache singkat**. Jika offline, tampilkan data terakhir yang di-cache dengan penanda "mungkin tidak terbaru".

> **Dihapus dari v1.0:** pilih outlet (harga dianggap seragam, lihat Asumsi), stok, kuota, login/role, dashboard admin.

---

## 5. Sumber Data: Spreadsheet

### 5.1 Asumsi

- Spreadsheet adalah **Google Sheets** (ubah jika bukan).
- Harga **sama di semua outlet**, sehingga tidak ada kolom outlet.
- **Barcode dan SKU 1:1** per produk.
- Satu baris = satu produk.

### 5.2 Struktur Kolom (Usulan)


| Kolom           | Wajib      | Contoh             | Keterangan                                                                             |
| --------------- | ---------- | ------------------ | -------------------------------------------------------------------------------------- |
| `sku`           | Ya         | `BK-0001`          | Unik                                                                                   |
| `barcode`       | Ya\*       | `8991234567890`    | Unik, 1:1 dengan SKU. \*Jika barcode fisik sama dengan SKU, kolom ini boleh diisi sama |
| `nama`          | Ya         | `Serum Vit C 30ml` | Untuk tampilan dan pencarian                                                           |
| `harga_reguler` | Ya         | `125000`           | Angka murni, tanpa titik/"Rp"                                                          |
| `harga_flash`   | Tidak      | `99000`            | Kosong = tidak ada flash sale                                                          |
| `flash_mulai`   | Disarankan | `2026-10-23 10:00` | Waktu WITA                                                                             |
| `flash_selesai` | Disarankan | `2026-10-23 14:00` | Waktu WITA                                                                             |


**Catatan penting:** untuk menentukan flash sale sedang aktif atau tidak, sistem butuh tahu **kapan** berlaku. Ada dua pilihan:


| Opsi               | Cara kerja                                | Konsekuensi                                                                                                                    |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **A (disarankan)** | Kolom `flash_mulai` &amp; `flash_selesai` | Flash sale aktif/berakhir otomatis, countdown bisa tampil                                                                      |
| **B**              | Hanya `harga_flash`; terisi = flash aktif | Staff harus manual mengosongkan kolom saat flash sale selesai. Risiko harga flash tampil melewati periode, countdown tidak ada |


### 5.3 Aturan Kualitas Data

- SKU dan barcode tidak boleh duplikat; baris duplikat diabaikan dan dicatat di log.
- `harga_flash` harus lebih rendah dari `harga_reguler`; jika tidak, flash diabaikan.
- Sel harga non-angka dianggap kosong.
- Disarankan memakai data validation di spreadsheet agar format harga dan tanggal konsisten.

---

## 6. Aturan Penentuan Harga

Dihitung di server (bukan di HP) agar konsisten dan tidak bergantung jam perangkat.

1. Cari baris berdasarkan `barcode` atau `sku` (exact match).
2. Jika `harga_flash` terisi **dan** valid (&lt; reguler) **dan** (Opsi A) `sekarang ∈ [flash_mulai, flash_selesai]` → **harga efektif = harga flash**.
3. Selain itu → harga efektif = harga reguler.
4. Zona waktu **WITA (UTC+8)**.
5. Format Rupiah tanpa desimal (`Rp 125.000`).
6. Persentase hemat = `(reguler − flash) / reguler × 100`, dibulatkan.


| Kondisi                 | Tampilan                                        |
| ----------------------- | ----------------------------------------------- |
| Tidak ada `harga_flash` | Reguler saja                                    |
| Flash aktif             | Harga flash besar + reguler dicoret + countdown |
| Flash belum mulai       | Reguler + "Flash sale mulai {tanggal/jam}"      |
| Flash berakhir          | Reguler saja                                    |
| Tidak ditemukan         | "Produk tidak ditemukan"                        |


---

## 7. Arsitektur

### 7.1 Gambaran

```
[HP / Tablet - PWA]
      │ HTTPS
      ▼
[Backend API tipis]  ← API key spreadsheet disimpan di sini, bukan di klien
      │  - baca spreadsheet
      │  - parse & validasi
      │  - cache singkat (30–60 detik)
      │  - resolve harga efektif
      ▼
[Spreadsheet: SKU, barcode, nama, harga reguler, harga flash, periode]

```

### 7.2 Stack (Usulan)


| Lapisan     | Pilihan                                                   | Catatan                                             |
| ----------- | --------------------------------------------------------- | --------------------------------------------------- |
| Frontend    | Next.js + Tailwind + Serwist/next-pwa                     | Mobile &amp; tablet responsive                      |
| Scan        | `BarcodeDetector` bila ada, fallback `@zxing/browser`     | Safari iOS perlu fallback; HTTPS wajib untuk kamera |
| Backend     | Next.js Route Handler atau Cloudflare Worker              | Menyembunyikan kredensial Sheets                    |
| Sumber data | Google Sheets API (Service Account, read-only)            | Spreadsheet di-share ke service account             |
| Cache       | TTL 30–60 dtk di server + cache respons di service worker | Kuota Sheets API terlindungi                        |
| Hosting     | Vercel / Cloudflare                                       |                                                     |


### 7.3 Keamanan (staff saja)

Karena tanpa login, minimal:

- Akses dibatasi dengan **kode akses/PIN staff** sederhana, atau URL tidak dipublikasikan + rate limit. *(Pilih salah satu; lihat Open Questions.)*
- Spreadsheet **tidak** dibuat publik; hanya service account (read-only) yang punya akses.
- Rate limiting pada API untuk mencegah scraping.

### 7.4 Strategi Cache dan Kuota

Pembacaan Sheets API per scan akan boros kuota dan lambat. Pendekatan: backend memuat **seluruh sheet sekali**, menyimpannya di memori/edge cache 30–60 detik, lalu melayani semua scan dari cache itu. Dengan begitu perubahan harga di spreadsheet terlihat maksimal ~1 menit kemudian dan jumlah panggilan ke Sheets API tetap kecil berapa pun jumlah scan.

---

## 8. Spesifikasi API (Draft)

### `GET /api/price?code={barcode|sku}`

```json
{
  "product": { "sku": "BK-0001", "barcode": "8991234567890", "name": "Serum Vit C 30ml" },
  "regular_price": 125000,
  "flash_sale": {
    "active": true,
    "price": 99000,
    "discount_percent": 21,
    "starts_at": "2026-10-23T10:00:00+08:00",
    "ends_at": "2026-10-23T14:00:00+08:00",
    "seconds_remaining": 5400
  },
  "effective_price": 99000,
  "data_updated_at": "2026-10-23T11:30:00+08:00"
}

```

`flash_sale` bernilai `null` jika tidak ada/tidak aktif. Respons **404** `{"error":"PRODUCT_NOT_FOUND"}` jika tidak ditemukan.

### `GET /api/search?q={teks}` — pencarian nama/SKU, maksimal 20 hasil.

---

## 9. UI (Garis Besar)

- **Scan:** viewfinder kamera penuh; bar bawah berisi Senter, Input Manual, Riwayat.
- **Hasil:** bottom sheet di HP, panel samping/tengah di tablet landscape. Harga efektif adalah elemen terbesar; badge FLASH SALE, chip hemat, countdown; tombol besar "Scan Lagi".
- **Cari manual** dan **Riwayat:** daftar sederhana.
- Branding Beauty (logo, warna brand). Tombol ≥ 44 px, kontras tinggi.

---

## 10. Kebutuhan Non-Fungsional


| Aspek          | Target                                                              |
| -------------- | ------------------------------------------------------------------- |
| Performa       | Scan → hasil ≤ 3 detik; respons API (cache hit) ≤ 300 ms            |
| Kompatibilitas | Chrome Android, Safari iOS 16+, tablet                              |
| Ketersediaan   | ≥ 99% pada jam operasional                                          |
| Keamanan       | HTTPS, kredensial hanya di server, akses staff dibatasi, rate limit |
| Data           | Kesegaran maksimal \~1 menit dari perubahan spreadsheet             |
| Bahasa         | Indonesia                                                           |


---

## 11. Metrik Keberhasilan


| Metrik                       | Target                             |
| ---------------------------- | ---------------------------------- |
| Waktu scan → hasil (median)  | ≤ 3 detik                          |
| Scan terbaca benar           | ≥ 95%                              |
| Produk "tidak ditemukan"     | ≤ 3%                               |
| Akurasi harga vs spreadsheet | 100% (audit sampel)                |
| Pemakaian staff              | ≥ 80% staff pilot memakai mingguan |


---

## 12. Risiko dan Mitigasi


| Risiko                                                | Mitigasi                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Spreadsheet salah ketik (harga, format, duplikat SKU) | Data validation, validasi di backend, log baris bermasalah                        |
| Flash sale lupa dimatikan (jika Opsi B)               | Pakai Opsi A (kolom periode)                                                      |
| Kuota Sheets API habis                                | Cache server 30–60 detik, load sheet sekali                                       |
| Sheets terlalu besar/lambat dimuat                    | Pantau jumlah baris; jika &gt; \~20 ribu baris, pertimbangkan sinkron ke database |
| Safari iOS tidak mendukung scan native                | Fallback ZXing, uji di iOS sejak awal                                             |
| Sinyal buruk di toko                                  | Cache respons + penanda data mungkin usang                                        |
| Akses tanpa login disalahgunakan                      | PIN staff + rate limit + spreadsheet tidak publik                                 |
| Barcode di spreadsheet belum lengkap                  | Audit data awal, laporkan produk tidak ditemukan                                  |


---

## 13. Rencana Rilis


| Fase | Isi                                                        | Estimasi   |
| ---- | ---------------------------------------------------------- | ---------- |
| 0    | Finalisasi struktur spreadsheet &amp; jawab Open Questions | 1–2 hari   |
| 1    | Prototype: scan + hasil harga reguler                      | \~1 minggu |
| 2    | MVP: flash sale, riwayat, PWA, cache                       | 1 minggu   |
| 3    | Pilot di 1–3 outlet, audit akurasi                         | 1–2 minggu |
| 4    | Rollout semua outlet                                       | Bertahap   |


---

## 14. Kriteria Penerimaan MVP

- \[ \] Scan EAN-13 menghasilkan produk yang benar di Android Chrome dan Safari iOS.
- \[ \] Harga reguler tampil sesuai spreadsheet untuk semua produk yang barcodenya terdaftar.
- \[ \] Flash sale aktif tampil dengan harga, periode, countdown (berbasis waktu server).
- \[ \] Flash sale di luar periode tidak memengaruhi harga yang tampil.
- \[ \] Perubahan di spreadsheet terlihat di aplikasi maksimal ~1 menit.
- \[ \] Input manual berfungsi bila kamera tidak tersedia.
- \[ \] Layout nyaman di HP dan tablet (portrait &amp; landscape).
- \[ \] Bisa di-install ke layar utama; shell terbuka saat sinyal lemah.
- \[ \] Akses dibatasi hanya staff.
- \[ \] Audit sampel 50 produk: harga cocok 100% dengan spreadsheet.

---

## 15. Open Questions (Tersisa)

1. **Periode flash sale:** pakai Opsi A (kolom `flash_mulai`/`flash_selesai`) atau Opsi B (hanya `harga_flash`)?
2. **Harga per outlet:** benar harga seragam di semua outlet Beauty?
3. **Kolom barcode:** apakah barcode fisik sama dengan SKU, atau ada kolom barcode terpisah di spreadsheet?
4. **Jenis spreadsheet:** Google Sheets atau Excel? Siapa yang mengisi/memperbarui, dan seberapa sering?
5. **Jumlah produk** (perkiraan baris) di spreadsheet?
6. **Pengamanan akses:** PIN/kode staff bersama, atau cukup URL tidak dipublikasikan?
7. **Nama aplikasi** dan aset brand Beauty (logo, warna)?