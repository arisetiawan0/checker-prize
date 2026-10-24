"use client";

import { useEffect } from "react";
import { Icon, initialsOf, toneOf } from "./icons";
import { fmtRupiah } from "@/lib/client-api";
import type { SearchResultItem } from "@/lib/types";

interface SearchViewProps {
  active: boolean;
  seed: string; // kode awal dari panel not-found
  onBack: () => void;
  onPick: (code: string) => void;
}

interface SearchState {
  q: string;
  results: SearchResultItem[];
  phase: "idle" | "loading" | "done";
}

/** Pencarian manual: barcode, SKU, atau nama (PRD F2) */
export function SearchView({ active, seed, onBack, onPick }: SearchViewProps) {
  const [state, setState] = useReducerInit();

  useEffect(() => {
    if (active) {
      setState({ type: "reset", q: seed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, seed]);

  useEffect(() => {
    const q = state.q.trim();
    if (!q) {
      setState({ type: "results", results: [], phase: "idle" });
      return;
    }
    setState({ type: "phase", phase: "loading" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const results = (await res.json()) as SearchResultItem[];
        setState({ type: "results", results, phase: "done" });
      } catch {
        setState({ type: "results", results: [], phase: "done" });
      }
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.q]);

  if (!active) return null;

  const q = state.q.trim();
  const empty =
    state.phase !== "loading" && (q ? state.results.length === 0 : true);

  return (
    <section aria-label="Cari produk" className="mx-auto min-h-dvh max-w-[760px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+40px)] pt-[calc(env(safe-area-inset-top,0px)+14px)] md:pt-[calc(env(safe-area-inset-top,0px)+26px)]">
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
          <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em]">Cari Produk</h2>
          <p className="mt-px text-[13.5px] text-ink-3">Barcode, SKU, atau nama produk</p>
        </div>
      </header>

      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="flex h-14 items-center gap-2.5 rounded-[18px] border-[1.5px] border-line-strong bg-surface pl-[18px] pr-2 shadow-card transition focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--color-brand-bg),var(--shadow-card)]">
          <span className="shrink-0 text-ink-3 [&_svg]:h-5 [&_svg]:w-5">{Icon.search}</span>
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            aria-label="Cari barcode, SKU, atau nama produk"
            placeholder="Contoh: serum, BK-0012, 8991…"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-ink-3"
            value={state.q}
            onChange={(e) => setState({ type: "q", q: e.target.value })}
            autoFocus
          />
          {q && (
            <button
              type="button"
              aria-label="Hapus pencarian"
              onClick={() => setState({ type: "q", q: "" })}
              className="grid h-11 w-11 place-items-center rounded-full text-ink-3 transition hover:text-ink [&_svg]:h-[19px] [&_svg]:w-[19px]"
            >
              {Icon.close}
            </button>
          )}
        </div>
      </form>

      <p aria-live="polite" className="my-3 px-0.5 text-[12.5px] text-ink-3">
        {!q ? "" : state.phase === "loading" ? "Mencari…" : `${state.results.length} produk ditemukan`}
      </p>

      {state.phase === "loading" && (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[54px_1fr_76px] items-center gap-3.5 rounded-2xl border border-line bg-surface p-3 pl-3 pr-4">
              <div className="skel h-[54px] w-[54px] rounded-[13px]" />
              <div className="flex flex-col gap-2">
                <span className="skel h-[11px] w-[68%] rounded-md" />
                <span className="skel h-[11px] w-[42%] rounded-md" />
              </div>
              <div className="skel h-[15px] w-[76px] rounded-md" />
            </div>
          ))}
        </div>
      )}

      {state.phase !== "loading" && !empty && (
        <div className="flex flex-col gap-2.5 pb-10">
          {state.results.map((r) => (
            <button
              key={r.sku}
              type="button"
              onClick={() => onPick(r.barcode || r.sku)}
              className="grid w-full grid-cols-[54px_1fr_auto] items-center gap-3.5 rounded-2xl border border-line bg-surface p-3 pl-3 pr-4 text-left shadow-[0_1px_2px_rgba(34,31,38,0.04)] transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card active:scale-[0.985]"
            >
              <span className={`grid h-[54px] w-[54px] place-items-center overflow-hidden rounded-[13px] border text-xs font-bold tracking-[0.04em] ${toneOf(r.sku)}`}>
                {initialsOf(r.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15.5px] font-semibold tracking-[-0.01em]">{r.name}</span>
                <span className="mt-0.5 block truncate font-mono text-xs text-ink-3">
                  {r.sku} · {r.barcode}
                </span>
              </span>
              <span className="flex flex-none flex-col items-end gap-0.5 text-right">
                {r.flash_active ? (
                  <>
                    <em className="mb-0.5 inline-block rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-bold not-italic tracking-[0.08em] text-white">FLASH</em>
                    <strong className="font-mono text-[14.5px] font-bold tracking-[-0.01em] text-brand-ink">{fmtRupiah(r.flash_price ?? 0)}</strong>
                    <span className="font-mono text-xs text-ink-3 [text-decoration:line-through] [text-decoration-color:rgba(142,49,89,0.5)] [text-decoration-thickness:1.5px]">
                      {fmtRupiah(r.regular_price)}
                    </span>
                  </>
                ) : (
                  <strong className="font-mono text-[14.5px] font-bold tracking-[-0.01em] text-ink">{fmtRupiah(r.regular_price)}</strong>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {empty && (
        <div className="px-6 pb-[30px] pt-[54px] text-center">
          <div className="mx-auto mb-[18px] grid h-[76px] w-[76px] place-items-center rounded-3xl border border-line bg-elev text-ink-3 [&_svg]:h-8 [&_svg]:w-8">
            {Icon.search}
          </div>
          <h3 className="text-[17px] font-bold tracking-[-0.01em]">{q ? "Tidak ada produk cocok" : "Mulai mengetik untuk mencari"}</h3>
          <p className="mx-auto mt-1.5 mb-[18px] max-w-[36ch] text-[13.5px] leading-relaxed text-ink-2">
            {q
              ? `Tidak ada hasil untuk "${q}". Coba kata kunci lain atau cek ejaan SKU.`
              : "Cocokkan dengan nama produk, SKU, atau barcode. Maksimal 20 hasil teratas ditampilkan."}
          </p>
        </div>
      )}
    </section>
  );
}

/* reducer kecil khusus komponen */
import { useReducer } from "react";

type Action =
  | { type: "q"; q: string }
  | { type: "results"; results: SearchResultItem[]; phase: SearchState["phase"] }
  | { type: "phase"; phase: SearchState["phase"] }
  | { type: "reset"; q: string };

function useReducerInit() {
  return useReducer(
    (prev: SearchState, action: Action): SearchState => {
      switch (action.type) {
        case "q":
          return { ...prev, q: action.q };
        case "phase":
          return { ...prev, phase: action.phase };
        case "results":
          return { ...prev, results: action.results, phase: action.phase };
        case "reset":
          return { q: action.q, results: [], phase: "idle" };
      }
    },
    { q: "", results: [], phase: "idle" }
  );
}
