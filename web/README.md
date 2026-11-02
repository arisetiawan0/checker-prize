# Beauty Price Checker — Next.js (Fase 2)

Implementasi **Price Checker PWA (Beauty)** sesuai `prd.md` dengan stack PRD §7.2:
**Next.js 15 (App Router) + Tailwind v4 + TypeScript**, backend tipis Route Handler, PWA.

## Menjalankan

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Kode akses demo: **280101**. Di desktop, ketik digit barcode di layar scan lalu Enter untuk simulasi
(juga bisa tap panel "Kamera tidak tersedia" untuk kode sampel). Kamera & PWA butuh HTTPS/localhost.

## Arsitektur

```
web/
├── app/
│   ├── page.tsx               # → <AppShell/> (client)
│   ├── layout.tsx             # font Outfit+JetBrains Mono, metadata PWA, SW register
│   ├── globals.css            # design token Tailwind v4 (@theme) + keyframes
│   └── api/
│       ├── price/route.ts     # GET /api/price?code=  → 200 | 404 PRODUCT_NOT_FOUND (PRD §8)
│       └── search/route.ts    # GET /api/search?q=    → maks 20 hasil
├── lib/
│   ├── promo-config.ts [SERVER] # jadwal event + sesi flash sale WITA (env: EVENT_*, FLASH_SESSIONS)
│   ├── sheets.ts      [SERVER]  # Service Account → values:batchGet 4 tab promo + master POS
│   ├── catalog.ts     [SERVER]  # katalog (Map barcode→promo/master) + cache TTL 45 dtk + resolvePrice
│   ├── types.ts                 # kontrak API bersama
│   └── client-api.ts            # fetch klien + format Rupiah/tanggal
├── components/
│   ├── AppShell.tsx           # orkestrasi state: view, riwayat, sheet, toast, online/offline
│   ├── PinGate.tsx            # gerbang kode akses staff (demo; produksi → verifikasi server)
│   ├── ScanView.tsx           # scanner full-screen + dock; tablet ≥lg: layout dua kolom
│   ├── SearchView.tsx         # pencarian manual, debounce, skeleton, empty state
│   ├── HistoryView.tsx        # riwayat localStorage (50 entri)
│   ├── ResultSheet.tsx        # bottom sheet <lg / panel tengah ≥lg; countdown flash
│   ├── useBarcodeScanner.ts   # BarcodeDetector → fallback @zxing/browser (CDN), senter
│   ├── Toasts.tsx / icons.tsx
│   └── SWRegister.tsx
└── public/
    ├── manifest.webmanifest
    ├── sw.js                  # shell SWR, navigasi network-first, /api/* selalu network
    └── icons/
```

## Harga di-resolve di server (PRD §6)

`lib/catalog.ts::resolvePrice` — urutan aturan: barcode tak dikenal → 404; hanya di master POS →
non-promo (harga jual); event belum mulai/berakhir → harga jual + banner jadwal; sesi flash
berjalan + produk punya disc flash → harga flash + countdown sampai akhir sesi; selainnya →
harga disc reguler (LT PRO: tier per tanggal 5–7 vs 8 November). Semua waktu WITA (UTC+8),
`seconds_remaining` dari server sehingga countdown tidak bergantung jam perangkat.
Katalog di-cache 45 detik — perubahan spreadsheet terlihat ≤ ~1 menit (PRD §7.4).

## Sumber data: spreadsheet promo multi-tab

Satu spreadsheet (id di `SPREADSHEET_ID`), 4 tab produk + master POS tersisip kolom N–Q:

| Tab (env) | Kolom |
|---|---|
| `SHEET_TAB_PROMO` (SKU PROMO) | BARCODE, NAMA, H. JUAL, DISC REGULER, H. DISC REGULER, DISC FLASH SALE, H. DISC FLASH SALE, PARETO |
| `SHEET_TAB_ONLY_REGULER` | sama, kolom flash kosong |
| `SHEET_TAB_ONLY_FLASH` | sama, kolom reguler kosong |
| `SHEET_TAB_LT_PRO` | DIS (5-7 NOVEMBER) / DIS (8 NOVEMBER) — tier per tanggal |

Satu panggilan `values:batchGet` per refresh. Parser menerima format sel Indonesia
(`"34.000"`, `"Rp 29.900,00"`, `"15%"`, `"-"`). Barang non-promo tetap dikenali dari
master POS dan ditampilkan "Harga Normal · Non-Promo".

## Ganti/migrasi spreadsheet

1. Buat service account read-only, share spreadsheet ke email SA (role Viewer).
2. Isi `SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` di `.env.local`
   (lihat `.env.example`). Sesuaikan nama tab bila berbeda.
3. Jadwal event/sesi: `EVENT_START`, `EVENT_END`, `FLASH_SESSIONS` — tanpa deploy ulang.

## Deployment

Vercel/Cloudflare: `npm run build` → deploy folder `web`. SW butuh HTTPS (otomatis di kedua platform).
