"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PinGate } from "./PinGate";
import { ScanView } from "./ScanView";
import { SearchView } from "./SearchView";
import { HistoryView } from "./HistoryView";
import { ResultSheet } from "./ResultSheet";
import { ToastRegion, useToasts } from "./Toasts";
import { fetchPrice } from "@/lib/client-api";
import type { HistoryEntry, PriceResult } from "@/lib/types";

const PIN_KEY = "beauty.pc.unlocked";
const HISTORY_KEY = "beauty.pc.history";
const HISTORY_MAX = 50;

type ViewName = "scan" | "search" | "history";

/** Orkestrator seluruh aplikasi di sisi klien */
export function AppShell() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null); // null = hydrating
  const [view, setView] = useState<ViewName>("scan");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [result, setResult] = useState<PriceResult | null>(null);
  const [searchSeed, setSearchSeed] = useState("");
  const [nowHHMM, setNowHHMM] = useState("--:--");
  const { items: toastItems, show, dismiss } = useToasts();

  /* --- boot: sesi + riwayat --- */
  useEffect(() => {
    setUnlocked(localStorage.getItem(PIN_KEY) === "1");
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    } catch {
      setHistory([]);
    }
    const w = new Date(Date.now() + 8 * 3600 * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    setNowHHMM(`${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`);
  }, []);

  /* --- konektivitas --- */
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => {
      setOnline(false);
      show("info", "Sinyal lemah — menampilkan data terakhir yang tersimpan", 4000);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [show]);

  const syncHHMM = useMemo(() => `Data diperbarui ${nowHHMM}`, [nowHHMM]);

  /* --- riwayat --- */
  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.code !== entry.code)].slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /* --- cache harga terakhir (untuk mode offline) --- */
  const cachePrice = useCallback((res: PriceResult) => {
    if ("notFound" in res) return;
    try {
      const KEY = "beauty.pc.pricecache";
      const cache = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, { res: PriceResult; at: number }>;
      // simpan maks 300 entri terakhir
      const keys = Object.keys(cache);
      if (keys.length >= 300) {
        keys.sort((a, b) => cache[a].at - cache[b].at);
        for (let i = 0; i < keys.length - 250; i++) delete cache[keys[i]];
      }
      cache[res.product.barcode] = { res, at: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
      /* storage penuh/tak tersedia — cache harga bersifat bonus */
    }
  }, []);

  /* --- buka hasil harga --- */
  // guard anti-lomba: bila openPrice dipanggil lagi (scan cepat berturut /
  // klik history berulang), respons request lama yang terlambat dibuang —
  // tanpa ini skeleton bisa "stuck" menampilkan request basi.
  const reqIdRef = useRef(0);
  const openPrice = useCallback(
    async (code: string) => {
      const reqId = ++reqIdRef.current;
      setSheetLoading(true);
      setSheetOpen(true);
      try {
        const res = await fetchPrice(code);
        if (reqId !== reqIdRef.current) return; // ada request lebih baru → abaikan
        setResult(res);
        if ("notFound" in res === false) {
          cachePrice(res);
          const kind = res.non_promo ? "normal" : res.flash_sale ? "flash" : res.promo_price !== null ? "disc" : "normal";
          pushHistory({
            code: res.product.barcode || code,
            name: res.product.name,
            price: res.effective_price,
            kind,
            at: Date.now()
          });
        }
      } catch {
        if (reqId !== reqIdRef.current) return; // request lama → jangan ganggu yang baru
        // offline/gagal: tampilkan harga dari cache perangkat bila pernah dicek
        try {
          const KEY = "beauty.pc.pricecache";
          const cache = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, { res: PriceResult; at: number }>;
          const hit = cache[code] ?? cache[Object.keys(cache).find((k) => k.toLowerCase() === code.toLowerCase()) ?? ""];
          if (hit && hit.res && "notFound" in hit.res === false) {
            setResult(hit.res);
            show("info", "Anda offline — menampilkan harga tersimpan terakhir", 4200);
          } else {
            show("err", "Anda offline — harga ini belum pernah dicek di perangkat ini", 4200);
            setSheetOpen(false);
          }
        } catch {
          show("err", "Gagal mengambil harga — periksa koneksi lalu scan ulang");
          setSheetOpen(false);
        }
      } finally {
        if (reqId === reqIdRef.current) setSheetLoading(false);
      }
    },
    [pushHistory, show, cachePrice]
  );

  const handleCode = useCallback((code: string) => void openPrice(code), [openPrice]);
  const handleFlashExpired = useCallback(
    (code: string) => {
      show("info", "Flash sale untuk produk ini telah berakhir", 4200);
      void openPrice(code);
    },
    [openPrice, show]
  );

  /* --- navigasi --- */
  const unlock = () => setUnlocked(true);
  const lockout = () => {
    localStorage.removeItem(PIN_KEY);
    setUnlocked(false);
    setView("scan");
    setSheetOpen(false);
  };
  const goSearch = (seed = "") => {
    setSheetOpen(false); // tutup modal hasil (mis. panel not-found) agar tidak menutupi pencarian
    setSearchSeed(seed);
    setView("search");
  };

  if (unlocked === null) return null; // hindari flash gate saat hydrate

  if (!unlocked) {
    return <PinGate onUnlock={unlock} />;
  }

  return (
    <main id="konten" className="min-h-dvh">
      <a
        href="#konten"
        className="sr-only rounded-b-xl bg-brand px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80]"
      >
        Lewati ke konten utama
      </a>
      {view === "scan" && (
        <ScanView
          active
          syncHHMM={syncHHMM}
          online={online}
          historyCount={history.length}
          onCode={handleCode}
          onOpenSearch={() => goSearch("")}
          onOpenHistory={() => setView("history")}
          onLockout={lockout}
        />
      )}
      <SearchView
        active={view === "search"}
        seed={searchSeed}
        onBack={() => setView("scan")}
        onPick={(code) => void openPrice(code)}
      />
      <HistoryView
        active={view === "history"}
        entries={history}
        onBack={() => setView("scan")}
        onPick={(code) => void openPrice(code)}
        onClear={() => {
          setHistory([]);
          localStorage.removeItem(HISTORY_KEY);
          show("ok", "Riwayat dihapus");
        }}
        onStartScan={() => setView("scan")}
      />
      <ResultSheet
        result={result}
        loading={sheetLoading}
        open={sheetOpen}
        nowHHMM={nowHHMM}
        onClose={() => setSheetOpen(false)}
        onRescan={() => {
          setSheetOpen(false);
          setView("scan");
        }}
        onManualSearch={(code) => goSearch(code.length > 3 ? code : "")}
        onFlashExpired={handleFlashExpired}
      />
      <ToastRegion items={toastItems} dismiss={dismiss} />
    </main>
  );
}
