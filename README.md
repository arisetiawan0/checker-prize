# Beauty Price Checker

PWA **Price Checker (Beauty)** sesuai `prd.md`. Dua generasi kode dalam satu repo:

- `web/` — **aktif**: Next.js + backend Google Sheets + PIN server (lihat bagian [Backend](#backend-web--sudah-implementasi) & [Deploy](#deploy-vercel--cloudflare))
- `frontend/` — arsip prototype fase 1, HTML/CSS/JS murni tanpa build step; fitur identik tapi data & PIN masih mock

## Menjalankan (aktif — `web/`)

```bash
cd web
npm install
npm run dev -- -p 3000   # buka http://localhost:3000
```

**Kode akses demo: `280101`** — diverifikasi server via `POST /api/auth`; tap chip di kartu PIN untuk mengisi otomatis.

> Kamera & service worker butuh **HTTPS atau localhost**. Untuk uji di HP, gunakan tunnel (mis. `cloudflared tunnel --url http://localhost:3000`).

## Fitur yang sudah diimplementasikan (F1–F5)

| Fitur | Status | Catatan |
| --- | --- | --- |
| F1 Scan barcode | ✅ | `BarcodeDetector` (Chrome Android/Windows) dengan fallback `@zxing/browser` (Safari iOS); senter; kalau izin kamera ditolak → diarahkan ke input manual |
| F2 Pencarian manual | ✅ | Debounce 180 ms, skoring nama/SKU/barcode, maks 20 hasil, skeleton + empty state |
| F3 Hasil harga | ✅ | Bottom sheet (HP) / panel tengah (tablet ≥900px); harga efektif terbesar; badge flash + reguler dicoret + % hemat + countdown WITA; kartu jadwal saat belum mulai; 404 → panel "tidak ditemukan"; stempel "Data diperbarui HH:MM" |
| F4 Riwayat scan | ✅ | Maks 50 entri di `localStorage`, tap untuk buka ulang, hapus semua |
| F5 PWA | ✅ | Manifest + service worker (app shell cache-first, navigasi network-first), ikon 192/512/maskable |

Aturan harga (PRD §6): Opsi A (kolom `flash_mulai`/`flash_selesai`, WITA UTC+8) dengan fallback Opsi B bila periode kosong — dihitung di server `web/lib/catalog.ts::resolveFlash`.

## Struktur

```
frontend/               # prototype fase 1 (HTML/CSS/JS polos, tanpa build)
├── index.html          # shell semua view (gate PIN, scanner, cari, riwayat, sheet hasil)
├── css/app.css         # design token + seluruh styling
├── js/
│   ├── data.js         # stub spreadsheet (30 produk demo, jadwal flash dinamis)
│   ├── api.js          # mock API — kontrak persis PRD §8
│   ├── scanner.js      # BarcodeDetector + fallback ZXing + senter
│   └── app.js          # orkestrasi UI, riwayat, countdown, offline toast
├── manifest.webmanifest
├── sw.js
└── assets/             # ikon PWA
web/                    # fase 2 — Next.js (aktif)
├── app/
│   ├── page.tsx, layout.tsx, globals.css
│   └── api/
│       ├── auth/route.ts     # POST — verifikasi PIN staff (PRD §7.3)
│       ├── price/route.ts    # GET  — harga efektif (PRD §8)
│       └── search/route.ts   # GET  — pencarian maks 20 hasil
├── components/         # ScanView, SearchView, ResultSheet, PinGate, dll.
├── lib/
│   ├── catalog.ts      # TTL 45 dtk + aturan harga WITA (PRD §6)
│   ├── sheets.ts       # klien Google Sheets — service account (PRD §7.2)
│   ├── auth.ts         # cookie HMAC + rate limit (PRD §7.3)
│   └── client-api.ts   # fetch klien + self-heal 401
└── public/             # manifest, sw.js, ikon
tools/
└── make_icons.py       # generator ikon PNG murni Python
```

## Backend (web/) — sudah implementasi

`web/` memakai Route Handler Next.js sesuai PRD §7–§8:

- `GET /api/price?code=` / `GET /api/search?q=` — kontrak PRD §8, `Cookie` staff wajib
- `POST /api/auth` — PIN staff diverifikasi server (`STAFF_PIN`, default `280101`) → cookie httpOnly HMAC 30 hari; rate limit 5 percobaan/10 menit
- Keamanan data API: 60 req/10 detik/IP
- Sumber data: Google Sheets via Service Account (JWT RS256, tanpa dependensi ekstra) + cache TTL 45 detik (`lib/catalog.ts`); jika env Sheets kosong → data demo
- Hardening §12: fetch Sheets gagal → tetap sajikan data terakhir, header `x-data-stale: 1`

Setup data asli:

1. Google Cloud → aktifkan **Google Sheets API**
2. Buat Service Account → beri role **Viewer** → buat JSON key
3. Share spreadsheet ke email service account
4. `cd web && cp .env.example .env.local`, isi `SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`
5. Restart dev server; cek header `x-data-source: sheets`

Baris pertama sheet = header; kolom dikenali fleksibel (`sku`, `barcode`, `nama`/`name`, `harga_reguler`, `harga_flash`, `flash_mulai`, `flash_selesai`, `kategori` opsional). Duplikat/baris invalid dilewati dan dicatat di log server (PRD §5.3).

> Prototype `frontend/` tetap runnable (`python3 -m http.server 8080`) sebagai arsip fase 1; sumber data & PIN di sana masih mock.

## Deploy (Vercel / Cloudflare)

1. Push repo, import project ke Vercel — **Root Directory: `web`**
2. Settings → Environment Variables (scope Production), isi sesuai `.env.example`:
   `SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_PRIVATE_KEY` — tempel apa adanya, parser sudah menormalkan `\n` —,
   `STAFF_PIN`, `AUTH_SECRET`
3. Deploy; cek `x-data-source: sheets` via DevTools Network
4. Kamera & service worker butuh HTTPS — otomatis di domain Vercel

Catatan Cloudflare Pages: build `next build` + `@cloudflare/next-on-pages` butuh penyesuaian runtime edge; Vercel paling langsung untuk stack ini (PRD §7.2).

## Catatan desain

- Palet: porcelain `#F4F1EC` + tinta charcoal `#221F26` + aksen rose `#C2477E` (khusus flash sale) — satu aksen saja.
- Tipografi: Outfit (UI) + JetBrains Mono (semua angka/harga/tabular).
- Angka harga memakai `Intl.NumberFormat("id-ID")` → `Rp 125.000` tanpa desimal.
- Semua tombol ≥ 44 px, `:focus-visible` jelas, `prefers-reduced-motion` dihormati.
