"use client";

import { useEffect, useState } from "react";
import type { FlashSale, PriceResult, PriceResponse } from "@/lib/types";
import { fmtClock, fmtRupiah, fmtWitaDateID, flashEndMs } from "@/lib/client-api";
import { Icon, initialsOf, toneOf } from "./icons";

interface ResultSheetProps {
  result: PriceResult | null; // null + loading=true → skeleton
  loading: boolean;
  open: boolean;
  nowHHMM: string;
  onClose: () => void;
  onRescan: () => void;
  onManualSearch: (code: string) => void;
  onFlashExpired: (code: string) => void;
}

/**
 * Panel hasil harga: bottom sheet di <lg, panel tengah di ≥lg.
 * Harga efektif selalu elemen terbesar (PRD §9).
 */
export function ResultSheet({
  result,
  loading,
  open,
  nowHHMM,
  onClose,
  onRescan,
  onManualSearch,
  onFlashExpired
}: ResultSheetProps) {
  // countdown lokal
  const [remain, setRemain] = useState<number | null>(null);
  const success = result !== null && !("notFound" in result) ? result : null;
  useEffect(() => {
    const flash = success?.flash_sale ?? null;
    if (!flash) {
      setRemain(null);
      return;
    }
    const end = flashEndMs(flash);
    const code = success ? success.product.barcode || success.product.sku : "";
    const tick = () => {
      const r = end - Date.now();
      setRemain(r);
      if (r <= 0) onFlashExpired(code);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success ? success.product.sku + (success.flash_sale?.ends_at ?? "") : ""]);

  const renderBody = () => {
    if (loading || !result) return <SheetSkeleton />;

    if ("notFound" in result) {
      return (
        <div className="px-[18px] pb-2 pt-[26px] text-center">
          <div className="mx-auto mb-[18px] grid h-[86px] w-[86px] place-items-center rounded-[26px] border border-line bg-surface text-ink-3 shadow-card [&_svg]:h-9 [&_svg]:w-9">
            {Icon.search}
          </div>
          <h3 className="mb-1.5 text-[19px] font-bold tracking-[-0.01em]">Produk tidak ditemukan</h3>
          <p className="mx-auto max-w-[34ch] text-[13.5px] leading-relaxed text-ink-2">
            Kode <code className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-xs">{result.code}</code> tidak
            terdaftar di spreadsheet. Coba cari manual, atau lapor ke admin jika barcode ini seharusnya ada.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onManualSearch(result.code)}
              className="h-12 rounded-[15px] border border-line-strong bg-elev px-5 text-[14.5px] font-semibold text-ink transition hover:bg-white active:scale-[0.975]"
            >
              Cari Manual
            </button>
          </div>
        </div>
      );
    }

    const { product, regular_price, flash_sale, effective_price, data_updated_hhmm, flash_upcoming, flash_upcoming_price, flash_upcoming_start } =
      result as PriceResponse;

    return (
      <>
        {flash_sale ? (
          <FlashHero flash={flash_sale} regular={regular_price} remain={remain} />
        ) : flash_upcoming ? (
          <div className="relative mx-0 mb-4 mt-1 overflow-hidden rounded-3xl px-[22px] pb-[22px] pt-6 text-white"
            style={{
              background:
                "radial-gradient(130% 100% at 85% 0%, rgba(255,122,183,0.30) 0%, transparent 55%), linear-gradient(160deg, #2E2A35 0%, var(--color-night) 70%)"
            }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Harga Reguler</span>
            <div className="mt-2.5 font-mono text-[40px] font-bold leading-none tracking-[-0.02em]">{fmtRupiah(regular_price)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[13.5px] text-white/70">
              <span>
                Flash sale {fmtRupiah(flash_upcoming_price ?? 0)} dimulai {fmtWitaDateID(flash_upcoming_start)} WITA
              </span>
            </div>
          </div>
        ) : (
          <div className="relative mx-0 mb-4 mt-1 overflow-hidden rounded-3xl px-[22px] pb-[22px] pt-6 text-white"
            style={{
              background:
                "radial-gradient(130% 100% at 85% 0%, rgba(255,122,183,0.30) 0%, transparent 55%), linear-gradient(160deg, #2E2A35 0%, var(--color-night) 70%)"
            }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Harga Reguler</span>
            <div className="mt-2.5 font-mono text-[40px] font-bold leading-none tracking-[-0.02em]">{fmtRupiah(regular_price)}</div>
          </div>
        )}

        <div className="flex items-center gap-[15px] px-0.5 pb-[18px] pt-1">
          <div className={`grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[15px] border text-[12.5px] font-bold tracking-[0.04em] ${toneOf(product.sku)}`}>
            {initialsOf(product.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">{product.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-ink-3">
              {product.sku} · {product.barcode}
            </p>
          </div>
        </div>

        <dl>
          <Row dt="Kategori" dd={product.category} />
          <Row dt="Harga reguler" dd={fmtRupiah(regular_price)} />
          {flash_sale ? (
            <>
              <Row dt="Harga flash sale" dd={fmtRupiah(flash_sale.price)} ddClass="text-brand-ink" />
              <Row dt="Berlaku sampai" dd={`${fmtWitaDateID(flash_sale.ends_at)} WITA`} />
            </>
          ) : (
            <Row dt="Flash sale" dd={flash_upcoming ? "Terjadwal" : "Tidak aktif"} />
          )}
          <Row
            dt="Harga efektif sekarang"
            dd={fmtRupiah(effective_price)}
            ddClass="inline-flex items-center gap-1.5 text-ok [&_svg]:h-3.5 [&_svg]:w-3.5"
            ddIcon={Icon.check}
          />
        </dl>

        <div className="mt-[18px] flex flex-wrap justify-between gap-x-[18px] gap-y-2 border-t border-line pt-3 font-mono text-[11.5px] text-ink-3">
          <span>Waktu server WITA · {nowHHMM}</span>
          <span>Data diperbarui {data_updated_hhmm}</span>
        </div>
      </>
    );
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[rgba(16,16,24,0.42)] backdrop-blur-[3px] transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Hasil cek harga"
        className={`fixed left-1/2 bottom-0 z-50 flex h-[min(88dvh,760px)] w-[min(560px,100%)] flex-col rounded-t-[30px] bg-elev shadow-sheet transition-transform duration-[420ms] [transition-timing-function:var(--ease-out-soft)] max-lg:translate-x-[-50%] max-lg:data-[open=false]:translate-y-[105%] max-lg:data-[open=true]:translate-y-0 lg:bottom-auto lg:top-1/2 lg:h-[min(640px,86dvh)] lg:w-[min(480px,calc(100vw-48px))] lg:rounded-[28px] lg:shadow-panel lg:transition-[transform,opacity] lg:duration-[340ms] lg:-translate-x-1/2 lg:-translate-y-[46%] lg:scale-[0.96] lg:opacity-0 lg:data-[open=true]:-translate-y-1/2 lg:data-[open=true]:scale-100 lg:data-[open=true]:opacity-100 ${
          open ? "max-lg:translate-x-[-50%]" : ""
        }`}
        data-open={open}
        hidden={!open && !loading}
      >
        <div aria-hidden className="grid shrink-0 place-items-center pb-1 pt-2.5 max-lg:grids lg:hidden">
          <span className="h-[5px] w-11 rounded-[3px] bg-line-strong" />
        </div>
        <div className="-webkit-overflow-scrolling:touch flex-1 overflow-y-auto px-[22px] pb-[18px] pt-1.5">{renderBody()}</div>
        <div className="grid shrink-0 grid-cols-[1fr_1.6fr] gap-2.5 rounded-b-[30px] border-t border-line bg-elev px-[22px] pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-[54px] rounded-[17px] border border-line-strong bg-elev text-base font-semibold text-ink transition hover:bg-white active:scale-[0.975]"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onRescan}
            className="inline-flex h-[54px] items-center justify-center gap-2 rounded-[17px] bg-night text-base font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_-10px_rgba(16,16,20,0.55)] transition hover:bg-[#24222B] active:scale-[0.975] [&_svg]:h-[19px] [&_svg]:w-[19px]"
          >
            {Icon.scan}
            Scan Lagi
          </button>
        </div>
      </section>
    </>
  );
}

function Row({ dt, dd, ddClass = "", ddIcon }: { dt: string; dd: string; ddClass?: string; ddIcon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3.5 border-t border-line px-0.5 py-3 text-sm">
      <dt className="shrink-0 font-medium text-ink-2">{dt}</dt>
      <dd className={`text-right font-mono text-[13px] font-semibold [overflow-wrap:anywhere] ${ddClass}`}>
        {ddIcon}
        {dd}
      </dd>
    </div>
  );
}

function FlashHero({ flash, regular, remain }: { flash: FlashSale; regular: number; remain: number | null }) {
  const expired = remain !== null && remain <= 0;
  return (
    <div
      className="relative mb-4 mt-1 overflow-hidden rounded-3xl px-[22px] pb-[22px] pt-6 text-white"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(255,122,183,0.38) 0%, transparent 55%), linear-gradient(160deg, #57223D 0%, #3A1B2E 55%, #241019 100%)"
      }}
    >
      <span className="inline-flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-[0.22em] text-[#FFB8D6]">
        <span className="inline-flex text-[#FFD166] [&_svg]:h-[15px] [&_svg]:w-[15px]">{Icon.bolt}</span>
        Flash Sale Berlaku
      </span>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-2 font-mono text-[40px] font-bold leading-[1.05] tracking-[-0.02em]">
        {fmtRupiah(flash.price)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[13.5px] text-white/70">
        <span className="font-mono text-[13px] [text-decoration:line-through] [text-decoration-color:rgba(255,163,205,0.75)] [text-decoration-thickness:2px]">
          {fmtRupiah(regular)}
        </span>
        <span className="rounded-full border border-white/[0.22] bg-white/[0.14] px-2.5 py-1 font-mono text-[12.5px] font-bold text-white">
          Hemat {flash.discount_percent}%
        </span>
      </div>
      <div className="mt-4 hidden items-center gap-2 rounded-[14px] border border-white/20 bg-white/10 px-3.5 py-2.5 data-[show=true]:flex" data-show={!expired}>
        <span className="shrink-0 text-[#FFD166] [&_svg]:h-[17px] [&_svg]:w-[17px]">{Icon.clock}</span>
        <span className="flex-1 font-mono text-[17px] font-bold tracking-[0.03em] [font-variant-numeric:tabular-nums]">
          {remain !== null && remain > 0 && (
            <>
              {fmtClock(remain)}
              <span className="ml-1.5 font-sans text-[11.5px] font-medium tracking-[0.02em] text-white/60">
                {remain >= 3_600_000 ? "jam" : "menit"} lagi
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-col gap-3.5">
        <span className="skel h-[13px] w-[38%] rounded-md" />
        <span className="skel h-[30px] w-[72%] rounded-lg" />
        <span className="skel h-[13px] w-[52%] rounded-md" />
        <span className="skel h-[13px] w-[60%] rounded-md" />
      </div>
    </div>
  );
}
