/**
 * Katalog harga & engine promo — SERVER ONLY (jangan diimpor dari komponen client).
 *
 * Sumber data: spreadsheet promo multi-tab (sheets.ts). Cache TTL 45 dtk —
 * perubahan di spreadsheet terlihat maksimal ~1 menit, kuota Sheets API
 * terlindungi (PRD §7.4).
 *
 * Model data:
 *   PromoRow  — baris di tab promo (SKU PROMO / ONLY DISC REGULER /
 *               ONLY FLASH SALE / LT PRO), memuat diskon reguler & flash.
 *   MasterRow — master POS (semua barcode aktif toko), untuk mengenali
 *               barang non-promo.
 *
 * Aturan harga efektif (resolvePrice):
 *   1. Barcode tidak dikenal di mana pun  → null (404).
 *   2. Hanya ada di master                → non-promo, harga jual normal.
 *   3. Event belum mulai / sudah selesai  → harga jual + info jadwal.
 *   4. Sesi flash berjalan + produk punya disc flash → harga flash,
 *      countdown sampai akhir sesi.
 *   5. Selainnya                          → harga disc reguler
 *      (LT PRO: tier diskon mengikuti tanggal).
 */

import { tryLoadSheetRows } from "./sheets";
import {
  EVENT_END_MS,
  EVENT_START_MS,
  FLASH_SESSIONS,
  eventStatus,
  isoWita,
  nextSession,
  sessionAt,
  sessionEndMs,
  witaOffset,
  type EventStatus as EventStatusType
} from "./promo-config";

export type PromoTab = "promo" | "only-reguler" | "only-flash" | "lt-pro";

export const PROMO_TAB_LABEL: Record<PromoTab, string> = {
  "promo": "SKU Promo",
  "only-reguler": "Only Disc Reguler",
  "only-flash": "Only Flash Sale",
  "lt-pro": "LT Pro"
};

/** Baris promo dari salah satu tab spreadsheet. */
export interface PromoRow {
  barcode: string;
  nama: string;
  tab: PromoTab;
  pareto: string;
  harga_jual: number;
  /** null = tab hanya flash (kolom disc reguler kosong) */
  disc_reguler: number | null;
  harga_reguler_diskon?: number;
  /** null = tab hanya reguler / belum diparse */
  disc_flash: number | null;
  harga_flash_diskon?: number;
  /** khusus LT PRO: tier diskon kedua untuk rentang tanggal berbeda */
  tier2?: { window: { startMs: number; endMs: number }; disc: number };
}

/** Baris master POS — barang yang ada di toko tapi belum tentu ikut promo. */
export interface MasterRow {
  barcode: string;
  nama: string;
  harga_jual: number;
  pareto: string;
}

/* ---------- Demo (env belum diisi) ---------- */

type DemoRow = [barcode: string, nama: string, jual: number, discR: number | null, discF: number | null, tab: PromoTab];

// Mencakup semua kondisi: disc reguler+flash, hanya reguler, hanya flash,
// LT PRO, non-promo (untuk uji coba manual tanpa spreadsheet).
const DEMO_RAW: DemoRow[] = [
  ["8993137691710", "EMINA E/B PENCIL BLACK", 34000, 15, 25, "promo"],
  ["8993137719094", "EMINA TOTAL ECLIPSE PEN LINER", 58500, 15, 25, "promo"],
  ["8993137709576", "EMINA SQUEEZE ME UP BROWCARA WOODY 8G", 60500, 15, 25, "promo"],
  ["8998824552398", "HANASUI SUNSCREEN COLAGEN WATER SPF 30 PA++++ 30GR", 24000, 20, null, "only-reguler"],
  ["8998824553340", "HANASUI SUNSCREEN COLAGEN WATER SPF 50 PA++++ 30GR", 35500, 20, null, "only-reguler"],
  ["8994460551528", "FACETOLOGY DEOXIDE BRIGHT+ RO 60GR EX.WHITE", 42500, null, 20, "only-flash"],
  ["8994460551511", "FACETOLOGY DEOXIDE POWER+ RO 60GR EX.DRY", 42500, null, 20, "only-flash"],
  ["8998113330232", "LT PRO E/B PENSIL BLACK", 90000, 20, null, "lt-pro"],
  ["8998113330171", "LT PRO E/B PENSIL BROWN", 90000, 20, null, "lt-pro"],
  ["4902508798655", "PIGEON SOFTOUCH PLUS NIP 1 BOX M", 51900, null, null, "promo"] // non-promo
];

function demoPromoRows(): PromoRow[] {
  return DEMO_RAW.filter(([, , , discR, discF]) => discR !== null || discF !== null).map(
    ([barcode, nama, jual, discR, discF, tab]) => ({
      barcode,
      nama,
      tab,
      pareto: "SM",
      harga_jual: jual,
      disc_reguler: discR,
      harga_reguler_diskon: discR !== null ? Math.round(jual * (1 - discR / 100)) : undefined,
      disc_flash: discF,
      harga_flash_diskon: discF !== null ? Math.round(jual * (1 - discF / 100)) : undefined,
      // tier2 LT PRO demo: 25% pada hari terakhir event (8 Nov)
      ...(tab === "lt-pro"
        ? { tier2: { window: { startMs: EVENT_END_MS - 24 * 3600 * 1000 + 1, endMs: EVENT_END_MS }, disc: 25 } }
        : {})
    })
  );
}

function demoMasterRows(): MasterRow[] {
  return DEMO_RAW.map(([barcode, nama, jual]) => ({ barcode, nama, harga_jual: jual, pareto: "SM" }));
}

/* ---------- Cache katalog (TTL, PRD §7.4) ---------- */
// Urutan sumber data: Google Sheets → data terakhir yang masih valid (bila
// fetch gagal — hardening risiko §12) → data demo.

interface CatalogCache {
  promo: Map<string, PromoRow>;
  master: Map<string, MasterRow>;
  fetchedAt: number;
  source: CatalogSource;
  /** true = Sheets pernah hidup, fetch terakhir gagal → sedang menyajikan data basi (§12) */
  stale?: boolean;
}

export type { CatalogCache };

export type CatalogSource = "sheets" | "demo";

const TTL_MS = 45_000;
const g = globalThis as unknown as { __beautyCatalog?: CatalogCache };

function buildCache(promoRows: PromoRow[], masterRows: MasterRow[]): Pick<CatalogCache, "promo" | "master"> {
  const promo = new Map<string, PromoRow>();
  for (const r of promoRows) promo.set(r.barcode.toLowerCase(), r);
  const master = new Map<string, MasterRow>();
  for (const r of masterRows) if (!master.has(r.barcode.toLowerCase())) master.set(r.barcode.toLowerCase(), r);
  return { promo, master };
}

export async function getCatalog(): Promise<CatalogCache> {
  const cur = g.__beautyCatalog;
  if (cur && Date.now() - cur.fetchedAt <= TTL_MS) return cur;

  try {
    const fresh = await tryLoadSheetRows();
    if (fresh && (fresh.promoRows.length > 0 || fresh.masterRows.length > 0)) {
      g.__beautyCatalog = {
        ...buildCache(fresh.promoRows, fresh.masterRows),
        fetchedAt: fresh.fetchedAt,
        source: "sheets"
      };
      return g.__beautyCatalog;
    }
    if (fresh) {
      console.warn("[sheets] 0 baris valid — pertahankan data lama/demo (hardening §12)");
    }
  } catch (err) {
    console.warn(`[sheets] fetch gagal, pakai data terakhir: ${err instanceof Error ? err.message : err}`);
  }

  if (cur) return pertahankan(cur);
  g.__beautyCatalog = {
    ...buildCache(demoPromoRows(), demoMasterRows()),
    fetchedAt: Date.now(),
    source: "demo"
  };
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

/* ---------- Engine harga efektif ---------- */

export interface PriceResolve {
  kind: "flash" | "disc" | "normal";
  /** harga efektif sekarang */
  price: number;
  /** persen hemat vs harga jual (bila ada diskon) */
  discount_percent: number | null;
  /** harga jual normal (tanpa promo) */
  harga_jual: number;
  /** harga disc reguler bila produk ikut promo reguler */
  promo_price: number | null;
  /** khusus LT PRO: tier lain yang belum berlaku (untuk tampilan) */
  alt_tier: { disc: number; price: number; startMs: number; endMs: number } | null;
  /** khusus LT PRO: rentang tier-1 (dari awal event s.d. sebelum tier-2) */
  tier1_window: { startMs: number; endMs: number } | null;
  flash_sale: {
    price: number;
    discount_percent: number;
    starts_at: string;
    ends_at: string;
    seconds_remaining: number;
  } | null;
  flash_upcoming: boolean;
  flash_upcoming_price: number | null;
  flash_upcoming_start: string | null;
  promo_status: EventStatusType;
  non_promo: boolean;
}

/**
 * Aturan harga efektif — inti aplikasi. Lihat dokumentasi header modul.
 * `nowMs` selalu dari server (bukan jam HP, §6).
 */
export function resolvePrice(
  promo: PromoRow | undefined,
  master: MasterRow | undefined,
  nowMs: number
): PriceResolve | null {
  if (!promo && !master) return null;

  const harga_jual = promo?.harga_jual ?? master!.harga_jual;
  // khusus LT PRO: jadwal lengkap semua tier tanggal (utk blok "Jadwal harga promo")
  let alt_tier: PriceResolve["alt_tier"] = null;
  if (promo?.tab === "lt-pro" && promo.tier2) {
    const active = nowMs >= promo.tier2.window.startMs && nowMs <= promo.tier2.window.endMs;
    alt_tier = active
      ? null
      : {
          disc: promo.tier2.disc,
          price: Math.round(harga_jual * (1 - promo.tier2.disc / 100)),
          startMs: promo.tier2.window.startMs,
          endMs: promo.tier2.window.endMs
        };
  }
  // tier-1 = kolom DIS (5-7 NOVEMBER): rentangnya diambil dari header tier2 terbalik
  let tier1_window: { startMs: number; endMs: number } | null = null;
  if (promo?.tab === "lt-pro" && promo.tier2) {
    // tier1 berlaku dari awal event sampai sehari sebelum tier2 mulai
    tier1_window = { startMs: EVENT_START_MS, endMs: promo.tier2.window.startMs - 1 };
  }
  const base: PriceResolve = {
    kind: "normal",
    price: harga_jual,
    discount_percent: null,
    harga_jual,
    promo_price: null,
    alt_tier,
    tier1_window,
    flash_sale: null,
    flash_upcoming: false,
    flash_upcoming_price: null,
    flash_upcoming_start: null,
    promo_status: eventStatus(nowMs),
    non_promo: !promo
  };

  if (!promo) return base; // hanya di master → non-promo

  // diskon reguler efektif (LT PRO: tier mengikuti tanggal)
  const discR = efektifDiscReguler(promo, nowMs);
  if (discR !== null) base.promo_price = Math.round(harga_jual * (1 - discR / 100));

  // event di luar rentang → promo tidak berlaku
  if (base.promo_status !== "live") return base;

  // 1) sesi flash berjalan + produk punya disc flash
  const session = sessionAt(nowMs);
  if (session && promo.harga_flash_diskon && promo.harga_flash_diskon < harga_jual) {
    const endMs = sessionEndMs(session, nowMs);
    base.kind = "flash";
    base.price = promo.harga_flash_diskon;
    base.discount_percent = promo.disc_flash ?? persen(harga_jual, promo.harga_flash_diskon);
    base.flash_sale = {
      price: promo.harga_flash_diskon,
      discount_percent: base.discount_percent,
      starts_at: isoWita(nowMs),
      ends_at: isoWita(endMs),
      seconds_remaining: Math.max(0, Math.round((endMs - nowMs) / 1000))
    };
    return base;
  }

  // 2) di luar sesi tapi produk hanya punya flash → info sesi berikutnya
  if (!promo.harga_reguler_diskon && promo.harga_flash_diskon) {
    const next = nextSession(nowMs);
    if (next) {
      base.flash_upcoming = true;
      base.flash_upcoming_price = promo.harga_flash_diskon;
      base.flash_upcoming_start = isoWita(next.startMs);
    }
    return base;
  }

  // 3) disc reguler aktif selama event
  if (base.promo_price !== null && base.promo_price < harga_jual) {
    base.kind = "disc";
    base.price = base.promo_price;
    base.discount_percent = discR;
  }
  return base;
}

/** Disc reguler efektif: LT PRO punya tier kedua untuk rentang tanggal lain. */
function efektifDiscReguler(promo: PromoRow, nowMs: number): number | null {
  if (promo.tab === "lt-pro" && promo.tier2) {
    const { startMs, endMs } = promo.tier2.window;
    if (nowMs >= startMs && nowMs <= endMs) return promo.tier2.disc;
  }
  return promo.disc_reguler;
}

function persen(harga: number, diskon: number): number {
  return Math.max(1, Math.round(((harga - diskon) / harga) * 100));
}

/* ---------- Payload API ---------- */

export function buildPricePayload(
  promo: PromoRow | undefined,
  master: MasterRow | undefined,
  updatedAtMs: number
) {
  const nowMs = Date.now();
  const r = resolvePrice(promo, master, nowMs)!;
  const row = promo ?? master!;
  const tab = promo?.tab ?? null;

  return {
    ok: true as const,
    product: {
      barcode: row.barcode,
      name: row.nama,
      pareto: promo?.pareto ?? master!.pareto,
      promo_tab: tab
    },
    regular_price: r.harga_jual,
    promo_price: r.promo_price,
    promo_status: r.promo_status,
    non_promo: r.non_promo,
    promo_tab_label: tab ? PROMO_TAB_LABEL[tab] : null,
    flash_sale: r.flash_sale,
    flash_upcoming: r.flash_upcoming,
    flash_upcoming_price: r.flash_upcoming_price,
    flash_upcoming_start: r.flash_upcoming_start,
    /** harga flash terjadwal di spreadsheet (tampil walau sesi belum aktif) */
    flash_scheduled_price: promo?.harga_flash_diskon ?? null,
    /**
     * khusus LT PRO: jadwal lengkap harga promo per tier tanggal (berurutan).
     * `active` menandai tier yang sedang berlaku pada nowMs.
     */
    price_schedule: (() => {
      if (promo?.tab !== "lt-pro" || !promo.tier2) return [];
      const jual = promo.harga_jual;
      const list: Array<{ disc: number; price: number; start: string; end: string; active: boolean }> = [];
      if (r.tier1_window) {
        list.push({
          disc: promo.disc_reguler ?? 0,
          price: Math.round(jual * (1 - (promo.disc_reguler ?? 0) / 100)),
          start: isoWita(r.tier1_window.startMs),
          end: isoWita(r.tier1_window.endMs),
          active: nowMs >= r.tier1_window.startMs && nowMs <= r.tier1_window.endMs
        });
      }
      list.push({
        disc: promo.tier2.disc,
        price: Math.round(jual * (1 - promo.tier2.disc / 100)),
        start: isoWita(promo.tier2.window.startMs),
        end: isoWita(promo.tier2.window.endMs),
        active: nowMs >= promo.tier2.window.startMs && nowMs <= promo.tier2.window.endMs
      });
      return list;
    })(),
    effective_price: r.price,
    event: {
      status: r.promo_status,
      start: isoWita(EVENT_START_MS),
      end: isoWita(EVENT_END_MS),
      /** jadwal sesi flash harian (untuk tampilan saat flash belum aktif) */
      sessions: FLASH_SESSIONS.map((s) => s.label)
    },
    data_updated_at: isoWita(updatedAtMs),
    data_updated_hhmm: witaOffset(new Date(updatedAtMs)).split(" ")[1]
  };
}

/** Ringkasan per item untuk /api/search. */
export function buildSearchItem(promo: PromoRow | undefined, master: MasterRow | undefined, nowMs: number) {
  const r = resolvePrice(promo, master, nowMs)!;
  const row = promo ?? master!;
  return {
    barcode: row.barcode,
    name: row.nama,
    regular_price: r.harga_jual,
    promo: !r.non_promo,
    disc_reguler: promo?.disc_reguler ?? null,
    disc_flash: promo?.disc_flash ?? null,
    flash_active: r.kind === "flash",
    flash_price: r.kind === "flash" ? r.price : r.flash_upcoming_price,
    effective_price: r.price
  };
}

/** Jadwal event untuk kebutuhan tampilan (label tanggal mulai/berakhir). */
export function eventInfo() {
  return { start: EVENT_START_MS, end: EVENT_END_MS };
}
