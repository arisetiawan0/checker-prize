"use client";

import { useCallback, useEffect, useState } from "react";

/** Event beforeinstallprompt yang ditangkap Chrome/Edge — tidak pernah ada di iOS Safari */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = "available" | "ios" | "standalone" | "unsupported";

const isIosLike = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ menyamar sebagai macOS tapi tetap punya layar sentuh
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Dukungan install PWA lintas platform:
 * - Chrome/Edge (Android & desktop): event beforeinstallprompt → dialog install native
 * - iOS Safari: tidak ada API prompt → state "ios", UI memberi instruksi Add to Home Screen
 * - Sudah terpasang (mode standalone): state "standalone", tombol disembunyikan
 */
export function usePwaInstall() {
  const [installState, setInstallState] = useState<InstallState>("unsupported");
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstallState("standalone");
      return;
    }
    setInstallState(isIosLike() ? "ios" : "unsupported");

    const onPrompt = (e: Event) => {
      e.preventDefault(); // cegah Chrome menampilkan prompt bawaan; pakai tombol in-app
      setPromptEvent(e as InstallPromptEvent);
      setInstallState("available");
    };
    const onInstalled = () => setInstallState("standalone");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /** Tampilkan dialog install native. Bila tak tersedia (mis. iOS), hasil null —
   * UI harus menampilkan instruksi manual. */
  const install = useCallback(async (): Promise<"accepted" | "dismissed" | null> => {
    if (!promptEvent) return null;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      setPromptEvent(null);
      return outcome;
    } catch {
      return null;
    }
  }, [promptEvent]);

  return { installState, install };
}
