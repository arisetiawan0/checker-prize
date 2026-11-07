"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "./icons";

export type ToastKind = "ok" | "err" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
  leaving: boolean;
}

/** Toast atas layar, auto-dismiss default 3.2 dtk, region aria-live polite */
export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 280);
  }, []);

  const show = useCallback((kind: ToastKind, msg: string, ms = 3200) => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, kind, msg, leaving: false }]);
    setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  return { items, show, dismiss };
}

const KIND_ICON: Record<ToastKind, React.ReactNode> = {
  ok: Icon.check,
  err: Icon.warn,
  info: Icon.info
};

const KIND_COLOR: Record<ToastKind, string> = {
  ok: "text-ok",
  err: "text-danger",
  info: "text-brand"
};

export function ToastRegion({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+14px)] z-[60] flex w-[min(400px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 rounded-2xl border border-line bg-white px-4 py-3 text-[13.5px] font-medium text-ink shadow-[0_16px_40px_-16px_rgba(60,40,30,0.35)] ${
            t.leaving ? "anim-toast-out" : "anim-toast-in"
          }`}
        >
          <span className={`shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px] ${KIND_COLOR[t.kind]}`}>{KIND_ICON[t.kind]}</span>
          <span className="flex-1">{t.msg}</span>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto -mr-1.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-brand-bg hover:text-ink [&_svg]:h-[16px] [&_svg]:w-[16px]"
          >
            {Icon.close}
          </button>
        </div>
      ))}
    </div>
  );
}
