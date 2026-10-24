import { NextRequest, NextResponse } from "next/server";
import { staffOk, rateLimit, unauthorized } from "@/lib/auth";
import { buildCatalogHeaders, getCatalog, resolveFlash } from "@/lib/catalog";
import type { SearchResultItem } from "@/lib/types";

/**
 * GET /api/search?q={teks} — PRD §8. Maks 20 hasil.
 * Skor: persis SKU/barcode > awalan SKU > awalan nama > mengandung nama > SKU > barcode.
 */
export async function GET(req: NextRequest) {
  if (!staffOk(req)) return unauthorized();
  const limited = rateLimit(req, "api", 60, 10_000); // 60 req / 10 detik / IP
  if (limited) return limited;
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json([]);

  const catalog = await getCatalog();
  const scored: Array<SearchResultItem & { _score: number }> = [];

  for (const r of catalog.rows) {
    const name = r.nama.toLowerCase();
    let score = -1;
    if (r.sku.toLowerCase() === q || r.barcode === q) score = 100;
    else if (r.sku.toLowerCase().startsWith(q)) score = 90;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (r.sku.toLowerCase().includes(q)) score = 50;
    else if (r.barcode.includes(q)) score = 40;
    if (score <= 0) continue;

    const f = resolveFlash(r, Date.now());
    scored.push({
      sku: r.sku,
      barcode: r.barcode,
      name: r.nama,
      regular_price: r.harga_reguler,
      flash_active: f?.status === "active",
      flash_price: f?.status === "active" ? f.price : null,
      _score: score
    });
  }

  scored.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
  return NextResponse.json(
    scored.slice(0, 20).map((item) => {
      const { _score: _omit, ...rest } = item;
      void _omit;
      return rest;
    }),
    { headers: buildCatalogHeaders(catalog) }
  );
}
