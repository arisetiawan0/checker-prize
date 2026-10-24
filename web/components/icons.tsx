/* Ikon SVG inline — stroke konsisten 1.7, tanpa emoji */

export function BrandMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 9.5 12 4l8 5.5v6.2c0 .9-.5 1.7-1.3 2.1l-6.2 3a1.9 1.9 0 0 1-1.7 0l-6.2-3A2.4 2.4 0 0 1 4 15.7V9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 12.5c.6.9 2 1.6 3.5 1.6s2.9-.7 3.5-1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="9.8" r="1" fill="currentColor" />
      <circle cx="15" cy="9.8" r="1" fill="currentColor" />
    </svg>
  );
}

export const Icon = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 6 8.5 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.2 2.5 5.6 13.1c-.4.5 0 1.2.6 1.2h4.1l-1.4 6.8c-.1.7.7 1.1 1.1.5l7.7-10.6c.4-.5 0-1.2-.6-1.2h-4.2l1.5-6.7c.1-.7-.8-1.1-1.2-.6Z" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.1a1.6 1.6 0 0 0 1.4-.8l.6-1a1.6 1.6 0 0 1 1.4-.7h2a1.6 1.6 0 0 1 1.4.7l.6 1a1.6 1.6 0 0 0 1.4.8h1.1A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12.3" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8.5 12.3 2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l2.8 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m9.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7.5V12l2.8 2M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M20 4.5V7h-2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lines: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 6.5h14M5 12h14M5 17.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15.5 9.5V7a3.5 3.5 0 1 0-7 0v2.5M9 13.8h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="5" y="9.5" width="14" height="10" rx="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16.5 16.5 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  torch: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3.5h6v2.8a2 2 0 0 1-.4 1.2L13 10v9a1.5 1.5 0 0 1-1.5 1.5h0A1.5 1.5 0 0 1 10 19v-9L8.4 7.5a2 2 0 0 1-.4-1.2V3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 12.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  warn: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.6 4.6 3.9 16.4a1.8 1.8 0 0 0 1.6 2.7h13a1.8 1.8 0 0 0 1.6-2.7L13.4 4.6a1.6 1.6 0 0 0-2.8 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 8.5v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1" fill="currentColor" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1" fill="currentColor" />
    </svg>
  )
} as const;

/** Warna thumbnail inisial produk — deterministik dari SKU */
export function toneOf(sku: string): string {
  const tones = ["bg-brand-bg text-brand-ink border-brand-line", "bg-ok-bg text-ok border-ok-line", "bg-[#EDF2FA] text-[#46628F] border-[#D9E2F0]", "bg-warn-bg text-warn border-warn-line", "bg-[#F1EEF9] text-[#5D518F] border-[#E0DAF0]", "bg-[#EAF4F1] text-[#3E7E6B] border-[#D3E6E0]"];
  let h = 0;
  for (let i = 2; i < sku.length; i++) h = (h * 31 + sku.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}

export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return (words[0][0] + (words[1] ? words[1][0] : words[0][1] || "")).toUpperCase();
}
