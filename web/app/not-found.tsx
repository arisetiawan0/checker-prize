import Link from "next/link";
import { BrandMark } from "@/components/icons";

/** 404 kustom — latar sama dengan PinGate agar konsisten (PRD §9) */
export default function NotFound() {
  return (
    <main
      className="grid min-h-dvh place-items-center px-5 py-6"
      style={{
        background:
          "radial-gradient(120% 90% at 85% -10%, #E9E0F4 0%, transparent 55%), radial-gradient(110% 80% at 0% 110%, var(--color-brand-bg) 0%, transparent 55%), var(--color-porcelain)"
      }}
    >
      <div className="anim-rise w-[min(420px,100%)] rounded-[28px] border border-line/90 bg-surface px-7 py-9 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-[52px] w-[52px] place-items-center rounded-[17px] bg-gradient-to-b from-[#2B2733] to-[#15131A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_22px_-10px_rgba(21,19,26,0.55)]">
          <BrandMark size={24} />
        </div>
        <p className="font-mono text-[13px] font-bold tracking-[0.24em] text-brand-ink">404</p>
        <h1 className="mt-1.5 text-[22px] font-bold tracking-[-0.02em]">Halaman tidak ditemukan</h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-[14px] leading-relaxed text-ink-2">
          URL ini tidak dikenal. Buka halaman utama untuk memindai barcode atau mencari produk.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-[54px] items-center justify-center rounded-[17px] bg-night px-7 text-base font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_-10px_rgba(16,16,20,0.55)] transition hover:bg-[#24222B] active:scale-[0.975]"
        >
          Buka Aplikasi
        </Link>
      </div>
    </main>
  );
}
