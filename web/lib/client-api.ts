import type { FlashSale, PriceResult, SearchResultItem } from "@/lib/types";

const PIN_KEY = "beauty.pc.unlocked";

/**
 * Cookie staff mati (kadaluarsa/server restart dengan secret baru) → hapus
 * flag unlock lalu muat ulang sekali, agar PinGate tampil lagi (self-healing).
 */
function authReset() {
  try {
    if (sessionStorage.getItem("beauty.auth-reset") === "1") return;
    sessionStorage.setItem("beauty.auth-reset", "1");
    localStorage.removeItem(PIN_KEY);
    location.reload();
  } catch {
    /* storage tidak tersedia — biarkan error tampil */
  }
}

/** Panggilan klien ke Route Handler — bentuk respons persis PRD §8. */
export async function fetchPrice(code: string, signal?: AbortSignal): Promise<PriceResult> {
  const res = await fetch(`/api/price?code=${encodeURIComponent(code)}`, { signal });
  if (res.status === 401) {
    authReset();
    throw new Error("AUTH_EXPIRED");
  }
  if (res.status === 404) {
    return { notFound: true, code };
  }
  if (!res.ok) {
    throw new Error(`PRICE_HTTP_${res.status}`);
  }
  return (await res.json()) as PriceResult;
}

export async function fetchSearch(q: string, signal?: AbortSignal): Promise<SearchResultItem[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (res.status === 401) {
    authReset();
    throw new Error("AUTH_EXPIRED");
  }
  if (!res.ok) throw new Error(`SEARCH_HTTP_${res.status}`);
  return (await res.json()) as SearchResultItem[];
}

/* ---------- Format util ---------- */

const rupiahFmt = new Intl.NumberFormat("id-ID");
export const fmtRupiah = (n: number) => `Rp ${rupiahFmt.format(n)}`;

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export function fmtWitaDateID(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (isNaN(ms)) return iso ?? "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar"
  }).format(new Date(ms));
}

export function countdownLabel(msRemaining: number): string {
  return msRemaining >= 3_600_000 ? "jam" : "menit";
}

export function flashEndMs(flash: FlashSale): number {
  return Date.parse(flash.ends_at);
}
