"use client";

import { useEffect, useRef, useState } from "react";

const PIN_KEY = "beauty.pc.unlocked";

interface PinGateProps {
  onUnlock: () => void;
}

/**
 * Gerbang kode akses staff — PRD §7.3.
 * PIN diverifikasi di server via POST /api/auth; cookie httpOnly diberikan
 * saat berhasil. PIN di-set lewat env STAFF_PIN (tanpa env: fallback 280101).
 *
 * Input utama = 6 kotak terpisah (auto-focus pindah, paste didukung).
 */
export function PinGate({ onUnlock }: PinGateProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));

  const code = digits.join("");

  useEffect(() => {
    boxRefs.current[0]?.focus({ preventScroll: true });
  }, []);

  const submit = async (val: string) => {
    if (busy) return;
    if (val.length < 6) {
      setError("Masukkan lengkap 6 digit kode akses.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: val })
      });
      if (res.status === 429) {
        setError("Terlalu banyak percobaan. Tunggu beberapa menit lagi.");
        return;
      }
      if (!res.ok) {
        setError("Kode akses salah. Coba lagi atau hubungi supervisor.");
        setShake(true);
        setTimeout(() => setShake(false), 450);
        setDigits(Array(6).fill(""));
        boxRefs.current[0]?.focus({ preventScroll: true });
        navigator.vibrate?.([60, 40, 60]);
        return;
      }
      localStorage.setItem(PIN_KEY, "1");
      navigator.vibrate?.(30);
      onUnlock();
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const setAt = (i: number, raw: string) => {
    // dukung paste 6 digit sekaligus & ketik beruntun di satu kotak
    const clean = raw.replace(/\D/g, "");
    if (!clean) return;
    const next = [...digits];
    for (let k = 0; k < clean.length && i + k < 6; k++) next[i + k] = clean[k];
    setDigits(next);
    setError("");
    const filled = next.join("");
    const focusAt = Math.min(i + clean.length, 5);
    boxRefs.current[focusAt]?.focus({ preventScroll: true });
    if (filled.length === 6 && !next.includes("")) {
      const el = boxRefs.current[5];
      el?.blur();
      setTimeout(() => submit(filled), 140);
    }
  };

  const onBoxKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
        setDigits(next);
      } else if (i > 0) {
        next[i - 1] = "";
        setDigits(next);
        boxRefs.current[i - 1]?.focus({ preventScroll: true });
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      boxRefs.current[i - 1]?.focus({ preventScroll: true });
    }
    if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      boxRefs.current[i + 1]?.focus({ preventScroll: true });
    }
  };

  return (
    <section className="fixed inset-0 grid place-items-center overflow-y-auto overflow-x-hidden px-4 py-[max(16px,env(safe-area-inset-top,0px))] pb-[max(16px,env(safe-area-inset-bottom,0px))]"
      style={{
        background:
          "radial-gradient(120% 90% at 85% -10%, #E9E0F4 0%, transparent 55%), radial-gradient(110% 80% at 0% 110%, var(--color-brand-bg) 0%, transparent 55%), var(--color-porcelain)"
      }}
    >
      <div
        aria-hidden
        className="anim-floaty pointer-events-none absolute -top-[220px] right-[-160px] h-[520px] w-[520px] rounded-full blur-[10px]"
        style={{ background: "radial-gradient(circle, rgba(194,71,126,0.22) 0%, transparent 65%)" }}
      />
      <div className="anim-rise relative z-[1] my-auto w-[min(400px,100%)] rounded-[28px] border border-line/90 bg-surface px-5 pb-6 pt-[26px] text-center shadow-card sm:px-7 sm:pb-7 sm:pt-[34px]">
        <div className="mb-3 flex flex-col items-center gap-2 sm:mb-[18px]">
          <span className="grid h-[52px] w-[52px] place-items-center rounded-[17px] bg-gradient-to-b from-[#2B2733] to-[#15131A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_22px_-10px_rgba(21,19,26,0.55)]">
            <BrandIcon />
          </span>
          <p className="flex flex-col text-[19px] font-bold leading-tight tracking-[-0.01em]">
            Beauty
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">Price Checker</span>
          </p>
        </div>
        <h1 className="text-[21px] font-bold leading-snug tracking-[-0.02em] sm:text-[23px]">Masuk kode akses staff</h1>
        <p className="mx-auto mb-4 mt-2 max-w-[30ch] text-[13.5px] text-ink-2 sm:mb-[22px] sm:text-[14.5px]">
          Aplikasi khusus tim internal. Masukkan 6 digit kode akses outlet untuk mulai mengecek harga.
        </p>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
          }}
        >
          <div className={`relative ${shake ? "anim-shake" : ""}`} aria-hidden={false}>
            <div className="mb-1.5 flex justify-center gap-2 sm:gap-2.5">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    boxRefs.current[i] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${i + 1} kode akses`}
                  maxLength={6}
                  disabled={busy}
                  className={`h-[56px] w-full min-w-0 max-w-[46px] rounded-[14px] border-[1.5px] text-center font-mono text-[22px] font-semibold outline-none transition-colors duration-150 sm:h-[58px] sm:w-[46px] ${
                    d
                      ? "border-ink bg-white"
                      : "border-line-strong bg-elev focus:border-brand focus:bg-white focus:shadow-[0_0_0_3.5px_var(--color-brand-bg)]"
                  }`}
                  value={d}
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => onBoxKey(i, e)}
                  onFocus={(e) => e.currentTarget.select()}
                />
              ))}
            </div>
          </div>
          <p role="alert" aria-live="polite" className={`mb-3.5 mt-0.5 min-h-[21px] text-[13.5px] ${error ? "font-medium text-danger" : "text-ink-2"}`}>
            {error}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="h-[54px] w-full rounded-[17px] bg-night text-base font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_-10px_rgba(16,16,20,0.55)] transition active:scale-[0.975] hover:bg-[#24222B] disabled:opacity-70"
          >
            {busy ? "Memeriksa…" : "Buka Aplikasi"}
          </button>
        </form>
      </div>
      <p className="relative z-[1] mt-3 shrink-0 text-center text-[12.5px] text-ink-3 sm:mt-4">
        Beauty · PWA internal outlet · v1.0
      </p>
    </section>
  );
}

function BrandIcon() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9.5 12 4l8 5.5v6.2c0 .9-.5 1.7-1.3 2.1l-6.2 3a1.9 1.9 0 0 1-1.7 0l-6.2-3A2.4 2.4 0 0 1 4 15.7V9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 12.5c.6.9 2 1.6 3.5 1.6s2.9-.7 3.5-1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="9.8" r="1" fill="currentColor" />
      <circle cx="15" cy="9.8" r="1" fill="currentColor" />
    </svg>
  );
}
