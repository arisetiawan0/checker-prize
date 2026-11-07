"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo, Icon } from "./icons";
import { useBarcodeScanner } from "./useBarcodeScanner";
import { usePwaInstall } from "./usePwaInstall";
import type { ToastKind } from "./Toasts";

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
  onToast?: (kind: ToastKind, msg: string, ms?: number) => void;
}

/** Scanner penuh layar: viewfinder, status, pill kesegaran data, dock aksi (PRD F1, §9) */
export function ScanView({ active, syncHHMM, online, historyCount, onCode, onOpenSearch, onOpenHistory, onLockout, onToast }: ScanViewProps) {
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

  const { videoRef, status, torchOn, torchSupported, lowLight, start, stop, toggleTorch, simulate } = useBarcodeScanner(onCodeVisual);
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  // senter: beri umpan balik jelas — iOS Safari tidak punya API senter,
  // jadi jangan biarkan tombol gagal diam-diam
  const handleTorch = useCallback(async () => {
    const res = await toggleTorch();
    if (res === "unsupported") {
      onToastRef.current?.("info", "Senter tidak didukung browser ini (umumnya di iPhone) — gunakan senter bawaan HP dari Pusat Kontrol", 4600);
    } else if (res === "failed") {
      onToastRef.current?.("err", "Senter gagal menyala — coba tekan lagi", 3600);
    }
  }, [toggleTorch]);

  // install PWA: Chrome/Edge pakai dialog native; iOS hanya bisa Add to Home Screen manual
  const { installState, install } = usePwaInstall();
  const handleInstall = useCallback(async () => {
    if (installState === "ios") {
      onToastRef.current?.("info", "Di iPhone: buka menu Bagikan (kotak dengan panah) di Safari lalu pilih \"Add to Home Screen\"", 6000);
      return;
    }
    const outcome = await install();
    if (outcome === "accepted") onToastRef.current?.("ok", "Aplikasi terpasang — buka dari home screen", 4200);
  }, [installState, install]);

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
    <section aria-label="Pindai barcode" className="scan-scope grain relative flex min-h-dvh flex-col overflow-hidden text-ink lg:flex-row lg:items-stretch"
      style={{ background: "radial-gradient(130% 85% at 50% 0%, #fff1e6 0%, #ffe7ef 52%, #fdf6f0 100%)" }}
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
                "radial-gradient(120% 70% at 50% 30%, rgba(198,61,121,0.10) 0%, transparent 55%), linear-gradient(180deg, rgba(253,249,244,0) 40%, rgba(255,238,230,0.9) 100%)"
            }}
          >
            <span className="mx-auto grid h-[84px] w-[84px] place-items-center rounded-[26px] border border-line bg-white text-brand shadow-card [&_svg]:h-[38px] [&_svg]:w-[38px]">
              {Icon.scan}
            </span>
            <span className="text-[16.5px] font-semibold">
              {status === "denied" ? "Izin kamera ditolak" : "Kamera tidak tersedia"}
            </span>
            <span className="mx-auto max-w-[34ch] text-[13.5px] text-ink-2">
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
                "radial-gradient(120% 70% at 50% 30%, rgba(198,61,121,0.10) 0%, transparent 55%), linear-gradient(180deg, rgba(253,249,244,0) 40%, rgba(255,238,230,0.9) 100%)"
            }}
          >
            <span className="mx-auto grid h-[84px] w-[84px] place-items-center rounded-[26px] border border-line bg-white text-brand shadow-card [&_svg]:h-[38px] [&_svg]:w-[38px]">
              {Icon.scan}
            </span>
            <span className="font-display text-[19px] font-semibold tracking-[-0.01em]">Mulai Scan</span>
            <span className="mx-auto max-w-[34ch] text-[13.5px] text-ink-2">
              Tap untuk menyalakan kamera. Kamera tidak aktif sampai Anda menekan tombol ini.
            </span>
          </button>
        )}
        {/* viewfinder */}
        {!camDown && !camIdle && (
          <div className={`absolute left-1/2 top-[42%] z-[3] h-[min(78vw,300px)] w-[min(78vw,300px)] -translate-x-1/2 -translate-y-1/2 lg:left-[27%] lg:top-1/2 lg:h-[min(30vw,320px)] lg:w-[min(30vw,320px)] ${foundFlash ? "vf-found" : ""}`}>
            <span className="vf-corner absolute left-0 top-0 h-[34px] w-[34px] rounded-tl-[18px] border-[3px] border-b-0 border-r-0 border-ink/80 transition-colors duration-300" />
            <span className="vf-corner absolute right-0 top-0 h-[34px] w-[34px] rounded-tr-[18px] border-[3px] border-b-0 border-l-0 border-ink/80 transition-colors duration-300" />
            <span className="vf-corner absolute bottom-0 left-0 h-[34px] w-[34px] rounded-bl-[16px] border-[3px] border-r-0 border-t-0 border-ink/80 transition-colors duration-300" />
            <span className="vf-corner absolute bottom-0 right-0 h-[34px] w-[34px] rounded-br-[16px] border-[3px] border-l-0 border-t-0 border-ink/80 transition-colors duration-300" />
            <div className="vf-beam" />
          </div>
        )}
        {/* status pill */}
        {!camDown && !camIdle && statusText && (
          <div className="absolute bottom-[calc(88px+26px)] left-1/2 z-[4] inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white/90 px-4 py-2 text-[13.5px] font-medium text-ink-2 shadow-card backdrop-blur-md lg:bottom-auto lg:top-[calc(50%-min(15vw,160px)+26px)]">
            <span className="anim-breathe h-2 w-2 shrink-0 rounded-full bg-ok" />
            {statusText}
            {demoBuffer && <span className="font-mono text-ink-3">({demoBuffer}…)</span>}
          </div>
        )}
        {/* saran senter saat scene gelap (malam hari) — tappable bila senter didukung */}
        {!camDown && !camIdle && lowLight && status === "running" && !torchOn && (
          <div className="absolute bottom-[calc(88px+74px)] left-1/2 z-[4] -translate-x-1/2">
            {torchSupported === false ? (
              <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-warn-line bg-warn-bg px-4 py-2 text-[13px] font-semibold text-warn shadow-card">
                <span className="shrink-0 [&_svg]:h-[16px] [&_svg]:w-[16px]">{Icon.torch}</span>
                Cahaya kurang — gunakan senter bawaan HP
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleTorch()}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-warn-line bg-warn-bg px-4 py-2 text-[13px] font-semibold text-warn shadow-card transition active:scale-95"
              >
                <span className="shrink-0 [&_svg]:h-[16px] [&_svg]:w-[16px]">{Icon.torch}</span>
                Cahaya kurang — nyalakan senter
              </button>
            )}
          </div>
        )}
      </div>

      {/* header */}
      <header className="relative z-[5] flex items-center justify-between gap-3 pb-0 pl-5 pr-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] max-lg:w-full lg:absolute lg:left-0 lg:right-0 lg:top-0 lg:px-7 lg:pt-[calc(env(safe-area-inset-top,0px)+22px)]">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={30} className="drop-shadow-[0_3px_8px_rgba(198,61,121,0.28)]" />
          <div className="flex flex-col leading-[1.15]">
            <strong className="font-display text-[17.5px] font-bold tracking-[-0.01em]">Beauty</strong>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-3">Price Checker</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            title="Kesegaran data spreadsheet"
            className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white/90 px-3.5 font-mono text-[11.5px] font-medium tracking-[0.02em] text-ink-2 shadow-card backdrop-blur-md ${online ? "" : "is-stale"}`}
          >
            <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${online ? "anim-breathe bg-ok" : "bg-warn"}`} />
            {/* di layar kecil tampil singkat (jam saja) agar muat bersama tombol install */}
            {online ? (
              <>
                <span className="max-lg:hidden">Data diperbarui </span>
                <span>{syncHHMM.split(" ").pop()}</span>
              </>
            ) : (
              <>
                <span className="max-lg:hidden">Offline — data mungkin usang</span>
                <span className="lg:hidden">Offline</span>
              </>
            )}
          </span>
          {installState !== "standalone" && installState !== "unsupported" && (
            <button
              type="button"
              aria-label="Pasang aplikasi di home screen"
              title={installState === "ios" ? "Add to Home Screen" : "Pasang aplikasi"}
              onClick={() => void handleInstall()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-line bg-white/90 text-ink shadow-card backdrop-blur-md transition hover:bg-white active:scale-95 [&_svg]:h-[21px] [&_svg]:w-[21px]"
            >
              {Icon.install}
            </button>
          )}
          <button
            type="button"
            aria-label="Keluar dari aplikasi"
            title="Keluar"
            onClick={onLockout}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-line bg-white/90 text-ink shadow-card backdrop-blur-md transition hover:bg-white active:scale-95 [&_svg]:h-[21px] [&_svg]:w-[21px]"
          >
            {Icon.lock}
          </button>
        </div>
      </header>

      {/* hint tengah (mobile) — disembunyikan saat saran senter tampil agar tidak bertumpuk */}
      {!camDown && !camIdle && !(lowLight && status === "running" && !torchOn) && (
        <p className="relative z-[4] mb-[calc(88px+12px)] mt-auto px-6 text-center text-[13.5px] leading-[1.6] text-ink-2 max-lg:block lg:absolute lg:left-[27%] lg:top-1/2 lg:m-0 lg:w-[min(30vw,320px)] lg:-translate-x-1/2 lg:-translate-y-[calc(50%+min(15vw,160px)+52px)]">
          Arahkan kamera ke barcode produk. EAN-13, EAN-8, UPC-A, Code 128, dan QR didukung.
        </p>
      )}

      {/* dock */}
      <nav aria-label="Aksi scan" className="relative z-[5] mx-auto mb-[calc(env(safe-area-inset-bottom,0px)+18px)] mt-auto flex w-[min(560px,calc(100%-24px))] justify-center gap-2 rounded-[26px] border border-white/70 bg-white/85 p-2.5 shadow-dock backdrop-blur-lg max-lg:translate-x-0 lg:absolute lg:left-[73%] lg:top-1/2 lg:m-0 lg:w-[min(230px,24vw)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:flex-col lg:p-3">
        <button
          type="button"
          aria-pressed={torchOn}
          disabled={status !== "running"}
          onClick={() => void handleTorch()}
          className={`relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-[5px] rounded-[18px] px-1.5 py-[9px] text-xs font-semibold tracking-[0.02em] transition active:scale-95 disabled:opacity-[0.38] lg:min-h-[60px] lg:flex-none lg:flex-row lg:justify-start lg:px-[18px] lg:text-sm lg:gap-3 ${
            torchOn ? "bg-ink text-white shadow-[0_8px_20px_-8px_rgba(60,40,30,0.5)]" : "text-ink-2 hover:bg-brand-bg hover:text-brand-ink"
          }`}
        >
          <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{Icon.torch}</span>
          Senter
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="relative flex min-h-[58px] flex-[1.35] flex-col items-center justify-center gap-[5px] rounded-[18px] bg-brand px-1.5 py-[9px] text-xs font-semibold tracking-[0.02em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_20px_-8px_rgba(198,61,121,0.6)] transition hover:bg-brand-deep active:scale-95 lg:min-h-[60px] lg:flex-none lg:flex-row lg:justify-start lg:px-[18px] lg:text-sm lg:gap-3"
        >
          <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{Icon.lines}</span>
          Input Manual
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          className="relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-[5px] rounded-[18px] px-1.5 py-[9px] text-xs font-semibold tracking-[0.02em] text-ink-2 transition hover:bg-brand-bg hover:text-brand-ink active:scale-95 lg:min-h-[60px] lg:flex-none lg:flex-row lg:justify-start lg:px-[18px] lg:text-sm lg:gap-3"
        >
          <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{Icon.history}</span>
          Riwayat
          {historyCount > 0 && (
            <span className="absolute right-[14%] top-1 grid h-[18px] min-w-[18px] place-items-center rounded-[9px] border-2 border-white bg-brand px-1 font-mono text-[10.5px] font-bold text-white lg:right-3.5 lg:top-1/2 lg:-translate-y-1/2">
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
