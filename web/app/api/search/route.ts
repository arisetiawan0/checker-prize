import { NextRequest, NextResponse } from "next/server";
import { staffOk, rateLimit, unauthorized } from "@/lib/auth";
import { buildCatalogHeaders, getCatalog, buildSearchItem } from "@/lib/catalog";
import type { SearchResultItem } from "@/lib/types";

/**
 * GET /api/search?q={teks} — PRD §8. Maks 20 hasil.
 * Prioritas: barang promo (skor persis barcode > awalan nama > mengandung nama >
 * mengandung barcode), lalu barang non-promo dari master POS.
 */
export async function GET(req: NextRequest) {
  if (!staffOk(req)) return unauthorized();
  const limited = rateLimit(req, "api", 60, 10_000); // 60 req / 10 detik / IP
  if (limited) return limited;
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json([]);

  const catalog = await getCatalog();
  const now = Date.now();
  const scored: Array<SearchResultItem & { _score: number; _name: string }> = [];

  for (const promo of catalog.promo.values()) {
    const name = promo.nama.toLowerCase();
    let score = -1;
    if (promo.barcode === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (promo.barcode.includes(q)) score = 40;
    if (score <= 0) continue;

    scored.push({
      ...buildSearchItem(promo, catalog.master.get(promo.barcode.toLowerCase()), now),
      _score: score,
      _name: promo.nama
    });
  }

  // barang non-promo dari master (skor lebih rendah, hanya kalau slot tersisa)
  for (const m of catalog.master.values()) {
    if (catalog.promo.has(m.barcode.toLowerCase())) continue; // sudah masuk sebagai promo
    const name = m.nama.toLowerCase();
    let score = -1;
    if (m.barcode === q) score = 70;
    else if (name.startsWith(q)) score = 50;
    else if (name.includes(q)) score = 30;
    else if (m.barcode.includes(q)) score = 20;
    if (score <= 0) continue;

    scored.push({ ...buildSearchItem(undefined, m, now), _score: score, _name: m.nama });
  }

  scored.sort((a, b) => b._score - a._score || a._name.localeCompare(b._name));
  return NextResponse.json(
    scored.slice(0, 20).map((item) => {
      const { _score: _s, _name: _n, ...rest } = item;
      void _s;
      void _n;
      return rest;
    }),
    { headers: buildCatalogHeaders(catalog) }
  );
}
