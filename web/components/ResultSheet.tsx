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
          <h3 className="font-display mb-1.5 text-[20px] font-bold tracking-[-0.01em]">Produk tidak ditemukan</h3>
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
      price_schedule,
      event
    } = result as PriceResponse;

    // harga flash di spreadsheet — tampil di baris detail walau sesi belum aktif
    const flashScheduled = flash_scheduled_price ?? flash_upcoming_price ?? null;
    // persen disc reguler terjadwal (tampil di hero saat event belum mulai)
    const scheduledDiscPct = promo_price !== null ? pctOff(regular_price, promo_price) : null;

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
          <PlainHero
            label="Harga Normal"
            price={effective_price}
            banner={eventBanner(event, "before")}
            chipPercent={scheduledDiscPct ?? undefined}
          />
        ) : promo_status === "after" ? (
          <PlainHero label="Harga Normal" price={effective_price} banner={eventBanner(event, "after")} />
        ) : promo_price !== null && effective_price < regular_price ? (
          <DiscHero regular={regular_price} disc={effective_price} percent={pctOff(regular_price, effective_price)} />
        ) : (
          <PlainHero label="Harga Normal" price={effective_price} />
        )}

        <div className="flex items-center gap-[15px] px-0.5 pb-[18px] pt-1">
          <div className={`grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[15px] border text-[12.5px] font-bold tracking-[0.04em] ${toneOf(product.name)}`}>
            {initialsOf(product.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold leading-tight tracking-[-0.015em]">{product.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-ink-3">
              {product.barcode}
              {promo_tab_label ? ` · ${promo_tab_label}` : ""}
            </p>
          </div>
        </div>

        <dl>
          <Row dt="Harga jual" dd={fmtRupiah(regular_price)} ddClass="text-ink-2" />
          {promo_price !== null && !non_promo && (
            <Row
              dt="Harga disc reguler"
              dd={fmtRupiah(promo_price)}
              ddClass="text-brand-ink"
              badge={pctOff(regular_price, promo_price)}
            />
          )}
          {flash_sale ? (
            <>
              <Row
                dt="Harga flash sale"
                dd={fmtRupiah(flash_sale.price)}
                ddClass="text-brand-ink"
                badge={pctOff(regular_price, flash_sale.price)}
              />
              <Row dt="Berlaku sampai" dd={`${fmtWitaDateID(flash_sale.ends_at)} WITA`} />
            </>
          ) : flashScheduled !== null ? (
            <Row
              dt="Flash sale"
              dd={fmtRupiah(flashScheduled)}
              sub={`${flashSessionLabel(event)} WITA`}
              ddClass="text-brand-ink"
              badge={pctOff(regular_price, flashScheduled)}
            />
          ) : (
            <Row
              dt="Flash sale"
              dd={flash_upcoming ? `Mulai ${fmtWitaDateID(flash_upcoming_start)} WITA` : "–"}
            />
          )}
          {price_schedule.length > 0 && <PriceSchedule schedule={price_schedule} />}
          {product.pareto && <Row dt="Pareto" dd={product.pareto} />}
          <Row
            dt="Harga berlaku sekarang"
            dd={fmtRupiah(effective_price)}
            ddClass="inline-flex items-center gap-1.5 text-[14.5px] font-bold text-ok [&_svg]:h-4 [&_svg]:w-4"
            ddIcon={Icon.check}
            badge={effective_price < regular_price ? pctOff(regular_price, effective_price) : undefined}
            badgeClass="border-ok-line bg-ok-bg text-ok"
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
        className={`fixed inset-0 z-40 bg-[rgba(70,45,35,0.25)] backdrop-blur-[3px] transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
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
            className="inline-flex h-[54px] items-center justify-center gap-2 rounded-[17px] bg-brand text-base font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-10px_rgba(198,61,121,0.6)] transition hover:bg-brand-deep active:scale-[0.975] [&_svg]:h-[19px] [&_svg]:w-[19px]"
          >
            {Icon.scan}
            Scan Lagi
          </button>
        </div>
      </section>
    </>
  );
}

/** Persen hemat vs harga jual — dibulatkan, min 1% (selaras server §persen). */
function pctOff(regular: number, price: number): number {
  if (regular <= 0 || price >= regular) return 0;
  return Math.max(1, Math.round(((regular - price) / regular) * 100));
}

/** Pill kecil "−15%" — dipakai di baris detail & hero. */
function PercentPill({
  percent,
  className = "border-brand-line bg-brand-bg text-brand-ink"
}: {
  percent: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-[1.5px] font-mono text-[10.5px] font-bold leading-none tracking-[0.01em] ${className}`}
    >
      −{percent}%
    </span>
  );
}

function Row({
  dt,
  dd,
  sub,
  ddClass = "",
  ddIcon,
  badge,
  badgeClass
}: {
  dt: string;
  dd: string;
  /** teks kecil di bawah nilai (mis. jadwal sesi) */
  sub?: string;
  ddClass?: string;
  ddIcon?: React.ReactNode;
  /** persen diskon → pill "−N%" di samping nilai */
  badge?: number;
  badgeClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3.5 border-t border-line px-0.5 py-3 text-sm">
      <dt className="shrink-0 pt-0.5 font-medium text-ink-2">{dt}</dt>
      <dd className="text-right">
        <span className={`inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 font-mono text-[13px] font-semibold [overflow-wrap:anywhere] ${ddClass}`}>
          {ddIcon}
          {dd}
          {badge !== undefined && badge > 0 && <PercentPill percent={badge} className={badgeClass} />}
        </span>
        {sub && <span className="mt-1 block font-mono text-[11.5px] leading-snug text-ink-3">{sub}</span>}
      </dd>
    </div>
  );
}

/**
 * Khusus LT PRO: jadwal lengkap harga promo per tier tanggal dalam SATU blok,
 * tier aktif ditandai. Dibuat agar staf langsung paham: tanggal beda →
 * nominal beda, semua tier reguler.
 */
function PriceSchedule({
  schedule
}: {
  schedule: Array<{ disc: number; price: number; start: string; end: string; active: boolean }>;
}) {
  return (
    <div className="border-t border-line px-0.5 py-3 text-sm">
      <dt className="mb-2 font-medium text-ink-2">Jadwal harga promo</dt>
      <dd className="flex flex-col gap-1.5">
        {schedule.map((tier, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 rounded-[12px] border px-2.5 py-2 ${
              tier.active
                ? "border-ok-line bg-ok-bg shadow-[inset_2px_0_0_var(--color-ok)]"
                : "border-line bg-surface text-ink-2"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tier.active ? "bg-ok" : "bg-line-strong"}`} />
              <span className="truncate">
                {fmtWitaDateID(tier.start)}
                {fmtWitaDateID(tier.start) !== fmtWitaDateID(tier.end) ? ` – ${fmtWitaDateID(tier.end)}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-right font-mono text-[12.5px] font-semibold">
              <PercentPill
                percent={tier.disc}
                className={tier.active ? "border-ok-line bg-surface text-ok" : "border-line-strong bg-elev text-ink-2"}
              />
              {fmtRupiah(tier.price)}
              {tier.active && (
                <span className="ml-0.5 font-sans text-[10.5px] font-bold uppercase tracking-wide text-ok">· berlangsung</span>
              )}
            </span>
          </div>
        ))}
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

function PlainHero({
  label,
  price,
  banner,
  chipPercent
}: {
  label: string;
  price: number;
  banner?: string;
  /** persen disc reguler terjadwal → chip "Hemat N%" di hero */
  chipPercent?: number;
}) {
  return (
    <div className="grain relative mx-0 mb-4 mt-1 overflow-hidden rounded-3xl border border-line px-[22px] pb-[22px] pt-6 text-ink"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(226,88,144,0.12) 0%, transparent 55%), linear-gradient(160deg, #fdf0e7 0%, #ffe8f0 100%)"
      }}
    >
      <span aria-hidden className="pointer-events-none absolute -right-4 -top-5 text-ink opacity-[0.06] [&_svg]:h-[110px] [&_svg]:w-[110px]">
        {Icon.tag}
      </span>
      <span className="kicker text-[11px] text-ink-2">{label}</span>
      <div className="mt-2.5 font-mono text-[40px] font-bold leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
        {fmtRupiah(price)}
      </div>
      {(banner || chipPercent) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {chipPercent !== undefined && (
            <span className="rounded-full border border-warn-line bg-warn-bg px-2.5 py-1 font-mono text-[12.5px] font-bold text-warn">
              Hemat {chipPercent}%
            </span>
          )}
          {banner && (
            <span className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-3 [&_svg]:h-[14px] [&_svg]:w-[14px]">
              {Icon.clock}
              {banner}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Hero disc reguler aktif (selama event, di luar sesi flash). */
function DiscHero({ regular, disc, percent }: { regular: number; disc: number; percent: number }) {
  return (
    <div className="grain relative mb-4 mt-1 overflow-hidden rounded-3xl border border-line px-[22px] pb-[22px] pt-6 text-ink"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(255,255,255,0.6) 0%, transparent 50%), linear-gradient(160deg, #fff2d6 0%, #ffe9c2 55%, #ffdcaa 100%)"
      }}
    >
      <span aria-hidden className="pointer-events-none absolute -right-4 -top-5 text-ink opacity-[0.06] [&_svg]:h-[110px] [&_svg]:w-[110px]">
        {Icon.tag}
      </span>
      <span className="kicker inline-flex items-center gap-[7px] text-[11px] text-[#a06f0e]">
        <span className="inline-flex text-[#c98a04] [&_svg]:h-[15px] [&_svg]:w-[15px]">{Icon.tag}</span>
        Harga Promo
      </span>
      <div className="mt-2.5 flex flex-wrap items-end gap-x-3 gap-y-2">
        <span className="font-mono text-[40px] font-bold leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
          {fmtRupiah(disc)}
        </span>
        <span className="mb-0.5 inline-flex items-center rounded-full bg-[#FFD166] px-2.5 py-1 font-mono text-[13px] font-bold leading-none text-[#4a3400] shadow-[0_4px_14px_-4px_rgba(201,138,4,0.5)]">
          −{percent}%
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink/[0.08] pt-3 text-[13.5px] text-ink-3">
        <span className="font-mono text-[13px] text-ink-2 [text-decoration:line-through] [text-decoration-color:rgba(32,27,21,0.35)] [text-decoration-thickness:2px]">
          {fmtRupiah(regular)}
        </span>
        <span className="font-mono text-[12.5px] font-semibold text-ok">
          Hemat {fmtRupiah(regular - disc)}
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
  const pct = pctOff(regular, flashPrice);
  return (
    <div className="grain relative mx-0 mb-4 mt-1 overflow-hidden rounded-3xl border border-line px-[22px] pb-[22px] pt-6 text-ink"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(226,88,144,0.12) 0%, transparent 55%), linear-gradient(160deg, #fdf0e7 0%, #ffe8f0 100%)"
      }}
    >
      <span aria-hidden className="pointer-events-none absolute -right-4 -top-5 text-ink opacity-[0.06] [&_svg]:h-[110px] [&_svg]:w-[110px]">
        {Icon.bolt}
      </span>
      <span className="kicker text-[11px] text-ink-2">Harga Normal</span>
      <div className="mt-2.5 font-mono text-[40px] font-bold leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
        {fmtRupiah(regular)}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-line bg-white px-2.5 py-1 font-mono text-[12.5px] font-bold text-brand-ink">
          Flash {fmtRupiah(flashPrice)}
          {pct > 0 && ` · −${pct}%`}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-3 [&_svg]:h-[14px] [&_svg]:w-[14px]">
          {Icon.clock}
          Mulai {fmtWitaDateID(start)} WITA
        </span>
      </div>
    </div>
  );
}

function FlashHero({ flash, regular, remain }: { flash: FlashSale; regular: number; remain: number | null }) {
  const expired = remain !== null && remain <= 0;
  return (
    <div
      className="grain relative mb-4 mt-1 overflow-hidden rounded-3xl border border-brand-line px-[22px] pb-[22px] pt-6 text-ink"
      style={{
        background:
          "radial-gradient(130% 100% at 85% 0%, rgba(255,255,255,0.6) 0%, transparent 50%), linear-gradient(160deg, #ffe3ee 0%, #ffd3e4 55%, #ffc6da 100%)"
      }}
    >
      <span className="kicker inline-flex items-center gap-[7px] text-[11px] text-brand-deep">
        <span className="inline-flex text-[#c98a04] [&_svg]:h-[15px] [&_svg]:w-[15px]">{Icon.bolt}</span>
        Flash Sale Berlaku
      </span>
      <div className="mt-2.5 flex flex-wrap items-end gap-x-3 gap-y-2 font-mono text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-brand-ink">
        <span className="[font-variant-numeric:tabular-nums]">{fmtRupiah(flash.price)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink/[0.08] pt-3 text-[13.5px] text-ink-3">
        <span className="font-mono text-[13px] text-ink-2 [text-decoration:line-through] [text-decoration-color:rgba(32,27,21,0.35)] [text-decoration-thickness:2px]">
          {fmtRupiah(regular)}
        </span>
        <span className="inline-flex items-center rounded-full bg-brand px-2.5 py-1 font-mono text-[13px] font-bold leading-none text-white shadow-[0_4px_14px_-4px_rgba(198,61,121,0.6)]">
          −{flash.discount_percent}%
        </span>
        {regular - flash.price > 0 && (
          <span className="font-mono text-[12.5px] font-semibold text-ok">
            Hemat {fmtRupiah(regular - flash.price)}
          </span>
        )}
      </div>
      <div className="mt-4 hidden items-center gap-2 rounded-[14px] border border-brand-line bg-white/90 px-3.5 py-2.5 data-[show=true]:flex" data-show={!expired}>
        <span className="shrink-0 text-brand [&_svg]:h-[17px] [&_svg]:w-[17px]">{Icon.clock}</span>
        <span className="flex-1 font-mono text-[17px] font-bold tracking-[0.03em] text-brand-ink [font-variant-numeric:tabular-nums]">
          {remain !== null && remain > 0 && (
            <>
              {fmtClock(remain)}
              <span className="ml-1.5 font-sans text-[11.5px] font-medium tracking-[0.02em] text-ink-3">
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
