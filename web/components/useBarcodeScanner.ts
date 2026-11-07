"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScannerStatus = "idle" | "starting" | "running" | "unsupported" | "denied" | "error";
export type TorchResult = "on" | "off" | "unsupported" | "failed";

const ZXING_CDN = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";
const REPEAT_IGNORE_MS = 1400;
// pengukur cahaya: sampel luminance rata-rata untuk menyarankan senter saat gelap
const LUX_SAMPLE_MS = 1800;
const LUX_DARK_THRESHOLD = 48; // rata-rata luminance 0-255; di bawah ini dianggap gelap
const LUX_DARK_STREAK = 2; // butuh 2 sampel gelap berturut agar tidak false alarm

interface BarcodeDetectorLike {
  detect(video: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

/** Capability track yang dipakai app — tidak semua browser melapor semuanya */
interface TrackCapsLike {
  torch?: boolean;
  focusMode?: string[];
  exposureMode?: string[];
}

/**
 * Hook scan barcode: BarcodeDetector bila tersedia (Chrome Android/desktop),
 * fallback @zxing/browser via CDN (Safari iOS). HTTPS/localhost wajib untuk kamera.
 * Senter hanya didukung Chrome Android dkk — iOS Safari tidak punya API torch,
 * jadi toggleTorch memakai TorchResult agar UI bisa memberi umpan balik.
 */
export function useBarcodeScanner(onDetected: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState<boolean | null>(null); // null = belum diketahui
  const [lowLight, setLowLight] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingRef = useRef<{ reset: () => void } | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const torchOnRef = useRef(false);
  const darkStreakRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const handle = useCallback((code: string) => {
    const now = Date.now();
    if (code === lastCodeRef.current.code && now - lastCodeRef.current.at < REPEAT_IGNORE_MS) return;
    lastCodeRef.current = { code, at: now };
    onDetectedRef.current(code);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingRef.current) {
      try {
        zxingRef.current.reset();
      } catch {
        /* noop */
      }
      zxingRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    torchOnRef.current = false;
    darkStreakRef.current = 0;
    setTorchOn(false);
    setTorchSupported(null);
    setLowLight(false);
    setStatus("idle");
  }, []);

  /** Paksa fokus & paparan kontinu — kunci AF di malam hari sering gagal karena
   * mode default perangkat single-shot. Browser lain yang tak mendukung akan
   * mengabaikan constraint ini. */
  const applyOptimalTrackSettings = useCallback(async (track: MediaStreamTrack | null) => {
    if (!track?.getCapabilities) return;
    let caps: TrackCapsLike;
    try {
      caps = track.getCapabilities() as TrackCapsLike;
    } catch {
      return;
    }
    const advanced: Record<string, unknown>[] = [];
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) advanced.push({ focusMode: "continuous" });
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) advanced.push({ exposureMode: "continuous" });
    if (!advanced.length) return;
    try {
      await track.applyConstraints({ advanced } as unknown as MediaTrackConstraints);
    } catch {
      /* tidak krusial — biarkan pengaturan default */
    }
  }, []);

  /** Senter didukung hanya bila browser melaporkan capability `torch` (Chrome Android). */
  const torchSupportedFor = useCallback((track: MediaStreamTrack | null): boolean => {
    if (!track) return false;
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() as Partial<Record<string, boolean>> | undefined;
    if (supported && !supported.torch) return false;
    if (!track.getCapabilities) return false;
    try {
      return (track.getCapabilities() as TrackCapsLike).torch === true;
    } catch {
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video || status === "running" || status === "starting") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      try {
        await video.play();
      } catch {
        /* autoplay guard */
      }
      trackRef.current = stream.getVideoTracks()[0] ?? null;
      setTorchSupported(torchSupportedFor(trackRef.current));
      void applyOptimalTrackSettings(trackRef.current);
    } catch (err) {
      setStatus(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "error");
      return;
    }

    // pilih mesin deteksi
    const w = window as unknown as { BarcodeDetector?: new (o: { formats?: string[] }) => BarcodeDetectorLike };
    if (w.BarcodeDetector) {
      try {
        const formats = (await w.BarcodeDetector.prototype.detect ? ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] : []);
        void formats;
        const detector = new w.BarcodeDetector({});
        const tick = async () => {
          try {
            const codes = await detector.detect(video);
            if (codes.length) handle(codes[0].rawValue);
          } catch {
            /* frame gagal: lanjut */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        setStatus("running");
        return;
      } catch {
        /* jatuh ke zxing */
      }
    }

    try {
      const mod = await import(/* webpackIgnore: true */ ZXING_CDN);
      const Reader = (mod as { BrowserMultiFormatReader: new () => { decodeFromVideoElement: (v: HTMLVideoElement, cb: (r: { getText(): string } | undefined) => void) => Promise<void>; reset: () => void } })
        .BrowserMultiFormatReader;
      const reader = new Reader();
      await reader.decodeFromVideoElement(video, (result) => {
        if (result) handle(result.getText());
      });
      zxingRef.current = reader;
      setStatus("running");
    } catch {
      setStatus("unsupported");
    }
  }, [handle, status, torchSupportedFor, applyOptimalTrackSettings]);

  const toggleTorch = useCallback(async (): Promise<TorchResult> => {
    const track = trackRef.current;
    if (!track || !torchSupportedFor(track)) return "unsupported";
    const next = !torchOnRef.current;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      torchOnRef.current = next;
      setTorchOn(next);
      return next ? "on" : "off";
    } catch {
      return "failed";
    }
  }, [torchSupportedFor]);

  // pengukur cahaya: selama kamera berjalan, sampel frame ke kanvas 32px tiap ~2 dtk;
  // dua sampel gelap berturut → lowLight aktif (UI menyarankan senter)
  useEffect(() => {
    if (status !== "running") return;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    darkStreakRef.current = 0;
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      try {
        ctx.drawImage(v, 0, 0, 32, 32);
        const { data } = ctx.getImageData(0, 0, 32, 32);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const dark = sum / (data.length / 4) < LUX_DARK_THRESHOLD;
        darkStreakRef.current = dark ? darkStreakRef.current + 1 : 0;
        const isDark = darkStreakRef.current >= LUX_DARK_STREAK;
        setLowLight((prev) => (prev === isDark ? prev : isDark));
      } catch {
        /* frame belum siap — coba lagi pada interval berikutnya */
      }
    }, LUX_SAMPLE_MS);
    return () => clearInterval(timer);
  }, [status]);

  /** Simulasi scan (tombol demo / keyboard di desktop) */
  const simulate = useCallback((code: string) => handle(code), [handle]);

  useEffect(() => stop, [stop]);

  return { videoRef, status, torchOn, torchSupported, lowLight, start, stop, toggleTorch, simulate };
}
