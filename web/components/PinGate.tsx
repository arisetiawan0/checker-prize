"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BrandLogo } from "./icons";

const PIN_KEY = "beauty.pc.unlocked";
// Selaras dengan jeda 300 ms + fade 180 ms pada animasi pin-gate-exit.
const UNLOCK_ANIMATION_MS = 480;
type GatePhase = "idle" | "checking" | "success";

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
  const [phase, setPhase] = useState<GatePhase>("idle");
  const phaseRef = useRef<GatePhase>("idle");
  const boxRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const code = digits.join("");
  const busy = phase !== "idle";
  const success = phase === "success";

  const changePhase = (next: GatePhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const cancelAutoSubmit = () => {
    if (autoSubmitRef.current !== null) clearTimeout(autoSubmitRef.current);
    autoSubmitRef.current = null;
  };

  useEffect(() => {
    if (!busy) boxRefs.current[0]?.focus({ preventScroll: true });
  }, [busy]);

  useEffect(() => () => {
    if (autoSubmitRef.current !== null) clearTimeout(autoSubmitRef.current);
    if (unlockTimerRef.current !== null) clearTimeout(unlockTimerRef.current);
    if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    requestRef.current?.abort();
  }, []);

  const submit = async (val: string) => {
    cancelAutoSubmit();
    // Ref juga menjaga jeda sebelum React me-render state checking.
    if (phaseRef.current !== "idle") return;
    if (!/^\d{6}$/.test(val)) {
      setError("Masukkan lengkap 6 digit kode akses.");
      return;
    }
    setError("");
    changePhase("checking");
    const controller = new AbortController();
    requestRef.current = controller;
    let authenticated = false;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: val }),
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      if (res.status === 429) {
        setError("Terlalu banyak percobaan. Tunggu beberapa menit lagi.");
        return;
      }
      if (!res.ok) {
        setError("Kode akses salah. Coba lagi atau hubungi supervisor.");
        setShake(true);
        if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setShake(false), 450);
        setDigits(Array(6).fill(""));
        navigator.vibrate?.([60, 40, 60]);
        return;
      }
      localStorage.setItem(PIN_KEY, "1");
      authenticated = true;
      changePhase("success");
      navigator.vibrate?.(30);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onUnlock();
      } else {
        unlockTimerRef.current = setTimeout(onUnlock, UNLOCK_ANIMATION_MS);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
      }
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted && !authenticated) changePhase("idle");
    }
  };

  const setAt = (i: number, raw: string) => {
    if (phaseRef.current !== "idle") return;
    cancelAutoSubmit();
    // dukung paste 6 digit sekaligus & ketik beruntun di satu kotak
    const clean = raw.replace(/\D/g, "");
    const next = [...digits];
    if (!clean) {
      if (raw === "") {
        next[i] = "";
        setDigits(next);
        setError("");
      }
      return;
    }
    for (let k = 0; k < clean.length && i + k < 6; k++) next[i + k] = clean[k];
    setDigits(next);
    setError("");
    const filled = next.join("");
    const focusAt = Math.min(i + clean.length, 5);
    boxRefs.current[focusAt]?.focus({ preventScroll: true });
    if (filled.length === 6 && !next.includes("")) {
      const el = boxRefs.current[5];
      el?.blur();
      autoSubmitRef.current = setTimeout(() => {
        autoSubmitRef.current = null;
        void submit(filled);
      }, 140);
    }
  };

  const onBoxKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phaseRef.current !== "idle") return;
    if (e.key === "Backspace") {
      e.preventDefault();
      cancelAutoSubmit();
      setError("");
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
    <section className="pin-gate grain fixed inset-0 flex flex-col items-center overflow-y-auto overflow-x-hidden px-4 py-[max(16px,env(safe-area-inset-top,0px))] pb-[max(16px,env(safe-area-inset-bottom,0px))]"
      data-phase={phase}
      aria-label="Masuk Beauty Price Checker"
      style={{
        background:
          "radial-gradient(120% 90% at 85% -10%, #ffe7d8 0%, transparent 55%), radial-gradient(110% 80% at 0% 110%, #ffd9e8 0%, transparent 55%), var(--color-porcelain)"
      }}
    >
      <div
        aria-hidden
        className="anim-floaty pointer-events-none absolute -top-[220px] right-[-160px] h-[520px] w-[520px] rounded-full blur-[10px]"
        style={{ background: "radial-gradient(circle, rgba(226,88,144,0.28) 0%, transparent 65%)" }}
      />
      <div className="relative z-[1] my-auto w-[min(400px,100%)] py-4">
        <div className="pin-card anim-rise rounded-[28px] border border-line/90 bg-surface px-5 pb-6 pt-[26px] text-center shadow-card sm:px-7 sm:pb-7 sm:pt-[34px]">
          <div className="mb-3 flex flex-col items-center gap-2 sm:mb-[18px]">
            <span aria-hidden="true" className="pin-brand relative grid h-[56px] w-[56px] place-items-center rounded-[17px] border border-line bg-surface text-brand-deep shadow-card">
              <span className="pin-brand-logo"><BrandLogo size={34} /></span>
              <span className="pin-brand-lock absolute"><LockIcon /></span>
            </span>
            <p className="flex flex-col text-[19px] font-bold leading-tight tracking-[-0.01em]">
              <span className="font-display text-[21px]">Beauty</span>
              <span className="mt-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-3">Price Checker</span>
            </p>
          </div>
          <h1 className="font-display text-[23px] font-bold leading-snug tracking-[-0.02em] sm:text-[25px]">Masuk kode akses staff</h1>
          <p id="pin-hint" className="mx-auto mb-4 mt-2 max-w-[30ch] text-[13.5px] text-ink-2 sm:mb-[22px] sm:text-[14.5px]">
            Aplikasi khusus tim internal. Masukkan 6 digit kode akses outlet untuk mulai mengecek harga.
          </p>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit(code);
            }}
          >
            <div className={`relative ${shake ? "anim-shake" : ""}`}>
              <div
                role="group"
                aria-label="Kode akses enam digit"
                aria-describedby="pin-hint pin-error"
                aria-busy={phase === "checking"}
                className="mb-1.5 flex justify-center gap-2 sm:gap-2.5"
              >
                {digits.map((d, i) => (
                  <span
                    key={i}
                    className="pin-digit-slot relative h-[56px] w-full min-w-0 max-w-[46px] sm:h-[58px]"
                    data-filled={Boolean(d)}
                    style={{ "--pin-index": i } as CSSProperties}
                  >
                    <input
                      ref={(el) => {
                        boxRefs.current[i] = el;
                      }}
                      type="password"
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${i + 1} kode akses`}
                      aria-invalid={Boolean(error)}
                      aria-describedby="pin-error"
                      maxLength={6}
                      disabled={busy}
                      className="pin-digit-input h-full w-full rounded-[14px] border-[1.5px] text-center text-[22px] outline-none"
                      value={d}
                      onChange={(e) => setAt(i, e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        setAt(i, e.clipboardData.getData("text"));
                      }}
                      onKeyDown={(e) => onBoxKey(i, e)}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <span aria-hidden="true" className="pin-digit-dot pointer-events-none absolute inset-0 m-auto h-2 w-2 rounded-full" />
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-3.5 mt-1 flex min-h-[24px] items-center justify-center text-[13px]">
              <p id="pin-error" role="alert" className="font-medium text-danger">{error}</p>
              <p role="status" aria-live="polite" className={success ? "font-medium text-[#24754e]" : "text-ink-2"}>
                {!error && (success ? "Kode benar. Membuka aplikasi…" : phase === "checking" ? "Memeriksa kode akses…" : "")}
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="pin-submit flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-brand text-base font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-10px_rgba(198,61,121,0.6)] transition-[transform,background-color] duration-150 enabled:active:scale-[0.975] enabled:hover:bg-brand-deep disabled:cursor-wait"
            >
              <span aria-hidden="true" className="grid h-5 w-5 place-items-center [&_svg]:h-5 [&_svg]:w-5">
                {phase === "checking" ? <span className="pin-spinner" /> : <LockIcon />}
              </span>
              <span key={phase} className="pin-button-label">{success ? "Kunci terbuka" : phase === "checking" ? "Memeriksa…" : "Buka Aplikasi"}</span>
            </button>
          </form>
        </div>
        <p className="relative z-[1] mt-3 shrink-0 text-center text-[12.5px] text-ink-3 sm:mt-4">
          Beauty · PWA internal outlet · v1.0
        </p>
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path className="pin-lock-shackle" d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="5" y="10" width="14" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path className="pin-lock-keyhole" d="M12 14v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path className="pin-lock-check" d="m9 15.5 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
