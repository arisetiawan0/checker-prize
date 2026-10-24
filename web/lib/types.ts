/* Tipe data kontrak API — sesuai PRD §8 */

export interface FlashSale {
  active: true;
  price: number;
  discount_percent: number;
  starts_at: string; // ISO dengan offset +08:00
  ends_at: string;
  seconds_remaining: number;
}

export interface ProductInfo {
  sku: string;
  barcode: string;
  name: string;
  category: string;
}

/** 200 GET /api/price */
export interface PriceResponse {
  ok: true;
  product: ProductInfo;
  regular_price: number;
  flash_sale: FlashSale | null;
  flash_upcoming: boolean;
  flash_upcoming_price: number | null;
  flash_upcoming_start: string | null;
  effective_price: number;
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
  sku: string;
  barcode: string;
  name: string;
  regular_price: number;
  flash_active: boolean;
  flash_price: number | null;
}

export interface HistoryEntry {
  code: string;
  sku: string;
  name: string;
  price: number;
  flash: boolean;
  at: number;
}
