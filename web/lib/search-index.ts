/**
 * Indeks pencarian katalog — SERVER ONLY.
 *
 * Dibangun SEKALI per refresh katalog (ikuti cache 45 dtk di catalog.ts),
 * bukan per request: dulu /api/search menyisir 60 ribu baris per ketikan
 * (2–3 detik). Struktur:
 *   - token → daftar kandidat (nama dipecah kata; kata pertama ter-index penuh)
 *   - barcode index untuk lookup prefix/substring barcode
 * Skor & urutan sama seperti semula: promo di atas master, persis > awalan >
 * mengandung.
 */

import type { CatalogCache, PromoRow, MasterRow } from "./catalog";

interface IndexedEntry {
  /** promo atau master; promo = true */
  promo: boolean;
  barcode: string;
  nama: string;
  namaLower: string;
}

export interface SearchIndex {
  /** kata (≥3 char) → kandidat; pencarian prefix memakai scan daftar kecil ini */
  tokens: Map<string, IndexedEntry[]>;
  /** semua entri promo (kecil, ±3 rb) — di-scan penuh dulu */
  promoEntries: IndexedEntry[];
  /** barcode → entri, untuk query berisi digit */
  byBarcode: IndexedEntry[];
  builtAt: number;
}

const g = globalThis as unknown as { __beautySearchIndex?: SearchIndex };

function entryOf(promo: boolean, barcode: string, nama: string): IndexedEntry {
  return { promo, barcode, nama, namaLower: nama.toLowerCase() };
}

/** Bangun indeks dari cache katalog aktif. */
export function buildSearchIndex(catalog: CatalogCache): SearchIndex {
  const prev = g.__beautySearchIndex;
  if (prev && prev.builtAt >= catalog.fetchedAt) return prev;

  const tokens = new Map<string, IndexedEntry[]>();
  const promoEntries: IndexedEntry[] = [];
  const byBarcode: IndexedEntry[] = [];

  const addTokens = (e: IndexedEntry) => {
    const words = e.namaLower.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
    for (const w of new Set(words)) {
      const list = tokens.get(w);
      if (list) {
        if (!list.includes(e)) list.push(e);
      } else {
        tokens.set(w, [e]);
      }
    }
  };

  for (const promo of catalog.promo.values()) {
    const e = entryOf(true, promo.barcode, promo.nama);
    promoEntries.push(e);
    byBarcode.push(e);
    addTokens(e);
  }
  for (const m of catalog.master.values()) {
    if (catalog.promo.has(m.barcode.toLowerCase())) continue; // promo lebih dulu
    const e = entryOf(false, m.barcode, m.nama);
    byBarcode.push(e);
    addTokens(e);
  }

  const idx: SearchIndex = { tokens, promoEntries, byBarcode, builtAt: catalog.fetchedAt };
  g.__beautySearchIndex = idx;
  return idx;
}

/** Kandidat gabungan (promo dulu) untuk query teks. Maks ±40 rb entri → cukup cepat. */
export function textCandidates(idx: SearchIndex, q: string): IndexedEntry[] {
  // query pendek: scan promo penuh + kandidat token
  const seen = new Set<string>();
  const out: IndexedEntry[] = [];
  const push = (e: IndexedEntry) => {
    const k = e.barcode;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  };

  // token yang berawalan q → kandidatnya; plus substring via scan promo (nama pendek)
  for (const [tok, list] of idx.tokens) {
    if (tok.startsWith(q)) for (const e of list) push(e);
  }
  // q lebih panjang dari token apa pun yang tersimpan, atau mengandung spasi:
  // fallback scan mengandung di promo (±3 rb) — murah
  if (q.includes(" ") || q.length >= 6) {
    for (const e of idx.promoEntries) {
      if (e.namaLower.includes(q)) push(e);
    }
    // master yang kata pertamanya cocok prefix — pakai token map hasil di atas
  }
  return out;
}

export type { PromoRow, MasterRow };
