/**
 * POST /api/auth — verifikasi kode akses staff (PRD §7.3).
 * Body: {"code":"280101"} → 200 + Set-Cookie httpOnly; 401 salah; 429 rate limit.
 */
import { NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE, createStaffToken, pinMatches, rateLimit } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "auth", 5, 10 * 60 * 1000); // 5 percobaan / 10 menit / IP
  if (limited) return limited;

  let code = "";
  try {
    const body = (await req.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    /* body bukan JSON → code tetap "" → 401 */
  }

  if (!/^\d{6}$/.test(code) || !pinMatches(code)) {
    return NextResponse.json({ error: "WRONG_CODE" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, createStaffToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86_400
  });
  return res;
}
