/**
 * Konfigurasi event promo — SERVER ONLY (PRD §5, §6).
 *
 * Jadwal & sesi flash sale Warehouse Lippo Plaza, 5–8 November 2026 (WITA).
 * Semua nilai bisa dioverride lewat env tanpa deploy ulang kode:
 *   EVENT_START       default "2026-11-05" (WITA, jam 00:00)
 *   EVENT_END         default "2026-11-08" (WITA, sampai jam 23:59:59)
 *   FLASH_SESSIONS    default "12:00-13:00, 15:00-16:00, 18:30-19:30"
 *   SHEET_TAB_*       nama tab pada spreadsheet (lihat sheets.ts)
 *
 * Waktu acuan selalu WITA (UTC+8) — dihitung di server, bukan jam HP (§6).
 */

const WITA_MS = 8 * 3600 * 1000;

export interface FlashSession {
  /** menit dari tengah malam WITA */
  startMin: number;
  endMin: number;
  label: string; // "12:00–13:00"
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/* ---------- Tanggal event ---------- */

/** "YYYY-MM-DD" (WITA) → epoch ms tengah malam WITA. Invalid → NaN. */
function parseWitaDate(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) - WITA_MS;
}

export const EVENT_START_MS = parseWitaDate(env("EVENT_START") ?? "2026-11-05");
/** akhir hari terakhir event (23:59:59.999 WITA) */
export const EVENT_END_MS = parseWitaDate(env("EVENT_END") ?? "2026-11-08") + 24 * 3600 * 1000 - 1;

/* ---------- Sesi flash sale ---------- */

const DEFAULT_SESSIONS = "12:00-13:00, 15:00-16:00, 18:30-19:30";

function parseSessions(raw: string): FlashSession[] {
  const out: FlashSession[] = [];
  for (const part of raw.split(",")) {
    const m = /^\s*(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})\s*$/.exec(part);
    if (!m) continue;
    const startMin = +m[1] * 60 + +m[2];
    const endMin = +m[3] * 60 + +m[4];
    if (endMin > startMin) {
      out.push({ startMin, endMin, label: `${fmtMin(startMin)}–${fmtMin(endMin)}` });
    }
  }
  return out.sort((a, b) => a.startMin - b.startMin);
}

function fmtMin(min: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(min / 60))}:${p(min % 60)}`;
}

export const FLASH_SESSIONS: FlashSession[] = parseSessions(env("FLASH_SESSIONS") ?? DEFAULT_SESSIONS);

/* ---------- Status event & sesi ---------- */

export type EventStatus = "before" | "live" | "after";

export function eventStatus(nowMs: number): EventStatus {
  if (nowMs < EVENT_START_MS) return "before";
  if (nowMs > EVENT_END_MS) return "after";
  return "live";
}

/**
 * Konversi epoch ms → menit-hari WITA + tanggal WITA (epoch tengah malam).
 * Keduanya dipakai untuk mencocokkan sesi harian dan tier tanggal LT PRO.
 */
export function witaParts(nowMs: number): { dayMin: number; dayStartMs: number } {
  const wita = new Date(nowMs + WITA_MS);
  return {
    dayMin: wita.getUTCHours() * 60 + wita.getUTCMinutes(),
    dayStartMs: Date.UTC(wita.getUTCFullYear(), wita.getUTCMonth(), wita.getUTCDate()) - WITA_MS
  };
}

/** Sesi yang sedang berjalan, atau null. */
export function sessionAt(nowMs: number): FlashSession | null {
  const { dayMin } = witaParts(nowMs);
  return FLASH_SESSIONS.find((s) => dayMin >= s.startMin && dayMin < s.endMin) ?? null;
}

export interface NextSession {
  session: FlashSession;
  /** epoch ms mulai sesi */
  startMs: number;
}

/**
 * Sesi flash berikutnya yang masih dalam rentang event (untuk countdown
 * "flash sale mulai jam X"). Null bila event belum mulai / sudah selesai
 * dan tidak ada sesi tersisa.
 */
export function nextSession(nowMs: number): NextSession | null {
  if (eventStatus(nowMs) !== "live") return null;
  const { dayMin, dayStartMs } = witaParts(nowMs);
  for (const s of FLASH_SESSIONS) {
    if (s.startMin > dayMin) {
      return { session: s, startMs: dayStartMs + s.startMin * 60_000 };
    }
  }
  return null;
}

/** Akhir sesi yang sedang berjalan (epoch ms) — dipakai sebagai ends_at countdown. */
export function sessionEndMs(session: FlashSession, nowMs: number): number {
  const { dayStartMs } = witaParts(nowMs);
  return dayStartMs + session.endMin * 60_000;
}

/* ---------- WITA util (dipakai lintas modul server) ---------- */

export function isoWita(ms: number): string {
  return new Date(ms + WITA_MS).toISOString().replace("Z", "+08:00");
}

/** epoch → "YYYY-MM-DD HH:mm" WITA */
export function witaOffset(from: Date, minutes = 0): string {
  const w = new Date(from.getTime() + minutes * 60000 + WITA_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${w.getUTCFullYear()}-${p(w.getUTCMonth() + 1)}-${p(w.getUTCDate())}` +
    ` ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`
  );
}
