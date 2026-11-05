import type { CatalogCache, MasterRow, PromoRow } from "./catalog";

type CatalogLookup = Pick<CatalogCache, "promo" | "master">;

interface CatalogProduct {
  promo: PromoRow | undefined;
  master: MasterRow | undefined;
}

/** Barcode lengkap diprioritaskan; potongan digit akhir hanya dipakai jika unik. */
export function findCatalogProduct(catalog: CatalogLookup, code: string): CatalogProduct | null {
  const key = code.trim().toLowerCase();
  const promo = catalog.promo.get(key);
  const master = catalog.master.get(key);
  if (promo || master) return { promo, master };

  if (!/^\d{6,}$/.test(key)) return null;

  let matchedKey: string | null = null;
  for (const rows of [catalog.promo, catalog.master]) {
    for (const barcode of rows.keys()) {
      if (!barcode.endsWith(key)) continue;
      // Jangan menampilkan harga barang lain bila potongan barcode ambigu.
      if (matchedKey !== null && matchedKey !== barcode) return null;
      matchedKey = barcode;
    }
  }

  if (matchedKey === null) return null;
  return {
    promo: catalog.promo.get(matchedKey),
    master: catalog.master.get(matchedKey)
  };
}
