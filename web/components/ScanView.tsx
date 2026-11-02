"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark, Icon } from "./icons";
import { useBarcodeScanner } from "./useBarcodeScanner";

export type ViewName = "scan" | "search" | "history";

/** Sudah pernah menyalakan kamera di sesi halaman ini (reset saat reload) */
let camStartedOnce = false;

interface ScanViewProps {
  active: boolean; // view sedang tampil
  syncHHMM: string; // "Data diperbarui HH:MM"
  online: boolean;
  historyCount: number;
  onCode: (code: string) => void;
  onOpenSearch: () => void;
  onOpenHistory: () => void;
  onLockout: () => void;
}

/** Scanner penuh layar: viewfinder, status, pill kesegaran data, dock aksi (PRD F1, §9) */
export function ScanView({ active, syncHHMM, online, historyCount, onCode, onOpenSearch, onOpenHistory, onLockout }: ScanViewProps) {
  const [foundFlash, setFoundFlash] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [demoBuffer, setDemoBuffer] = useState("");
  const startedRef = useRef(false);

  // efek visual ketika kode terdeteksi: flash viewfinder + status + getar
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const onCodeVisual = useCallback((code: string) => {
    setFoundFlash(true);
    setStatusText(`Kode terbaca: ${code}`);
    navigator.vibrate?.(45);
    onCodeRef.current(code);
    setTimeout(() => setFoundFlash(false), 900);
  }, []);

  const { videoRef, status, torchOn, start, stop, toggleTorch, simulate } = useBarcodeScanner(onCodeVisual);

  // tap-to-start: kamera hanya menyala setelah tombol "Mulai Scan" ditekan
  const handleStart = useCallback(() => {
    camStartedOnce = true;
    void start();
  }, [start]);

  // saat kembali ke view scan setelah kamera pernah aktif di sesi ini, hidupkan lagi
  useEffect(() => {
    if (active && camStartedOnce && !startedRef.current) {
      startedRef.current = true;
      void start();
    }
    if (!active) {
      startedRef.current = false;
      if (camStartedOnce) stop(); // matikan kamera saat pindah view, hemat baterai
    }
  }, [active, start, stop]);

  useEffect(() => {
    if (status === "running") setStatusText("Kamera siap — arahkan ke barcode");
    else if (status === "starting") setStatusText("Menyiapkan kamera…");
    else setStatusText("");
  }, [status]);

  // keyboard demo desktop: ketik digit lalu Enter
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Enter" && demoBuffer.length >= 8) {
        simulate(demoBuffer);
        setDemoBuffer("");
        return;
      }
      if (/^\d$/.test(e.key)) {
        setDemoBuffer((b) => (b + e.key).slice(-14));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, demoBuffer, simulate]);

  const camDown = status === "unsupported" || status === "denied" || status === "error";
  const camIdle = !camStartedOnce && status === "idle";

  return (
    <section aria-label="Pindai barcode" className="scan-scope relative flex min-h-dvh flex-col overflow-hidden text-white lg:flex-row lg:items-stretch"
      style={{ background: "radial-gradient(140% 90% at 50% 0%, #232028 0%, var(--color-night) 58%)" }}
    >
      {/* kamera */}
      <div className="absolute inset-0">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {camDown && (
          <button
            type="button"
            onClick={() => simulate(DEMO_CODES[Math.floor(Math.random() * DEMO_CODES.length)])}
            className="absolute inset-0 grid place-items-center content-center gap-3.5 px-10 pb-[10dvh] text-center"
            style={{
              background:
                "radial-gradient(120% 70% at 50% 30%, rgba(194,71,126,0.10) 0%, transparent 55%), linear-gradient(180deg, rgba(16,16,20,0) 40%, rgba(10,10,14,0.85) 100%)"
            }}
          >
            <span className="mx-auto grid h-[84px] w-[84px] place-items-center rounded-[26px] border border-white/[0.16] bg-white/[0.06] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] [&_svg]:h-[38px] [&_svg]:w-[38px]">
              {Icon.scan}
            </span>
            <span className="text-[16.5px] font-semibold">
              {status === "denied" ? "Izin kamera ditolak" : "Kamera tidak tersedia"}
            </span>
            <span className="mx-auto max-w-[34ch] text-[13.5px] text-white/60">
              {status === "denied"
                ? "Buka izin kamera di pengaturan browser, atau gunakan input manual."
                : "Gunakan input manual untuk mengetik barcode atau SKU. Tap panel ini untuk mencoba kode sampel."}
            </span>
          </button>
        )}
        {/* gate tap-to-start: kamera belum pernah dinyalakan di sesi ini */}
        {camIdle && (
          <button
            type="button"
            onClick={handleStart}
            className="absolute inset-0 grid place-items-center content-center gap-3.5 px-10 pb-[10dvh] text-center"
            style={{
              background:
                "radial-gradient(120% 70% at 50% 30%, rgba(194,71,126,0.10) 0%, transparent 55%), linear-gradient(180deg, rgba(16,16,20,0) 40%, rgba(10,10,14,0.85) 100%)"
            }}
          >
            <span className="mx-auto grid h-[84px] w-[84px] place-items-center rounded-[26px] border border-white/[0.16] bg-white/[0.06] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] [&_svg]:h-[38px] [&_svg]:w-[38px]">
              {Icon.scan}
            </span>
            <span className="text-[16.5px] font-semibold">Mulai Scan</span>
            <span className="mx-auto max-w-[34ch] text-[13.5px] text-white/60">
              Tap untuk menyalakan kamera. Kamera tidak aktif sampai Anda menekan tombol ini.
            </span>
          </button>
        )}
        {/* viewfinder */}
        {!camDown && !camIdle && (
          <div className={`absolute left-1/2 top-[42%] z-[3] h-[min(78vw,300px)] w-[min(78vw,300px)] -translate-x-1/2 -translate-y-1/2 lg:left-[27%] lg:top-1/2 lg:h-[min(30vw,320px)] lg:w-[min(30vw,320px)] ${foundFlash ? "vf-found" : ""}`}>
            <span className="vf-corner absolute left-0 top-0 h-[34px] w-[34px] rounded-tl-[18px] border-[3px] border-b-0 border-r-0 border-white/90 transition-colors duration-300" />
            <span className="vf-corner absolute right-0 top-0 h-[34px] w-[34px] rounded-tr-[18px] border-[3px] border-b-0 border-l-0 border-white/90 transition-colors duration-300" />
            <span className="vf-corner absolute bottom-0 left-0 h-[34px] w-[34px] rounded-bl-[16px] border-[3px] border-r-0 border-t-0 border-white/90 transition-colors duration-300" />
            <span className="vf-corner absolute bottom-0 right-0 h-[34px] w-[34px] rounded-br-[16px] border-[3px] border-l-0 border-t-0 border-white/90 transition-colors duration-300" />
            <div className="vf-beam" />
          </div>
        )}
        {/* status pill */}
        {!camDown && !camIdle && statusText && (
          <div className="absolute bottom-[calc(88px+26px)] left-1/2 z-[4] inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.09] bg-[rgba(12,12,16,0.66)] px-4 py-2 text-[13.5px] font-medium text-white/90 backdrop-blur-md lg:bottom-auto lg:top-[calc(50%-min(15vw,160px)+26px)]">
            <span className="anim-breathe h-2 w-2 shrink-0 rounded-full bg-[#5ED5A8]" />
            {statusText}
            {demoBuffer && <span className="font-mono text-white/60">({demoBuffer}…)</span>}
          </div>
        )}
      </div>

      {/* header */}
      <header className="relative z-[5] flex items-center justify-between gap-3 pb-0 pl-5 pr-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] max-lg:w-full lg:absolute lg:left-0 lg:right-0 lg:top-0 lg:px-7 lg:pt-[calc(env(safe-area-inset-top,0px)+22px)]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-gradient-to-b from-[#2B2733] to-[#15131A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
            <BrandMark size={21} />
          </span>
          <div className="flex flex-col leading-[1.15]">
            <strong className="text-[16.5px] font-bold tracking-[-0.01em]">Beauty</strong>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/55">Price Checker</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            title="Kesegaran data spreadsheet"
            className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.09] bg-[rgba(12,12,16,0.55)] px-3.5 font-mono text-[11.5px] font-medium tracking-[0.02em] text-white/85 backdrop-blur-md ${online ? "" : "is-stale"}`}
          >
            <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${online ? "anim-breathe bg-[#5ED5A8]" : "bg-[#E8B45A]"}`} />
            {online ? syncHHMM : "Offline — data mungkin usang"}
          </span>
          <button
            type="button"
            aria-label="Keluar dari aplikasi"
            title="Keluar"
            onClick={onLockout}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-white/[0.09] bg-[rgba(12,12,16,0.55)] text-white backdrop-blur-md transition hover:bg-[rgba(30,30,36,0.7)] active:scale-95 [&_svg]:h-[21px] [&_svg]:w-[21px]"
          >
            {Icon.lock}
          </button>
        </div>
      </header>

      {/* hint tengah (mobile) */}
      {!camDown && !camIdle && (
        <p className="relative z-[4] mb-[calc(88px+12px)] mt-auto px-6 text-center text-[13.5px] leading-[1.6] text-white/60 max-lg:block lg:absolute lg:left-[27%] lg:top-1/2 lg:m-0 lg:w-[min(30vw,320px)] lg:-translate-x-1/2 lg:-translate-y-[calc(50%+min(15vw,160px)+52px)]">
          Arahkan kamera ke barcode produk. EAN-13, EAN-8, UPC-A, Code 128, dan QR didukung.
        </p>
      )}

      {/* dock */}
      <nav aria-label="Aksi scan" className="relative z-[5] mx-auto mb-[calc(env(safe-area-inset-bottom,0px)+18px)] mt-auto flex w-[min(560px,calc(100%-24px))] justify-center gap-2 rounded-[26px] border border-white/[0.16] bg-[rgba(15,15,19,0.78)] p-2.5 backdrop-blur-lg shadow-dock max-lg:translate-x-0 lg:absolute lg:left-[73%] lg:top-1/2 lg:m-0 lg:w-[min(230px,24vw)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:flex-col lg:p-3">
        <button
          type="button"
          aria-pressed={torchOn}
          disabled={status !== "running"}
          onClick={() => void toggleTorch()}
          className="relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-[5px] rounded-[18px] px-1.5 py-[9px] text-xs font-semibold tracking-[0.02em] text-white/80 transition hover:bg-white/[0.07] hover:text-white active:scale-95 disabled:opacity-[0.38] lg:min-h-[60px] lg:flex-none lg:flex-row lg:justify-start lg:px-[18px] lg:text-sm lg:gap-3"
        >
          <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{Icon.torch}</span>
          Senter
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="relative flex min-h-[58px] flex-[1.35] flex-col items-center justify-center gap-[5px] rounded-[18px] bg-white px-1.5 py-[9px] text-xs font-semibold tracking-[0.02em] text-night shadow-[inset_0_1px_0_#fff,0_8px_20px_-8px_rgba(0,0,0,0.5)] transition hover:bg-[#F2EEE7] active:scale-95 lg:min-h-[60px] lg:flex-none lg:flex-row lg:justify-start lg:px-[18px] lg:text-sm lg:gap-3"
        >
          <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{Icon.lines}</span>
          Input Manual
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          className="relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-[5px] rounded-[18px] px-1.5 py-[9px] text-xs font-semibold tracking-[0.02em] text-white/80 transition hover:bg-white/[0.07] hover:text-white active:scale-95 lg:min-h-[60px] lg:flex-none lg:flex-row lg:justify-start lg:px-[18px] lg:text-sm lg:gap-3"
        >
          <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{Icon.history}</span>
          Riwayat
          {historyCount > 0 && (
            <span className="absolute right-[14%] top-1 grid h-[18px] min-w-[18px] place-items-center rounded-[9px] border-2 border-[rgba(23,23,28,0.9)] bg-brand px-1 font-mono text-[10.5px] font-bold text-white lg:right-3.5 lg:top-1/2 lg:-translate-y-1/2">
              {historyCount > 9 ? "9+" : historyCount}
            </span>
          )}
        </button>
      </nav>
    </section>
  );
}

// barcode demo (mode tanpa env): 2 SKU PROMO, only-reguler, only-flash, LT PRO,
// non-promo (master), dan 1 barcode yang memang tidak terdaftar
const DEMO_CODES = [
  "8993137691710",
  "8993137709576",
  "8998824552398",
  "8994460551528",
  "8998113330232",
  "4902508798655",
  "9999999999999"
];
