/* ============================================================
   scanner.js — Modul scan barcode
   Backend scan memakai BarcodeDetector bila tersedia (Chrome Android),
   fallback @zxing/browser via CDN (Safari iOS). HTTPS/localhost wajib untuk kamera.
   Di prototype desktop tanpa kamera: fallback jendela undang (file picker)
   + kirim kode via keyboard untuk pengujian cepat.

   API publik:
     BeautyScanner.start(onDetected)  — mulai kamera + deteksi
     BeautyScanner.stop()             — hentikan kamera & loop deteksi
     BeautyScanner.toggleTorch()      — senter (bila didukung)
     BeautyScanner.onUnavailable(cb)  — callback bila kamera tak bisa dipakai
     BeautyScanner.status()           — "idle" | "starting" | "running" | "unsupported" | "denied" | "error"
   ============================================================ */

(function () {
  "use strict";

  let videoEl = null;
  let stream = null;
  let detector = null;
  let zxingReader = null;
  let rafId = null;
  let lastCode = null;
  let lastAt = 0;
  let torchOn = false;
  let track = null;
  let status = "idle";
  let onDetected = null;
  let onUnavailableCb = null;
  let zxingTried = false;

  const REPEAT_IGNORE_MS = 1400; // abaikan barcode yang sama dalam durasi ini
  const ZXING_CDN = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";

  function setStatus(s) {
    status = s;
  }

  async function ensureZxing() {
    if (zxingReader) return zxingReader;
    const mod = await import(/* @vite-ignore */ ZXING_CDN);
    const { BrowserMultiFormatReader } = mod;
    zxingReader = new BrowserMultiFormatReader();
    return zxingReader;
  }

  async function start(video, cb) {
    videoEl = video;
    onDetected = cb;
    if (status === "running" || status === "starting") return status;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("unsupported");
      if (onUnavailableCb) onUnavailableCb("unsupported");
      return status;
    }

    setStatus("starting");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (err) {
      setStatus(err && err.name === "NotAllowedError" ? "denied" : "error");
      if (onUnavailableCb) onUnavailableCb(status);
      return status;
    }

    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "true");
    try { await videoEl.play(); } catch (_) { /* autoplay guard */ }
    track = stream.getVideoTracks()[0];

    // pilih mesin deteksi
    if ("BarcodeDetector" in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        const want = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
        const use = want.filter((f) => formats.includes(f));
        detector = new window.BarcodeDetector({ formats: use.length ? use : undefined });
      } catch (_) {
        detector = null;
      }
    }

    if (detector) {
      loopNative();
    } else {
      try {
        await ensureZxing();
        decodeWithZxing();
      } catch (_) {
        // tanpa mesin deteksi: kamera jalan tapi tak bisa membaca → minta input manual
        setStatus("unsupported");
        if (onUnavailableCb) onUnavailableCb("no-detector");
        return status;
      }
    }

    setStatus("running");
    return status;
  }

  function loopNative() {
    const tick = async () => {
      if (status !== "running" && status !== "starting") return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes && codes.length) handle(codes[0].rawValue);
      } catch (_) { /* frame gagal: lanjut */ }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function decodeWithZxing() {
    zxingReader.decodeFromVideoElement(videoEl, (result) => {
      if (result) handle(result.getText());
    });
  }

  function handle(code) {
    const now = Date.now();
    if (code === lastCode && now - lastAt < REPEAT_IGNORE_MS) return;
    lastCode = code;
    lastAt = now;
    if (onDetected) onDetected(code);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (zxingReader) {
      try { zxingReader.reset(); } catch (_) {}
      zxingReader = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    track = null;
    torchOn = false;
    detector = null;
    setStatus("idle");
  }

  async function toggleTorch() {
    if (!track) return false;
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (!caps.torch) return false;
      torchOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      return torchOn;
    } catch (_) {
      return false;
    }
  }

  /** Uji tanpa kamera: kirim kode manual (dipakai tombol demo) */
  function simulate(code) {
    handle(code);
  }

  window.BeautyScanner = {
    start,
    stop,
    toggleTorch,
    simulate,
    onUnavailable: (cb) => { onUnavailableCb = cb; },
    status: () => status,
    torchOn: () => torchOn
  };
})();
