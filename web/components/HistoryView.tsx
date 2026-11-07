"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, initialsOf, toneOf } from "./icons";
import { fmtRupiah } from "@/lib/client-api";
import type { HistoryEntry } from "@/lib/types";

interface HistoryViewProps {
  active: boolean;
  entries: HistoryEntry[];
  onBack: () => void;
  onPick: (code: string) => void;
  onClear: () => void;
  onStartScan: () => void;
}

/** Riwayat scan: 20–50 terakhir, tersimpan lokal (PRD F4) */
export function HistoryView({ active, entries, onBack, onPick, onClear, onStartScan }: HistoryViewProps) {
  // konfirmasi dua langkah pengganti confirm() native
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) setConfirming(false);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  if (!active) return null;

  const armConfirm = () => {
    setConfirming(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setConfirming(false), 4000);
  };

  const when = (at: number) =>
    new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(at)) +
    " · " +
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(at));

  return (
    <section aria-label="Riwayat scan" className="anim-view-in mx-auto min-h-dvh max-w-[760px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+40px)] pt-[calc(env(safe-area-inset-top,0px)+14px)] md:pt-[calc(env(safe-area-inset-top,0px)+26px)]">
      <header className="flex items-center gap-3.5 pb-[18px] pt-2.5">
        <button
          type="button"
          aria-label="Kembali ke scanner"
          onClick={onBack}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-line-strong bg-surface text-ink transition hover:bg-elev active:scale-95 [&_svg]:h-[21px] [&_svg]:w-[21px]"
        >
          {Icon.back}
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[23px] font-bold leading-tight tracking-[-0.02em]">Riwayat Scan</h2>
          <p className="mt-px text-[13.5px] text-ink-3">
            {entries.length ? `${entries.length} scan terakhir · tersimpan di perangkat ini` : "Tersimpan di perangkat ini"}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            aria-live="polite"
            onClick={() => (confirming ? onClear() : armConfirm())}
            className={`min-h-[44px] rounded-[12px] px-3 text-sm font-semibold transition active:scale-95 ${
              confirming ? "bg-danger text-white hover:bg-[#8C2C22]" : "text-danger hover:bg-[#FBEDEB]"
            }`}
          >
            {confirming ? "Yakin? Ketuk lagi" : "Hapus"}
          </button>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="px-6 pb-[30px] pt-[54px] text-center">
          <div className="mx-auto mb-[18px] grid h-[76px] w-[76px] place-items-center rounded-3xl border border-line bg-elev text-ink-3 [&_svg]:h-8 [&_svg]:w-8">
            {Icon.history}
          </div>
          <h3 className="font-display text-[18px] font-bold tracking-[-0.01em]">Belum ada scan</h3>
          <p className="mx-auto mt-1.5 mb-[18px] max-w-[36ch] text-[13.5px] leading-relaxed text-ink-2">
            Setiap barcode yang berhasil dipindai atau kode yang dicari akan muncul di sini, siap dibuka ulang.
          </p>
          <button
            type="button"
            onClick={onStartScan}
            className="inline-flex h-[54px] items-center justify-center gap-2 rounded-[17px] border border-line-strong bg-elev px-[22px] text-base font-semibold text-ink transition hover:bg-white active:scale-[0.975]"
          >
            <span className="[&_svg]:h-[19px] [&_svg]:w-[19px]">{Icon.scan}</span>
            Mulai Scan
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 pb-10">
          {entries.map((h, i) => (
            <button
              key={h.code + h.at}
              type="button"
              onClick={() => onPick(h.code)}
              style={{ animationDelay: `${Math.min(i * 35, 240)}ms` }}
              className="anim-rise grid w-full grid-cols-[42px_1fr_auto] items-center gap-3.5 rounded-2xl border border-line bg-surface p-[11px] pl-[11px] pr-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-card active:scale-[0.985]"
            >
              <span className={`grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-[11px] border text-[10.5px] font-bold tracking-[0.04em] ${toneOf(h.name || h.code)}`}>
                {initialsOf(h.name || h.code)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{h.name || h.code}</span>
                <span className="mt-px block truncate font-mono text-[11.5px] text-ink-3">{h.code}</span>
              </span>
              <span className="flex-none text-right">
                <span className={`block font-mono text-[13px] font-bold ${h.kind === "flash" ? "text-brand-ink" : "text-ink"}`}>{fmtRupiah(h.price)}</span>
                <span className="mt-0.5 block text-right font-mono text-[11px] font-medium text-ink-3">{when(h.at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
