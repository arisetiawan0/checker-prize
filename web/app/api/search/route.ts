import { NextRequest, NextResponse } from "next/server";
import { staffOk, rateLimit, unauthorized } from "@/lib/auth";
import { buildCatalogHeaders, getCatalog, buildSearchItem } from "@/lib/catalog";
import { buildSearchIndex } from "@/lib/search-index";
import type { SearchResultItem } from "@/lib/types";

/**
 * GET /api/search?q={teks} — PRD §8. Maks 20 hasil.
 * Memakai indeks pre-built per refresh katalog (lib/search-index.ts) —
 * tidak menyisir 60 rb baris per ketikan.
 * Prioritas: persis barcode > digit akhir barcode (≥6 digit) > awalan nama > mengandung nama > barcode,
 * promo selalu di atas non-promo.
 */
export async function GET(req: NextRequest) {
  if (!staffOk(req)) return unauthorized();
  const limited = rateLimit(req, "api", 60, 10_000); // 60 req / 10 detik / IP
  if (limited) return limited;
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json([]);

  const catalog = await getCatalog();
  const idx = buildSearchIndex(catalog);
  const now = Date.now();
  const digitQuery = /^\d+$/.test(q);

  interface Hit {
    item: ReturnType<typeof buildSearchItem>;
    name: string;
    score: number;
  }
  const hits: Hit[] = [];
  const seen = new Set<string>();

  const push = (entry: { promo: boolean; barcode: string; nama: string }, score: number) => {
    if (seen.has(entry.barcode)) return;
    seen.add(entry.barcode);
    const promo = entry.promo ? catalog.promo.get(entry.barcode.toLowerCase()) : undefined;
    const master = catalog.master.get(entry.barcode.toLowerCase());
    hits.push({ item: buildSearchItem(promo, master, now), name: entry.nama, score });
  };

  if (digitQuery) {
    // query barcode: scan cepat over barcode index (string compare murni)
    for (const e of idx.byBarcode) {
      let score = -1;
      if (e.barcode === q) score = 100;
      else if (q.length >= 6 && e.barcode.endsWith(q)) score = 95;
      else if (e.promo && e.barcode.startsWith(q)) score = 90;
      else if (!e.promo && e.barcode.startsWith(q)) score = 70;
      else if (e.barcode.includes(q)) score = 40;
      if (score > 0) push(e, score);
    }
  } else {
    // query teks: kandidat dari token index + scan promo (±3 rb)
    const candidates = new Map<string, { promo: boolean; barcode: string; nama: string }>();
    for (const [tok, list] of idx.tokens) {
      if (tok.startsWith(q)) {
        for (const e of list) candidates.set(e.barcode, e);
      }
    }
    for (const e of idx.promoEntries) {
      if (e.namaLower.includes(q)) candidates.set(e.barcode, e);
    }
    for (const e of candidates.values()) {
      let score = -1;
      if (e.promo) {
        if (e.barcode === q) score = 100;
        else if (e.nama.toLowerCase().startsWith(q)) score = 80;
        else if (e.nama.toLowerCase().includes(q)) score = 60;
        else score = 50; // cocok via token lain dalam nama
      } else {
        if (e.barcode === q) score = 70;
        else if (e.nama.toLowerCase().startsWith(q)) score = 50;
        else if (e.nama.toLowerCase().includes(q)) score = 30;
        else score = 25;
      }
      if (score > 0) push(e, score);
    }
  }

  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return NextResponse.json(
    hits.slice(0, 20).map((h) => h.item),
    { headers: buildCatalogHeaders(catalog) }
  );
}
