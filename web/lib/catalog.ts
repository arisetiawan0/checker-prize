/**
 * Katalog harga — SERVER ONLY (jangan diimpor dari komponen client).
 *
 * Demo: 30 baris statis dengan jadwal flash relatif terhadap waktu proses server,
 * mencakup kondisi aktif / belum mulai / sudah berakhir.
 *
 * Ganti ke Google Sheets (PRD §5, §7.4):
 *   1. Implement `loadSheetRows()` memakai googleapis Service Account (read-only).
 *   2. `getCatalog()` sudah menyediakan cache TTL 45 dtk — kuota Sheets API terlindungi,
 *      perubahan harga terlihat maksimal ~1 menit.
 */

import { tryLoadSheetRows } from "./sheets";

export interface SheetRow {
  sku: string;
  barcode: string;
  nama: string;
  harga_reguler: number;
  harga_flash: number | null;
  flash_mulai: string; // "YYYY-MM-DD HH:mm" WITA
  flash_selesai: string;
  kategori: string;
}

const WITA_MS = 8 * 3600 * 1000;

function witaOffset(from: Date, minutes: number): string {
  const w = new Date(from.getTime() + minutes * 60000 + WITA_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${w.getUTCFullYear()}-${p(w.getUTCMonth() + 1)}-${p(w.getUTCDate())}` +
    ` ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`
  );
}

/** Parse "YYYY-MM-DD HH:mm" sebagai WITA (UTC+8) → epoch ms. Meniru perilaku PRD §6. */
export function parseWita(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - WITA_MS;
}

function isoWita(ms: number): string {
  return new Date(ms + WITA_MS).toISOString().replace("Z", "+08:00");
}

function categoryOf(nama: string): string {
  const n = nama.toLowerCase();
  if (/serum|ampoule|essence|retinol|niacinamide|peptide/.test(n)) return "Perawatan";
  if (/lip|blush|liner|brow|eyeshadow|cushion|foundation|palette|spray|moisturizer/.test(n)) return "Makeup";
  if (/shampoo|mask .*hair|keratin|scalp/.test(n)) return "Rambut";
  if (/body|hand/.test(n)) return "Tubuh";
  return "Skincare";
}

type RawRow = [sku: string, barcode: string, nama: string, reguler: number, flash: number | null, window: [number, number] | null];

// flash window: [menitRelatifMulai, menitRelatifSelesai] dari waktu proses server
const RAW: RawRow[] = [
  ["BK-0001", "8991004102109", "Glow Serum Vit C 30ml", 189000, 139000, [-95, 125]],
  ["BK-0002", "8991004102208", "Hydra Barrier Cream 50g", 249000, null, null],
  ["BK-0003", "8991004102307", "Micellar Water 400ml", 119000, 89000, [-160, 20]],
  ["BK-0004", "8991004102406", "Sunscreen SPF 50 PA++++ 60ml", 159000, 119000, [-30, 150]],
  ["BK-0005", "8991004102505", "AHA BHA Exfoliating Toner 250ml", 175000, null, null],
  ["BK-0006", "8991004102604", "Retinol Night Serum 20ml", 279000, 199000, [-300, 60]],
  ["BK-0007", "8991004102703", "Cushion Foundation #23 15g", 229000, null, null],
  ["BK-0008", "8991004102802", "Matte Lip Mousse - Velvette", 109000, 79000, [-50, 45]],
  ["BK-0009", "8991004102901", "Gentle Gel Cleanser 150ml", 98000, null, null],
  ["BK-0010", "8991004103005", "Peptide Eye Cream 15ml", 215000, 169000, [-500, 200]],
  ["BK-0011", "8991004103104", "Rice Water Shampoo 320ml", 129000, null, null],
  ["BK-0012", "8991004103203", "Keratin Repair Hair Mask 250ml", 149000, 109000, [-120, 480]],
  ["BK-0013", "8991004103302", "Rose Water Face Mist 120ml", 89000, 65000, [25, 95]],
  ["BK-0014", "8991004103401", "Niacinamide 10% Serum 30ml", 165000, null, null],
  ["BK-0015", "8991004103500", "Ceramide Barrier Essence 150ml", 199000, 149000, [-240, -30]],
  ["BK-0016", "8991004103609", "Velvet Blush - Peach Fuzz", 89000, null, null],
  ["BK-0017", "8991004103708", "Precision Liquid Liner 1.2ml", 79000, 59000, [-400, 90]],
  ["BK-0018", "8991004103807", "Brow Sculpt Pencil - Taupe", 69000, null, null],
  ["BK-0019", "8991004103906", "Overnight Sleeping Mask 100ml", 189000, 145000, [-75, 25]],
  ["BK-0020", "8991004104002", "Vitamin C Brightening Sheet Mask (5 pcs)", 95000, null, null],
  ["BK-0021", "8991004104101", "Clay Detox Mask 75g", 119000, 85000, [-600, 180]],
  ["BK-0022", "8991004104200", "Lip Sleeping Butter 20g", 75000, 55000, [-15, 105]],
  ["BK-0023", "8991004104309", "Body Lotion Shea & Oat 250ml", 109000, null, null],
  ["BK-0024", "8991004104408", "Hand Cream Amber Vanilla 50ml", 69000, 49000, [-90, 300]],
  ["BK-0025", "8991004104507", "Pore Cleansing Oil 200ml", 145000, null, null],
  ["BK-0026", "8991004104606", "Tinted Moisturizer SPF 30 40ml", 185000, 139000, [-180, 30]],
  ["BK-0027", "8991004104705", "Setting Spray Dewy Fix 100ml", 99000, null, null],
  ["BK-0028", "8991004104804", "Eyeshadow Palette Muted Muse", 279000, 219000, [-55, 35]],
  ["BK-0029", "8991004104903", "Scalp Tonic Anti Hairfall 120ml", 155000, null, null],
  ["BK-0030", "8991004105009", "Collagen Boost Ampoule 7x2ml", 259000, 199000, [-350, 240]]
];

const BOOT = new Date();

const ROWS: SheetRow[] = RAW.map(([sku, barcode, nama, reguler, flash, win]) => ({
  sku,
  barcode,
  nama,
  harga_reguler: reguler,
  harga_flash: flash,
  flash_mulai: flash !== null && win ? witaOffset(BOOT, win[0]) : "",
  flash_selesai: flash !== null && win ? witaOffset(BOOT, win[1]) : "",
  kategori: categoryOf(nama)
}));

// --- Cache katalog (TTL, PRD §7.4) ---
// Urutan sumber data: Google Sheets → data terakhir yang masih valid (bila She
// fetch gagal — hardening risiko §12) → data demo.
// simpan di globalThis agar selamat dari reload modul (dev HMR)
interface CatalogCache {
  rows: SheetRow[];
  fetchedAt: number;
  source: CatalogSource;
  /** true = Sheets pernah hidup, fetch terakhir gagal → sedang menyajikan data basi (§12) */
  stale?: boolean;
}

export type CatalogSource = "sheets" | "demo";

const TTL_MS = 45_000;
const g = globalThis as unknown as { __beautyCatalog?: CatalogCache };

export async function getCatalog(): Promise<CatalogCache> {
  const cur = g.__beautyCatalog;
  if (cur && Date.now() - cur.fetchedAt <= TTL_MS) return cur;

  try {
    const fresh = await tryLoadSheetRows();
    if (fresh && fresh.rows.length > 0) {
      g.__beautyCatalog = { rows: fresh.rows, fetchedAt: fresh.fetchedAt, source: "sheets" };
      return g.__beautyCatalog;
    }
    if (fresh && fresh.rows.length === 0) {
      console.warn("[sheets] 0 baris valid — pertahankan data lama/demo (hardening §12)");
    }
  } catch (err) {
    console.warn(`[sheets] fetch gagal, pakai data terakhir: ${err instanceof Error ? err.message : err}`);
  }

  if (cur) return pertahankan(cur);
  g.__beautyCatalog = { rows: ROWS, fetchedAt: Date.now(), source: "demo" };
  return g.__beautyCatalog;
}

/** Bila fetch gagal, tenggat coba ulang mundur setengah TTL — tidak memukul Sheets tiap request. */
function pertahankan(cur: CatalogCache): CatalogCache {
  const next: CatalogCache = {
    ...cur,
    fetchedAt: Date.now() - TTL_MS / 2,
    stale: cur.source === "sheets" ? true : cur.stale
  };
  g.__beautyCatalog = next;
  return next;
}

/** Header respons API: anti-cache + debug sumber data. */
export function buildCatalogHeaders(c: CatalogCache): HeadersInit {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "x-data-source": c.source
  };
  if (c.stale) headers["x-data-stale"] = "1";
  return headers;
}

export function findRow(rows: SheetRow[], code: string): SheetRow | null {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  return rows.find((r) => r.barcode.toLowerCase() === c) ?? rows.find((r) => r.sku.toLowerCase() === c) ?? null;
}

export type FlashResolve =
  | {
      status: "active";
      price: number;
      discount_percent: number;
      starts_at: string;
      ends_at: string;
      seconds_remaining: number;
      endMs: number;
    }
  | { status: "upcoming"; price: number; startMs: number }
  | null;

/**
 * Aturan harga efektif — PRD §6.
 * Flash aktif hanya jika: harga_flash terisi && < reguler && sekarang ∈ [mulai, selesai].
 * Tanpa kolom periode (Opsi B): harga_flash terisi = aktif.
 */
export function resolveFlash(row: SheetRow, nowMs: number): FlashResolve {
  if (!row.harga_flash || row.harga_flash >= row.harga_reguler) return null;
  const start = parseWita(row.flash_mulai);
  const end = parseWita(row.flash_selesai);
  const discount = Math.round(((row.harga_reguler - row.harga_flash) / row.harga_reguler) * 100);

  if (!isNaN(start) && !isNaN(end)) {
    if (nowMs >= start && nowMs <= end) {
      return {
        status: "active",
        price: row.harga_flash,
        discount_percent: discount,
        starts_at: isoWita(start),
        ends_at: isoWita(end),
        seconds_remaining: Math.max(0, Math.round((end - nowMs) / 1000)),
        endMs: end
      };
    }
    if (nowMs < start) return { status: "upcoming", price: row.harga_flash, startMs: start };
    return null; // sudah berakhir
  }
  // Opsi B
  return {
    status: "active",
    price: row.harga_flash,
    discount_percent: discount,
    starts_at: isoWita(nowMs),
    ends_at: "",
    seconds_remaining: null as unknown as number,
    endMs: NaN
  };
}

export function buildPricePayload(row: SheetRow, updatedAtMs: number) {
  const nowMs = Date.now();
  const flash = resolveFlash(row, nowMs);
  const active = flash && flash.status === "active" ? flash : null;

  return {
    ok: true as const,
    product: { sku: row.sku, barcode: row.barcode, name: row.nama, category: row.kategori },
    regular_price: row.harga_reguler,
    flash_sale: active
      ? {
          active: true as const,
          price: active.price,
          discount_percent: active.discount_percent,
          starts_at: active.starts_at,
          ends_at: active.ends_at,
          seconds_remaining: active.seconds_remaining
        }
      : null,
    flash_upcoming: flash?.status === "upcoming",
    flash_upcoming_price: flash?.status === "upcoming" ? flash.price : null,
    flash_upcoming_start: flash?.status === "upcoming" ? isoWita(flash.startMs) : null,
    effective_price: active ? active.price : row.harga_reguler,
    data_updated_at: isoWita(updatedAtMs),
    data_updated_hhmm: witaOffset(new Date(updatedAtMs), 0).split(" ")[1]
  };
}
