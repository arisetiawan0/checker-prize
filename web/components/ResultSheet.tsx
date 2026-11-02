"use client";

import { useEffect, useRef, useState } from "react";
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
  const sectionRef = useRef<HTMLElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  /* Esc untuk tutup + pindahkan fokus ke dialog saat dibuka, kembalikan saat ditutup */
  useEffect(() => {
    if (!open) {
      lastFocusRef.current?.focus?.({ preventScroll: true });
      lastFocusRef.current = null;
      return;
    }
    lastFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    sectionRef.current?.focus({ preventScroll: true });
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const success = result !== null && !("notFound" in result) ? result : null;
  useEffect(() => {
    const flash = success?.flash_sale ?? null;
    if (!flash) {
      setRemain(null);
      return;
    }
    const end = flashEndMs(flash);
    const code = success?.product.barcode ?? "";
    const tick = () => {
      const r = end - Date.now();
      setRemain(r);
      if (r <= 0) onFlashExpired(code);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success ? success.product.barcode + (success.flash_sale?.ends_at ?? "") : ""]);

  /** Tab berputar di dalam dialog — fokus tidak bocor ke latar belakang */
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const root = sectionRef.current;
    if (!root) return;
    const els = Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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

    const {
      product,
      regular_price,
      promo_price,
      promo_status,
      non_promo,
      promo_tab_label,
      flash_sale,
      effective_price,
      data_updated_hhmm,
      flash_upcoming,
      flash_upcoming_price,
      flash_upcoming_start,
      flash_scheduled_price,
      alt_tier,
      event
    } = result as PriceResponse;

    // harga flash di spreadsheet — tampil di baris detail walau sesi belum aktif
    const flashScheduled = flash_scheduled_price ?? flash_upcoming_price ?? null;

    return (
      <>
        {flash_sale ? (
          <FlashHero flash={flash_sale} regular={regular_price} remain={remain} />
        ) : flash_upcoming ? (
          <UpcomingHero
            regular={regular_price}
            flashPrice={flash_upcoming_price ?? 0}
            start={flash_upcoming_start}
          />
        ) : non_promo ? (
          <PlainHero label="Harga Normal · Non-Promo" price={effective_price} />
        ) : promo_status === "before" ? (
          <PlainHero label="Harga Normal" price={effective_price} banner={eventBanner(event, "before")} />
        ) : promo_status === "after" ? (
          <PlainHero label="Harga Normal" price={effective_price} banner={eventBanner(event, "after")} />
        ) : promo_price !== null && promo_price < effective_price ? (
          /* disc aktif tapi hero reguler — harga efektif = disc */
          <DiscHero regular={regular_price} disc={effective_price} percent={Math.round(((regular_price - effective_price) / regular_price) * 100)} />
        ) : (
          <PlainHero label="Harga Normal" price={effective_price} />
        )}

        <div className="flex items-center gap-[15px] px-0.5 pb-[18px] pt-1">
          <div className={`grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[15px] border text-[12.5px] font-bold tracking-[0.04em] ${toneOf(product.name)}`}>
            {initialsOf(product.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">{product.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-ink-3">
              {product.barcode}
              {promo_tab_label ? ` · ${promo_tab_label}` : ""}
            </p>
          </div>
        </div>

        <dl>
          <Row dt="Harga jual" dd={fmtRupiah(regular_price)} ddClass="text-ink-2" />
          {promo_price !== null && !non_promo && (
            <Row dt="Harga disc reguler" dd={fmtRupiah(promo_price)} ddClass="text-brand-ink" />
          )}
          {flash_sale ? (
            <>
              <Row dt="Harga flash sale" dd={fmtRupiah(flash_sale.price)} ddClass="text-brand-ink" />
              <Row dt="Berlaku sampai" dd={`${fmtWitaDateID(flash_sale.ends_at)} WITA`} />
            </>
          ) : flashScheduled !== null ? (
            <Row
              dt="Flash sale"
              dd={fmtRupiah(flashScheduled)}
              sub={`${flashSessionLabel(event)} WITA`}
              ddClass="text-brand-ink"
            />
          ) : (
            <Row
              dt="Flash sale"
              dd={flash_upcoming ? `Mulai ${fmtWitaDateID(flash_upcoming_start)} WITA` : "–"}
            />
          )}
          {alt_tier && (
            <Row
              dt={`Diskon ${fmtWitaDateID(alt_tier.start)}`}
              dd={`${alt_tier.disc}% (${fmtRupiah(alt_tier.price)})`}
              sub={`${fmtWitaDateID(alt_tier.start)} – ${fmtWitaDateID(alt_tier.end)} WITA`}
            />
          )}
          {product.pareto && <Row dt="Pareto" dd={product.pareto} />}
          <Row
            dt="Harga berlaku sekarang"
            dd={fmtRupiah(effective_price)}
            ddClass="inline-flex items-center gap-1.5 text-[14.5px] font-bold text-ok [&_svg]:h-4 [&_svg]:w-4"
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
        ref={sectionRef}
        role="dialog"
        aria-modal="true"
        aria-label="Hasil cek harga"
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`fixed left-1/2 bottom-0 z-50 flex h-[min(88dvh,760px)] w-[min(560px,100%)] flex-col rounded-t-[30px] bg-elev shadow-sheet outline-none transition-transform duration-[420ms] [transition-timing-function:var(--ease-out-soft)] max-lg:translate-x-[-50%] max-lg:data-[open=false]:translate-y-[105%] max-lg:data-[open=true]:translate-y-0 lg:bottom-auto lg:top-1/2 lg:h-[min(640px,86dvh)] lg:w-[min(480px,calc(100vw-48px))] lg:rounded-[28px] lg:shadow-panel lg:transition-[transform,opacity] lg:duration-[340ms] lg:-translate-x-1/2 lg:-translate-y-[46%] lg:scale-[0.96] lg:opacity-0 lg:data-[open=true]:-translate-y-1/2 lg:data-[open=true]:scale-100 lg:data-[open=true]:opacity-100 ${
          open ? "max-lg:translate-x-[-50%]" : ""
        }`}
        data-open={open}
        hidden={!open && !loading}
      >
        <div aria-hidden className="grid shrink-0 place-items-center pb-1 pt-2.5 max-lg:grids lg:hidden">
          <span className="h-[5px] w-11 rounded-[3px] bg-line-strong" />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-[22px] pb-[18px] pt-1.5">{renderBody()}</div>
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

function Row({
  dt,
  dd,
  sub,
  ddClass = "",
  ddIcon
}: {
  dt: string;
  dd: string;
  /** teks kecil di bawah nilai (mis. jadwal sesi) */
  sub?: string;
  ddClass?: string;
  ddIcon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3.5 border-t border-line px-0.5 py-3 text-sm">
      <dt className="shrink-0 pt-0.5 font-medium text-ink-2">{dt}</dt>
      <dd className="text-right">
        <span className={`font-mono text-[13px] font-semibold [overflow-wrap:anywhere] ${ddClass}`}>
          {ddIcon}
          {dd}
        </span>
        {sub && <span className="mt-1 block font-mono text-[11.5px] leading-snug text-ink-3">{sub}</span>}
      </dd>
    </div>
  );
}

/** Banner status event di atas hero (belum mulai / sudah berakhir). */
function eventBanner(event: PriceResponse["event"], status: "before" | "after"): string {
  const start = fmtWitaDateID(event.start);
  const end = fmtWitaDateID(event.end);
  return status === "before" ? `Promo dimulai ${start} WITA` : `Promo berakhir ${end} WITA`;
}

/**
 * Label jadwal sesi flash untuk baris detail: daftar jam sesi harian bila
 * tersedia, selain itu rentang tanggal event.
 */
function flashSessionLabel(event: PriceResponse["event"]): string {
  if (event.sessions && event.sessions.length > 0) {
    return event.sessions.join(", ");
  }
  const start = fmtWitaDateID(event.start);
  const end = fmtWitaDateID(event.end);
  return `${start} – ${end} WITA`;
}

function PlainHero({ label, price, banner }: { label: string; price: number; banner?: string }) {
  return (
    <div className="relative mx-0 mb-4 mt-1 overflow-hidden rounded-3xl px-[22px] pb-[22px] pt-6 text-white"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(255,122,183,0.30) 0%, transparent 55%), linear-gradient(160deg, #2E2A35 0%, var(--color-night) 70%)"
      }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">{label}</span>
      <div className="mt-2.5 font-mono text-[40px] font-bold leading-none tracking-[-0.02em]">{fmtRupiah(price)}</div>
      {banner && (
        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[13.5px] text-white/70">
          <span className="inline-flex items-center gap-1.5 [&_svg]:h-[14px] [&_svg]:w-[14px]">{Icon.clock}{banner}</span>
        </div>
      )}
    </div>
  );
}

/** Hero disc reguler aktif (selama event, di luar sesi flash). */
function DiscHero({ regular, disc, percent }: { regular: number; disc: number; percent: number }) {
  return (
    <div className="relative mb-4 mt-1 overflow-hidden rounded-3xl px-[22px] pb-[22px] pt-6 text-white"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(122,162,255,0.32) 0%, transparent 55%), linear-gradient(160deg, #223047 0%, #1B2436 55%, #141A28 100%)"
      }}
    >
      <span className="inline-flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-[0.22em] text-[#AFC8FF]">
        <span className="inline-flex text-[#FFD166] [&_svg]:h-[15px] [&_svg]:w-[15px]">{Icon.tag}</span>
        Harga Promo
      </span>
      <div className="mt-2.5 font-mono text-[40px] font-bold leading-none tracking-[-0.02em]">{fmtRupiah(disc)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[13.5px] text-white/70">
        <span className="font-mono text-[13px] [text-decoration:line-through] [text-decoration-color:rgba(175,200,255,0.75)] [text-decoration-thickness:2px]">
          {fmtRupiah(regular)}
        </span>
        <span className="rounded-full border border-white/[0.22] bg-white/[0.14] px-2.5 py-1 font-mono text-[12.5px] font-bold text-white">
          Hemat {percent}%
        </span>
      </div>
    </div>
  );
}

/** Hero flash sale terjadwal (produk only-flash di luar sesi). */
function UpcomingHero({
  regular,
  flashPrice,
  start
}: {
  regular: number;
  flashPrice: number;
  start: string | null;
}) {
  return (
    <div className="relative mx-0 mb-4 mt-1 overflow-hidden rounded-3xl px-[22px] pb-[22px] pt-6 text-white"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(255,122,183,0.30) 0%, transparent 55%), linear-gradient(160deg, #2E2A35 0%, var(--color-night) 70%)"
      }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Harga Normal</span>
      <div className="mt-2.5 font-mono text-[40px] font-bold leading-none tracking-[-0.02em]">{fmtRupiah(regular)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[13.5px] text-white/70">
        <span>
          Flash sale {fmtRupiah(flashPrice)} dimulai {fmtWitaDateID(start)} WITA
        </span>
      </div>
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

/** Skeleton mencocokkan bentuk konten asli: hero harga + baris identitas + baris data */
function SheetSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="skel mb-4 mt-1 h-[136px] rounded-3xl border-0" />
      <div className="flex items-center gap-[15px] px-0.5 pb-[18px] pt-1">
        <span className="skel h-[58px] w-[58px] rounded-[15px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="skel h-[15px] w-[68%] rounded-md" />
          <span className="skel h-[11px] w-[44%] rounded-md" />
        </div>
      </div>
      <div className="flex flex-col gap-3.5">
        {[72, 58, 64, 52].map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-t border-line px-0.5 py-3">
            <span className="skel h-[13px] rounded-md" style={{ width: `${w * 0.5}%` }} />
            <span className="skel h-[13px] rounded-md" style={{ width: `${w * 0.4}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
