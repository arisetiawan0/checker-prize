/**
 * Keamanan akses staff — SERVER ONLY (PRD §7.3).
 *
 * Tanpa login penuh, sesuai PRD: PIN staff bersama yang diverifikasi di
 * server, lalu diganti cookie httpOnly bertanda HMAC. API harga pencarian
 * menolak request tanpa cookie sah (401) + rate limit per IP.
 *
 * Env (lihat web/.env.example):
 *   STAFF_PIN     kode akses 6 digit; default "280101" (mode demo)
 *   AUTH_SECRET   opsional, kunci HMAC; default diturunkan dari STAFF_PIN
 *
 * Catatan: rate limit ini in-memory per instance. Untuk traffic tinggi /
 * multi-instance, pindahkan ke upstash/edge runtime (belum perlu untuk
 * skala staff internal).
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const STAFF_COOKIE = "beauty_staff";
const DEFAULT_PIN = "280101"; // konsisten dengan README & chip demo PinGate

/* ---------- PIN & token ---------- */

export function staffPin(): string {
  return process.env.STAFF_PIN?.trim() || DEFAULT_PIN;
}

function authSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    createHash("sha256").update(`beauty-auth:${staffPin()}`).digest("hex")
  );
}

function sign(value: string): string {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

/** Token: "<expEpochDetik>.<hmac>" — kadaluarsa 30 hari. */
export function createStaffToken(ttlDays = 30): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86_400;
  return `${exp}.${sign(exp.toString())}`;
}

export function verifyStaffToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expRaw = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const exp = Number(expRaw);
  if (!Number.isSafeInteger(exp) || exp * 1000 < Date.now()) return false;

  const a = Buffer.from(mac);
  const b = Buffer.from(sign(expRaw));
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- Gate untuk Route Handler ---------- */

/** true jika request membawa cookie staff yang sah. */
export function staffOk(req: NextRequest): boolean {
  return verifyStaffToken(req.cookies.get(STAFF_COOKIE)?.value);
}

/** Respons 401 siap kirim bila gate gagal. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

/* ---------- Rate limit in-memory per IP (PRD §7.3) ---------- */

interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __beautyRate?: Map<string, Bucket> };
const buckets = (g.__beautyRate ??= new Map<string, Bucket>());

/**
 * Kembalikan respons 429 bila melebihi batas, atau null bila boleh lanjut.
 * scope memisahkan kuota "auth" (ketat) dan "api" (longgar).
 */
export function rateLimit(req: NextRequest, scope: string, max: number, windowMs: number): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();

  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  b.count++;
  if (b.count > max) {
    const retry = Math.ceil((b.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }
  return null;
}

/** Bandingkan PIN tanpa kebocoran timing. */
export function pinMatches(input: string): boolean {
  const a = Buffer.from(input.trim());
  const b = Buffer.from(staffPin());
  return a.length === b.length && timingSafeEqual(a, b);
}
