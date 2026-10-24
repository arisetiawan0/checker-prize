import { NextRequest, NextResponse } from "next/server";
import { staffOk, rateLimit, unauthorized } from "@/lib/auth";
import { buildCatalogHeaders, getCatalog, findRow, buildPricePayload } from "@/lib/catalog";
import type { PriceNotFound } from "@/lib/types";

/**
 * GET /api/price?code={barcode|sku} — PRD §8
 * 200: payload harga; 404: {"error":"PRODUCT_NOT_FOUND"}; 401: butuh cookie staff.
 */
export async function GET(req: NextRequest) {
  if (!staffOk(req)) return unauthorized();
  const limited = rateLimit(req, "api", 60, 10_000); // 60 req / 10 detik / IP
  if (limited) return limited;

  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "PRODUCT_NOT_FOUND" } satisfies PriceNotFound, { status: 404 });
  }

  const catalog = await getCatalog();
  const row = findRow(catalog.rows, code);
  if (!row) {
    return NextResponse.json({ error: "PRODUCT_NOT_FOUND" } satisfies PriceNotFound, { status: 404 });
  }

  return NextResponse.json(buildPricePayload(row, catalog.fetchedAt), {
    headers: buildCatalogHeaders(catalog)
  });
}
