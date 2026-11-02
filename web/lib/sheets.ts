/**
 * Koneksi Google Sheets — SERVER ONLY (PRD §5, §7.4).
 *
 * gaya: Service Account (read-only) + Sheets REST API v4, TANPA dependensi
 * tambahan (JWT ditandatangani pakai node:crypto). Token akses di-cache
 * sampai ~5 menit sebelum kadaluarsa.
 *
 * Spreadsheet promo Warehouse Lippo Plaza berisi beberapa tab (lihat
 * promo-config.ts untuk nama tab yang bisa dioverride env):
 *   - tab promo utama (SKU PROMO)        : BARCODE, NAMA, H. JUAL, DISC REGULER,
 *                                          H. DISC REGULER, DISC FLASH SALE,
 *                                          H. DISC FLASH SALE, PARETO
 *   - tab hanya disc reguler             : sama, kolom DISC FLASH kosong/"-"
 *   - tab hanya flash sale               : kolom DISC REGULER kosong/"-"
 *   - tab LT PRO                         : DIS (5-7 NOVEMBER) / DIS (8 NOVEMBER)
 *   - master POS tersisip di kolom kanan : BarcodeAktif, Nama, HJual, Pareto
 *
 * Semua tab diambil dalam SATU permintaan values:batchGet per refresh —
 * frekuensi refresh dibatasi cache TTL 45 dtk di catalog.ts.
 *
 * Env yang dibaca (lihat web/.env.example):
 *   SPREADSHEET_ID                 id spreadsheet (/d/INI_ID/edit)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   client_email dari file JSON key
 *   GOOGLE_PRIVATE_KEY             private_key dari file JSON key
 *
 * Kalau env belum diisi → tryLoadSheetRows() mengembalikan null (bukan error)
 * dan aplikasi lanjut memakai data demo. Jadi deploy kosong tetap jalan.
 */

import { createSign } from "node:crypto";
import type { PromoRow, PromoTab, MasterRow } from "./catalog";
import { EVENT_START_MS } from "./promo-config";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
/** Refresh token akses 5 menit sebelum benar-benar kadaluarsa. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class SheetsConfigError extends Error {}
export class SheetsFetchError extends Error {}
export class SheetsParseError extends Error {}

export interface LoadedCatalog {
  promoRows: PromoRow[];
  masterRows: MasterRow[];
  fetchedAt: number;
}

/* ---------- Env ---------- */

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function tabName(envName: string, fallback: string): string {
  return env(envName) ?? fallback;
}

export function sheetsConfigured(): boolean {
  return Boolean(env("SPREADSHEET_ID") && env("GOOGLE_SERVICE_ACCOUNT_EMAIL") && env("GOOGLE_PRIVATE_KEY"));
}

/** Kembalikan null jika env belum lengkap (mode demo). */
export async function tryLoadSheetRows(): Promise<LoadedCatalog | null> {
  if (!sheetsConfigured()) return null;
  const { promoRows, masterRows } = await loadCatalog();
  return { promoRows, masterRows, fetchedAt: Date.now() };
}

/* ---------- Definisi range batchGet ---------- */

interface TabSpec {
  key: PromoTab;
  envName: string;
  fallback: string;
}

const TAB_SPECS: TabSpec[] = [
  { key: "promo", envName: "SHEET_TAB_PROMO", fallback: "SKU PROMO" },
  { key: "only-reguler", envName: "SHEET_TAB_ONLY_REGULER", fallback: "ONLY DISC REGULER" },
  { key: "only-flash", envName: "SHEET_TAB_ONLY_FLASH", fallback: "ONLY FLASH SALE" },
  { key: "lt-pro", envName: "SHEET_TAB_LT_PRO", fallback: "LT PRO" }
];

/** Kolom master POS tersisip di tiap tab: N..Q = BarcodeAktif, Nama, HJual, Pareto */
const MASTER_RANGE_COLUMNS = "N1:Q100000";
const PROMO_RANGE_COLUMNS = "A1:H100000";

function buildRanges(): string[] {
  const ranges = TAB_SPECS.map((t) => `'${tabName(t.envName, t.fallback)}'!${PROMO_RANGE_COLUMNS}`);
  // master cukup diambil dari tab promo utama saja (identik di semua tab)
  const mainTab = tabName(TAB_SPECS[0].envName, TAB_SPECS[0].fallback);
  ranges.push(`'${mainTab}'!${MASTER_RANGE_COLUMNS}`);
  return ranges;
}

async function loadCatalog(): Promise<{ promoRows: PromoRow[]; masterRows: MasterRow[] }> {
  const spreadsheetId = env("SPREADSHEET_ID") as string;
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL") as string;
  const privateKey = normalizeKey(env("GOOGLE_PRIVATE_KEY") as string);

  const ranges = buildRanges();
  const values = await batchGetValues(spreadsheetId, ranges, await getAccessToken(email, privateKey));

  const promoRows: PromoRow[] = [];
  const seen = new Set<string>();
  let masterRows: MasterRow[] = [];

  TAB_SPECS.forEach((spec, i) => {
    const grid = values[i] ?? [];
    const parsed = parsePromoTab(grid, spec.key);
    for (const row of parsed) {
      const k = row.barcode.toLowerCase();
      if (seen.has(k)) {
        console.warn(`[sheets] barcode duplikat antar-tab, baris pertama dipakai: ${row.barcode} (${spec.key})`);
        continue;
      }
      seen.add(k);
      promoRows.push(row);
    }
  });

  // range terakhir = master POS
  const masterGrid = values[TAB_SPECS.length] ?? [];
  masterRows = parseMasterTab(masterGrid);
  if (masterRows.length === 0) {
    console.warn("[sheets] master POS kosong — barang non-promo tidak akan dikenali");
  }

  console.info(`[sheets] selesai: ${promoRows.length} baris promo, ${masterRows.length} master`);
  return { promoRows, masterRows };
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

async function batchGetValues(
  spreadsheetId: string,
  ranges: string[],
  token: string
): Promise<string[][][]> {
  const params = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  for (const r of ranges) params.append("ranges", r);
  const url = `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params.toString()}`;
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

  const data = (await res.json()) as { valueRanges?: Array<{ values?: unknown }> };
  if (!Array.isArray(data.valueRanges)) throw new SheetsFetchError("Sheets API: respons tanpa valueRanges");
  return data.valueRanges.map((vr) => (Array.isArray(vr.values) ? (vr.values as string[][]) : []));
}

/* ---------- Parse sel ---------- */

/** Normalisasi sel: trim, buang tanda kutip formula, collapse spasi ganda. */
function cell(v: unknown): string {
  return String(v ?? "")
    .replace(/^'/, "")
    .trim();
}

/**
 * "34.000", "Rp 29.900,00", " 34.000 " → 34000 (PRD §5.3: sel non-angka → null).
 * Konvensi Indonesia: titik = pemisah ribuan, koma = desimal.
 */
export function parseRupiahID(s: string): number | null {
  const t = cell(s);
  if (!t || t === "-") return null;
  // buang semua kecuali digit, koma, titik, minus
  let cleaned = t.replace(/[^\d.,-]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const neg = cleaned.startsWith("-");
  cleaned = cleaned.replace(/-/g, "");
  if (cleaned.includes(",")) {
    // koma = desimal: "29.900,00" → "29900.00"
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // titik = ribuan: "34.000" → "34000"
    cleaned = cleaned.replace(/\./g, "");
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return neg ? -n : n;
}

/** "15%", "25", "-" → 15 / 25 / null (persen diskon). */
export function parsePercent(s: string): number | null {
  const t = cell(s);
  if (!t || t === "-") return null;
  const m = /(\d+(?:[.,]\d+)?)/.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return null;
  return n;
}

/* ---------- Parse tab promo ---------- */

const BULAN_ID: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
};

/**
 * Header tier LT PRO seperti "DIS (5-7 NOVEMBER)" → rentang tanggal WITA
 * pada tahun event. Tidak cocok → null.
 */
function parseTierHeader(header: string): { startMs: number; endMs: number } | null {
  const m = /(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([A-Za-z]+)/.exec(header);
  if (!m) return null;
  const month = BULAN_ID[m[3].toLowerCase()];
  if (month === undefined) return null;
  const year = new Date(EVENT_START_MS + 8 * 3600 * 1000).getUTCFullYear();
  const WITA_MS = 8 * 3600 * 1000;
  const dayA = +m[1];
  const dayB = m[2] ? +m[2] : dayA;
  const startMs = Date.UTC(year, month, dayA) - WITA_MS;
  const endMs = Date.UTC(year, month, dayB + 1) - WITA_MS - 1;
  return { startMs, endMs };
}

/**
 * Parse satu tab promo. Baris dipakai jika kolom A berisi angka ≥6 digit
 * (barcode). Baris master (N–Q) yang menerus di kolom A kosong otomatis
 * terlewati. Struktur kolom tetap dibaca per posisi (A..H) sesuai layout
 * spreadsheet, bukan per nama header — karena tiap tab beda label.
 */
function parsePromoTab(grid: string[][], tab: PromoTab): PromoRow[] {
  const out: PromoRow[] = [];
  for (const raw of grid) {
    const barcode = cell(raw[0]);
    if (!/^\d{6,}$/.test(barcode)) continue;

    const nama = cell(raw[1]);
    const harga_jual = parseRupiahID(raw[2]);
    if (!nama || harga_jual === null) {
      console.warn(`[sheets] baris dilewati (${tab}, barcode=${barcode}): nama/harga jual kosong`);
      continue;
    }

    // Pareto selalu kolom H (index 7) di tab 8 kolom; tab 6 kolom di F (index 5)
    const pareto = (tab === "only-reguler" || tab === "only-flash" ? cell(raw[5]) : cell(raw[7])).toUpperCase();

    if (tab === "lt-pro") {
      // LT PRO (8 kolom): D=DIS tier-1, E=H. DIS tier-1, F=DIS tier-2 (8 Nov),
      // G=H. DIS tier-2, H=PARETO. Header tier ada di baris pertama grid (D dan F).
      const headD = grid[0]?.[3] ?? "";
      const headF = grid[0]?.[5] ?? "";
      const tierA = parseTierHeader(headD) ?? { startMs: Number.NEGATIVE_INFINITY, endMs: Number.POSITIVE_INFINITY };
      const tierB = parseTierHeader(headF);
      const discA = parsePercent(raw[3]);
      const discB = parsePercent(raw[5]);
      if (discA === null) {
        console.warn(`[sheets] baris dilewati (lt-pro, barcode=${barcode}): disc tier 1 kosong`);
        continue;
      }
      out.push({
        barcode,
        nama,
        tab,
        pareto,
        harga_jual,
        disc_reguler: discA,
        disc_flash: null,
        tier2: tierB && discB !== null ? { window: tierB, disc: discB } : undefined
      });
      continue;
    }

    // Layout menurut spreadsheet asli:
    //   SKU PROMO (8 kolom): D=DISC REGULER, E=H. DISC REGULER, F=DISC FLASH, G=H. DISC FLASH, H=PARETO
    //   ONLY DISC REGULER (6 kolom): D=DISC, E=H. DISC, F=PARETO
    //   ONLY FLASH SALE  (6 kolom): D=DISC FLASH, E=H. DISC FLASH, F=PARETO
    let dR: number | null = null;
    let hR: number | undefined;
    let dF: number | null = null;
    let hF: number | undefined;
    if (tab === "promo") {
      dR = parsePercent(raw[3]);
      hR = parseRupiahID(raw[4]) ?? (dR !== null ? hargaDiskon(harga_jual, dR) ?? undefined : undefined);
      dF = parsePercent(raw[5]);
      hF = parseRupiahID(raw[6]) ?? (dF !== null ? hargaDiskon(harga_jual, dF) ?? undefined : undefined);
    } else if (tab === "only-reguler") {
      dR = parsePercent(raw[3]);
      hR = parseRupiahID(raw[4]) ?? (dR !== null ? hargaDiskon(harga_jual, dR) ?? undefined : undefined);
    } else {
      // only-flash
      dF = parsePercent(raw[3]);
      hF = parseRupiahID(raw[4]) ?? (dF !== null ? hargaDiskon(harga_jual, dF) ?? undefined : undefined);
    }

    if (hR === undefined && hF === undefined) {
      console.warn(`[sheets] baris dilewati (${tab}, barcode=${barcode}): tidak ada diskon valid`);
      continue;
    }

    out.push({
      barcode,
      nama,
      tab,
      pareto,
      harga_jual,
      disc_reguler: hR !== undefined ? (dR ?? persenDari(harga_jual, hR)) : null,
      harga_reguler_diskon: hR,
      disc_flash: hF !== undefined ? (dF ?? persenDari(harga_jual, hF)) : null,
      harga_flash_diskon: hF
    });
  }
  return out;
}

/** Harga diskon dari persen, dibulatkan ke rupiah penuh. */
function hargaDiskon(harga: number, pct: number): number | null {
  const n = Math.round(harga * (1 - pct / 100));
  return n > 0 ? n : null;
}

/** Persen efektif dari pasangan harga (untuk tampilan chip hemat). */
function persenDari(harga: number, diskon: number): number {
  return Math.max(1, Math.round(((harga - diskon) / harga) * 100));
}

/* ---------- Parse master POS ---------- */

/**
 * Master POS tersisip: kolom N=BarcodeAktif, O=Nama, P=HJual, Q=Pareto.
 * H. jual berformat "Rp 29.900,00".
 */
function parseMasterTab(grid: string[][]): MasterRow[] {
  const out: MasterRow[] = [];
  for (const raw of grid) {
    const barcode = cell(raw[0]); // kolom N → index 0 dari range N:Q
    if (!/^\d{6,}$/.test(barcode)) continue;
    const nama = cell(raw[1]);
    const harga_jual = parseRupiahID(raw[2]);
    if (!nama || harga_jual === null) continue;
    out.push({ barcode, nama, harga_jual, pareto: cell(raw[3]).toUpperCase() });
  }
  return out;
}

/* ---------- util base64url ---------- */

function toB64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(v: unknown): string {
  return toB64url(Buffer.from(JSON.stringify(v), "utf8"));
}
