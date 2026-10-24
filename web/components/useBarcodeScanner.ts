"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScannerStatus = "idle" | "starting" | "running" | "unsupported" | "denied" | "error";

const ZXING_CDN = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";
const REPEAT_IGNORE_MS = 1400;

interface BarcodeDetectorLike {
  detect(video: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

/**
 * Hook scan barcode: BarcodeDetector bila tersedia (Chrome Android/desktop),
 * fallback @zxing/browser via CDN (Safari iOS). HTTPS/localhost wajib untuk kamera.
 */
export function useBarcodeScanner(onDetected: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [torchOn, setTorchOn] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingRef = useRef<{ reset: () => void } | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
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
    setTorchOn(false);
    setStatus("idle");
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
  }, [handle, status]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return false;
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (!("torch" in caps)) return false;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
      return next;
    } catch {
      return false;
    }
  }, [torchOn]);

  /** Simulasi scan (tombol demo / keyboard di desktop) */
  const simulate = useCallback((code: string) => handle(code), [handle]);

  useEffect(() => stop, [stop]);

  return { videoRef, status, torchOn, start, stop, toggleTorch, simulate };
}
