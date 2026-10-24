"use client";

import { useEffect } from "react";

/** Registrasi service worker (PWA) — no-op saat dev dikecualikan di sw itu sendiri. */
export function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
