/**
 * Koneksi Google Sheets — SERVER ONLY (PRD §5, §7.4).
 *
 * gaya: Service Account (read-only) + Sheets REST API v4, TANPA dependensi
 * tambahan (JWT ditandatangani pakai node:crypto). Token akses di-cache
 * sampai ~5 menit sebelum kadaluarsa.
 *
 * Env yang dibaca (lihat web/.env.example):
 *   SPREADSHEET_ID                 id spreadsheet (/d/INI_ID/edit)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   client_email dari file JSON key
 *   GOOGLE_PRIVATE_KEY             private_key dari file JSON key
 *   SHEET_RANGE                    default "A1:Z5000"
 *   SHEET_TAB                      opsional — nama tab, mis. "Data"
 *
 * Baris pertama dianggap header. Pemetaan kolom fleksibel (case-insensitive,
 * toleran spasi/garis bawah): kolom `nama` juga cocok dengan `name`/`produk`.
 * Header wajib hilang → SheetsParseError berisi daftar header terbaca.
 *
 * Kalau env belum diisi → tryLoadSheetRows() mengembalikan null (bukan error)
 * dan aplikasi lanjut memakai data demo. Jadi deploy kosong tetap jalan.
 */

import { createSign } from "node:crypto";
import type { SheetRow } from "./catalog";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
/** Refresh token akses 5 menit sebelum benar-benar kadaluarsa. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class SheetsConfigError extends Error {}
export class SheetsFetchError extends Error {}
export class SheetsParseError extends Error {}

export interface LoadedRows {
  rows: SheetRow[];
  fetchedAt: number;
}

/* ---------- Env ---------- */

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function sheetsConfigured(): boolean {
  return Boolean(env("SPREADSHEET_ID") && env("GOOGLE_SERVICE_ACCOUNT_EMAIL") && env("GOOGLE_PRIVATE_KEY"));
}

/** Kembalikan null jika env belum lengkap (mode demo). */
export async function tryLoadSheetRows(): Promise<LoadedRows | null> {
  if (!sheetsConfigured()) return null;
  const rows = await loadSheetRows();
  return { rows, fetchedAt: Date.now() };
}

export async function loadSheetRows(): Promise<SheetRow[]> {
  const spreadsheetId = env("SPREADSHEET_ID") as string;
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL") as string;
  const privateKey = normalizeKey(env("GOOGLE_PRIVATE_KEY") as string);
  const tab = env("SHEET_TAB");
  const range = env("SHEET_RANGE") ?? "A1:Z5000";
  const a1 = tab ? `${tab}!${range.replace(/^[^!]*!/, "")}` : range;

  const values = await fetchSheetValues(spreadsheetId, a1, await getAccessToken(email, privateKey));
  return parseGrid(values);
}

function normalizeKey(raw: string): string {
  // Vercel/dotenv sering menyimpan \n sebagai backslash-n
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/* ---------- Auth: JWT RS256 → access token ---------- */

interface TokenEntry {
  token: string;
  expiresAtMs: number;
}

// simpan di globalThis agar selamat dari reload modul (dev HMR/runtime panas)
const g = globalThis as unknown as { __beautySheetsToken?: TokenEntry };

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Date.now();
  if (g.__beautySheetsToken && g.__beautySheetsToken.expiresAtMs > now) {
    return g.__beautySheetsToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600
  };

  const assertion = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const signature = createSign("RSA-SHA256").update(assertion).sign(privateKey);
  const jwt = `${assertion}.${toB64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!res.ok) {
    throw new SheetsFetchError(`Google OAuth gagal: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new SheetsFetchError("Google OAuth: respons tanpa access_token");

  g.__beautySheetsToken = {
    token: data.access_token,
    expiresAtMs: now + Math.max(60, (data.expires_in ?? 3600) * 1000) - TOKEN_REFRESH_MARGIN_MS
  };
  return g.__beautySheetsToken.token;
}

async function fetchSheetValues(spreadsheetId: string, range: string, token: string): Promise<string[][]> {
  const url =
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}` +
    `?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 403) {
    throw new SheetsFetchError(
      "Sheets API 403 — pastikan spreadsheet di-share ke email service account (role Viewer)"
    );
  }
  if (res.status === 404) {
    throw new SheetsFetchError("Sheets API 404 — SPREADSHEET_ID salah atau nama tab tidak ada");
  }
  if (!res.ok) {
    throw new SheetsFetchError(`Sheets API HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as { values?: unknown };
  if (!Array.isArray(data.values)) throw new SheetsFetchError("Sheets API: respons tanpa values");
  return data.values as string[][];
}

/* ---------- Parse & validasi (PRD §5.2, §5.3) ---------- */

/** Normalisasi nama header: huruf kecil, tanpa spasi/garis bawah. */
function canonHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_\-]+/g, "");
}

const COLUMN_ALIASES: Record<keyof Omit<SheetRow, "kategori">, string[]> = {
  sku: ["sku", "kodeproduk", "kode"],
  barcode: ["barcode", "ean", "upc"],
  nama: ["nama", "name", "namaproduk", "produk", "product", "namabarang"],
  harga_reguler: ["hargareguler", "harga", "regular", "regularprice", "harganormal"],
  harga_flash: ["hargaflash", "flashsale", "flashprice", "hargapromo"],
  flash_mulai: ["flashmulai", "mulai", "start", "flashstart", "starts", "jammulai"],
  flash_selesai: ["flashselesai", "selesai", "end", "akhir", "flashend", "ends", "jamselesai"]
};

const KATEGORI_ALIASES = ["kategori", "category"];

function parseGrid(values: string[][]): SheetRow[] {
  const [header, ...rows] = values;
  if (!header || header.length === 0) {
    throw new SheetsParseError("Sheet kosong — baris pertama harus header kolom");
  }

  const idx: Partial<Record<keyof Omit<SheetRow, "kategori">, number>> = {};
  let kategoriIdx = -1;
  for (let c = 0; c < header.length; c++) {
    const h = canonHeader(String(header[c] ?? ""));
    if (!h) continue;
    for (const key of Object.keys(COLUMN_ALIASES) as Array<keyof typeof COLUMN_ALIASES>) {
      if (idx[key] === undefined && COLUMN_ALIASES[key].includes(h)) idx[key] = c;
    }
    if (kategoriIdx === -1 && KATEGORI_ALIASES.includes(h)) kategoriIdx = c;
  }

  const missing = (["sku", "barcode", "nama", "harga_reguler"] as const).filter((k) => idx[k] === undefined);
  if (missing.length > 0) {
    const legible = header.map((h) => `"${h}"`).join(", ");
    throw new SheetsParseError(
      `Header wajib tidak ditemukan: ${missing.join(", ")}. Header terbaca: ${legible}`
    );
  }

  const seenSku = new Set<string>();
  const seenBarcode = new Set<string>();
  const out: SheetRow[] = [];
  let skipped = 0;

  for (const raw of rows) {
    const cell = (k: keyof typeof idx) => (idx[k] === undefined ? "" : String(raw[idx[k]!] ?? "").trim());
    const sku = cell("sku");
    const barcode = cell("barcode");
    const nama = cell("nama");
    const reguler = parseRupiah(cell("harga_reguler"));

    // baris kosong total → lewati diam-diam
    if (!sku && !barcode && !nama) continue;

    if (!sku || !barcode || !nama || reguler === null) {
      skipped++;
      console.warn(`[sheets] baris dilewati (sku="${sku}" barcode="${barcode}"): data wajib kosong/invalid`);
      continue;
    }
    if (seenSku.has(sku.toLowerCase()) || seenBarcode.has(barcode.toLowerCase())) {
      skipped++;
      console.warn(`[sheets] duplikat diabaikan (PRD §5.3): sku="${sku}" barcode="${barcode}"`);
      continue;
    }

    const harga_flash = parseRupiah(cell("harga_flash"));
    if (harga_flash !== null && harga_flash >= reguler) {
      skipped++;
      console.warn(`[sheets] harga_flash >= reguler, flash diabaikan: sku="${sku}"`);
      continue;
    }

    seenSku.add(sku.toLowerCase());
    seenBarcode.add(barcode.toLowerCase());
    out.push({
      sku,
      barcode,
      nama,
      harga_reguler: reguler,
      harga_flash,
      flash_mulai: normTanggal(cell("flash_mulai")),
      flash_selesai: normTanggal(cell("flash_selesai")),
      kategori: kategoriIdx >= 0 ? String(raw[kategoriIdx] ?? "").trim() : ""
    });
  }

  if (skipped > 0) console.info(`[sheets] selesai: ${out.length} baris valid, ${skipped} dilewati`);
  return out;
}

/** "125000", "Rp 125.000", "125.000" → 125000; kosong/bukan angka → null (§5.3) */
function parseRupiah(s: string): number | null {
  if (!s) return null;
  const neg = s.trim().startsWith("-");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  return neg ? -n : n;
}

/**
 * Terima "2026-10-23 10:00", "2026/10/23 10:00", "23/10/2026 10:00", juga
 * format tampilan locale Indonesia ("23/10/2026 10.00") → bentuk kanonik
 * "YYYY-MM-DD HH:mm" yang diparse parseWita() sebagai WITA.
 */
function normTanggal(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(t);
  const p = (n: number) => String(n).padStart(2, "0");
  if (iso) {
    return `${iso[1]}-${p(+iso[2])}-${p(+iso[3])} ${p(+(iso[4] ?? 0))}:${p(+(iso[5] ?? 0))}`;
  }
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2})[.:](\d{2}))?/.exec(t);
  if (dmy) {
    return `${dmy[3]}-${p(+dmy[2])}-${p(+dmy[1])} ${p(+(dmy[4] ?? 0))}:${p(+(dmy[5] ?? 0))}`;
  }
  return ""; // Opsi B: tanpa periode → flash dianggap aktif (lihat resolveFlash)
}

/* ---------- util base64url ---------- */

function toB64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(v: unknown): string {
  return toB64url(Buffer.from(JSON.stringify(v), "utf8"));
}
