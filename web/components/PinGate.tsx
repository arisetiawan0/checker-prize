"use client";

import { useEffect, useRef, useState } from "react";

const PIN_KEY = "beauty.pc.unlocked";

interface PinGateProps {
  onUnlock: () => void;
}

/**
 * Gerbang kode akses staff — PRD §7.3.
 * PIN diverifikasi di server via POST /api/auth; cookie httpOnly diberikan
 * saat berhasil. Default PIN "280101" saat STAFF_PIN env tidak di-set.
 */
export function PinGate({ onUnlock }: PinGateProps) {
  const DEMO_PIN = "280101";
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = async (val: string) => {
    if (val.length < 6) {
      setError("Masukkan lengkap 6 digit kode akses.");
      return;
    }
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
        setDigits("");
        navigator.vibrate?.([60, 40, 60]);
        return;
      }
      localStorage.setItem(PIN_KEY, "1");
      navigator.vibrate?.(30);
      onUnlock();
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  };

  const cells = Array.from({ length: 6 }, (_, i) => digits[i]);

  return (
    <section className="fixed inset-0 grid place-items-center overflow-hidden px-5 py-6"
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
      <div className="anim-rise relative z-[1] w-[min(400px,100%)] rounded-[28px] border border-line/90 bg-surface px-7 pb-7 pt-[34px] text-center shadow-card">
        <div className="mb-[18px] flex flex-col items-center gap-2.5">
          <span className="grid h-[52px] w-[52px] place-items-center rounded-[17px] bg-gradient-to-b from-[#2B2733] to-[#15131A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_22px_-10px_rgba(21,19,26,0.55)]">
            <BrandIcon />
          </span>
          <p className="flex flex-col text-[19px] font-bold leading-tight tracking-[-0.01em]">
            Beauty
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">Price Checker</span>
          </p>
        </div>
        <h1 className="text-[23px] font-bold leading-snug tracking-[-0.02em]">Masuk kode akses staff</h1>
        <p className="mx-auto mb-[22px] mt-2 max-w-[30ch] text-[14.5px] text-ink-2">
          Aplikasi khusus tim internal. Masukkan 6 digit kode akses outlet untuk mulai mengecek harga.
        </p>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit(digits);
          }}
        >
          <div className={`relative ${shake ? "anim-shake" : ""}`}>
            <div className="mb-1.5 flex justify-center gap-2.5" aria-hidden>
              {cells.map((d, i) => (
                <span
                  key={i}
                  className={`grid h-[58px] w-[46px] place-items-center rounded-[14px] border-[1.5px] font-mono text-[22px] font-semibold transition-colors duration-150 ${
                    d
                      ? "border-ink bg-white"
                      : i === digits.length
                        ? "border-brand bg-white shadow-[0_0_0_3.5px_var(--color-brand-bg)]"
                        : "border-line-strong bg-elev"
                  }`}
                >
                  {d ? "•" : ""}
                </span>
              ))}
            </div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              aria-label="Kode akses 6 digit"
              className="absolute bottom-2.5 left-10 z-[1] h-px w-px border-0 p-0 opacity-[0.001]"
              value={digits}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setDigits(v);
                setError("");
                if (v.length === 6) setTimeout(() => submit(v), 140);
              }}
            />
          </div>
          <p role="alert" aria-live="polite" className={`mb-3.5 mt-0.5 min-h-[21px] text-[13.5px] ${error ? "font-medium text-danger" : "text-ink-2"}`}>
            {error}
          </p>
          <button type="submit" className="h-[54px] w-full rounded-[17px] bg-night text-base font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_-10px_rgba(16,16,20,0.55)] transition active:scale-[0.975] hover:bg-[#24222B]">
            Buka Aplikasi
          </button>
          <p className="mt-4 text-[13px] text-ink-3">
            Demo prototype: gunakan kode{" "}
            <button
              type="button"
              onClick={() => {
                setDigits(DEMO_PIN);
                setTimeout(() => submit(DEMO_PIN), 160);
              }}
              className="rounded-full border border-brand-line bg-brand-bg px-2.5 py-0.5 align-middle font-mono text-[13px] font-semibold tracking-[0.08em] text-brand-ink transition hover:bg-brand-line"
            >
              280101
            </button>
          </p>
        </form>
      </div>
      <p className="absolute bottom-[max(18px,calc(env(safe-area-inset-bottom,0px)+12px))] left-0 right-0 text-center text-[12.5px] text-ink-3">
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
