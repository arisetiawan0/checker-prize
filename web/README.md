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
│   ├── catalog.ts   [SERVER]  # katalog + cache TTL 45 dtk + resolveFlash (aturan PRD §6, WITA UTC+8)
│   ├── types.ts               # kontrak API bersama
│   └── client-api.ts          # fetch klien + format Rupiah/tanggal
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

`lib/catalog.ts::resolveFlash` — flash aktif hanya jika `harga_flash` terisi && < reguler &&
`sekarang ∈ [flash_mulai, flash_selesai]` (WITA). Respons memuat `seconds_remaining` dari server,
jadi countdown tidak bergantung jam perangkat. Katalog di-cache 45 detik — perubahan spreadsheet
terlihat ≤ ~1 menit dan kuota API sumber terlindungi (PRD §7.4).

## Ganti demo → Google Sheets

1. `npm i googleapis`, buat service account read-only, share spreadsheet ke email SA.
2. Di `lib/catalog.ts`, ganti isi cache `getCatalog()` dengan `loadSheetRows()` memakai struktur
   kolom PRD §5.2 (`sku, barcode, nama, harga_reguler, harga_flash, flash_mulai, flash_selesai`).
3. Simpan kredensial di env (`GOOGLE_SERVICE_ACCOUNT_JSON`), tidak pernah di klien.
4. PIN demo di `PinGate.tsx` → ganti dengan POST /api/auth server-side (PRD §7.3).

## Deployment

Vercel/Cloudflare: `npm run build` → deploy folder `web`. SW butuh HTTPS (otomatis di kedua platform).
