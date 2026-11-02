/* Tipe data kontrak API — sesuai PRD §8, model spreadsheet promo multi-tab */

export type PromoTab = "promo" | "only-reguler" | "only-flash" | "lt-pro";

export interface FlashSale {
  active: true;
  price: number;
  discount_percent: number;
  starts_at: string; // ISO dengan offset +08:00
  ends_at: string; // akhir sesi flash berjalan
  seconds_remaining: number;
}

export interface ProductInfo {
  barcode: string;
  name: string;
  pareto: string;
  /** null = barang non-promo (hanya ada di master POS) */
  promo_tab: PromoTab | null;
}

export interface EventInfo {
  status: "before" | "live" | "after";
  start: string;
  end: string;
  /** jadwal sesi flash harian, mis. ["12:00–13:00", "15:00–16:00", "18:30–19:30"] */
  sessions?: string[];
}

/** 200 GET /api/price */
export interface PriceResponse {
  ok: true;
  product: ProductInfo;
  /** harga jual normal (tanpa promo) */
  regular_price: number;
  /** harga disc reguler selama event; null = tidak ikut promo reguler */
  promo_price: number | null;
  promo_status: "before" | "live" | "after";
  /** true = ada di master POS tapi bukan barang promo */
  non_promo: boolean;
  promo_tab_label: string | null;
  flash_sale: FlashSale | null;
  flash_upcoming: boolean;
  flash_upcoming_price: number | null;
  flash_upcoming_start: string | null;
  /** harga flash terjadwal di spreadsheet (bisa beda dgn flash_upcoming saat event belum mulai) */
  flash_scheduled_price: number | null;
  /** khusus LT PRO: jadwal harga promo per tier tanggal, berurutan; `active` = sedang berlaku */
  price_schedule: Array<{ disc: number; price: number; start: string; end: string; active: boolean }>;
  /** harga efektif sekarang */
  effective_price: number;
  event: EventInfo;
  data_updated_at: string;
  data_updated_hhmm: string;
}

/** 404 GET /api/price — {"error":"PRODUCT_NOT_FOUND"} (PRD §8) */
export interface PriceNotFound {
  error: "PRODUCT_NOT_FOUND";
}

export type PriceResult = PriceResponse | { notFound: true; code: string };

/** item GET /api/search (maks 20) */
export interface SearchResultItem {
  barcode: string;
  name: string;
  regular_price: number;
  /** false = hasil dari master POS (non-promo) */
  promo: boolean;
  disc_reguler: number | null;
  disc_flash: number | null;
  flash_active: boolean;
  flash_price: number | null;
  effective_price: number;
}

export type HistoryKind = "flash" | "disc" | "normal";

export interface HistoryEntry {
  code: string;
  name: string;
  price: number;
  kind: HistoryKind;
  at: number;
}
