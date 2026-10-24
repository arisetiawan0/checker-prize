/* ============================================================
   app.js — Orkestrasi UI
   View: gate PIN → scanner → hasil (sheet/panel) | cari | riwayat
   ============================================================ */

(function () {
  "use strict";

  const API = window.BeautyAPI;
  const Fmt = window.BeautyFmt;
  const Scanner = window.BeautyScanner;
  const $ = (sel) => document.querySelector(sel);

  /* ---------- Konstanta & state ---------- */
  const PIN_CODE = "280101"; // demo; nanti diganti verifikasi backend
  const PIN_KEY = "beauty.pc.unlocked";
  const HISTORY_KEY = "beauty.pc.history";
  const HISTORY_MAX = 50;

  const state = {
    online: navigator.onLine,
    history: [],
    countdownTimer: null,
    activeResult: null,
    lastView: "scan"
  };

  /* ---------- Elemen ---------- */
  const els = {
    gate: $("#view-gate"),
    gateForm: $("#gate-form"),
    pinInput: $("#pin-input"),
    pinCells: $("#pin-cells"),
    pinCellsList: () => Array.from($("#pin-cells").children),
    gateMsg: $("#gate-msg"),
    gateSubmit: $("#gate-submit"),
    pinFill: $("#pin-fill"),
    app: $("#app"),
    syncPill: $("#sync-pill"),
    syncPillText: $("#sync-pill-text"),
    btnLockout: $("#btn-lockout"),
    viewScan: $("#view-scan"),
    viewSearch: $("#view-search"),
    viewHistory: $("#view-history"),
    camVideo: $("#cam-video"),
    camFallback: $("#cam-fallback"),
    viewfinder: $("#viewfinder"),
    scanStatus: $("#scan-status"),
    scanStatusText: $("#scan-status-text"),
    btnTorch: $("#btn-torch"),
    btnManual: $("#btn-manual"),
    btnHistoryDock: $("#btn-history-dock"),
    historyBadge: $("#history-badge"),
    searchBack: $("#search-back"),
    searchForm: $("#search-form"),
    searchInput: $("#search-input"),
    searchClear: $("#search-clear"),
    searchCount: $("#search-count"),
    searchResults: $("#search-results"),
    searchEmpty: $("#search-empty"),
    searchEmptyTitle: $("#search-empty-title"),
    searchEmptySub: $("#search-empty-sub"),
    searchSkeleton: $("#search-skeleton"),
    historyBack: $("#history-back"),
    historyClear: $("#history-clear"),
    historyList: $("#history-list"),
    historyEmpty: $("#history-empty"),
    historyEmptyCta: $("#history-empty-cta"),
    historyCount: $("#history-count"),
    overlay: $("#result-overlay"),
    sheet: $("#result-sheet"),
    sheetScroll: $("#sheet-scroll"),
    sheetClose: $("#sheet-close"),
    sheetRescan: $("#sheet-rescan"),
    toasts: $("#toast-region")
  };

  /* ---------- Ikon util ---------- */
  const ICONS = {
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 2.5 5.6 13.1c-.4.5 0 1.2.6 1.2h4.1l-1.4 6.8c-.1.7.7 1.1 1.1.5l7.7-10.6c.4-.5 0-1.2-.6-1.2h-4.2l1.5-6.7c.1-.7-.8-1.1-1.2-.6Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l2.8 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="m8.5 12.3 2.3 2.3 4.7-4.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8.5v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1" fill="currentColor"/><path d="M10.6 4.6 3.9 16.4a1.8 1.8 0 0 0 1.6 2.7h13a1.8 1.8 0 0 0 1.6-2.7L13.4 4.6a1.6 1.6 0 0 0-2.8 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1" fill="currentColor"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 10.5a10 10 0 0 1 14 0M8 13.8a6 6 0 0 1 8 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.2" fill="currentColor"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.1a1.6 1.6 0 0 0 1.4-.8l.6-1a1.6 1.6 0 0 1 1.4-.7h2a1.6 1.6 0 0 1 1.4.7l.6 1a1.6 1.6 0 0 0 1.4.8h1.1A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12.3" r="3.2" stroke="currentColor" stroke-width="1.7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.7"/><path d="m16.5 16.5 3.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
  };

  /* ---------- Util umum ---------- */
  function initials(name) {
    const words = name.split(/\s+/).filter(Boolean);
    return (words[0][0] + (words[1] ? words[1][0] : words[0][1] || "")).toUpperCase();
  }

  function toneClass(i) {
    const tones = ["thumb--rose", "thumb--mint", "thumb--blue", "thumb--amber", "thumb--lilac", "thumb--green"];
    return tones[i % tones.length];
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }

  function fmtWitaDateID(iso) {
    if (!iso) return "";
    const ms = Date.parse(iso);
    if (isNaN(ms)) return iso;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar"
    }).format(new Date(ms));
  }

  function hhmmNowWita() {
    const w = new Date(Date.now() + 8 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, "0");
    return p(w.getUTCHours()) + ":" + p(w.getUTCMinutes());
  }

  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  /* ---------- Toast ---------- */
  function toast(kind, msg, ms = 3200) {
    const el = document.createElement("div");
    el.className = "toast toast--" + kind;
    el.innerHTML = (ICONS[kind === "ok" ? "check" : kind === "err" ? "alert" : "info"]) + "<span>" + esc(msg) + "</span>";
    els.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 280);
    }, ms);
  }

  /* ---------- Navigasi view ---------- */
  function showView(name) {
    els.viewScan.hidden = name !== "scan";
    els.viewSearch.hidden = name !== "search";
    els.viewHistory.hidden = name !== "history";
    if (name === "scan") {
      startCamera();
    } else {
      Scanner.stop();
      els.btnTorch.disabled = true;
      setTorchUI(false);
      els.scanStatus.hidden = true;
    }
    if (name === "search") {
      els.searchInput.focus({ preventScroll: true });
    }
    if (name === "history") renderHistory();
  }

  function startCamera() {
    const st = Scanner.status();
    if (st === "running") return;
    els.camFallback.hidden = false;
    els.viewScan.querySelector(".scan-stage").classList.remove("is-nocam");
    Scanner.start(els.camVideo, onCodeDetected).then((s) => {
      if (s === "running") {
        els.camFallback.hidden = true;
        els.scanStatus.hidden = false;
        els.scanStatusText.textContent = "Kamera siap — arahkan ke barcode";
        els.btnTorch.disabled = false;
      } else if (s === "denied") {
        showCamFallback("Izin kamera ditolak", "Buka izin kamera di pengaturan browser, atau gunakan input manual di bawah.");
      } else {
        showCamFallback("Kamera tidak tersedia", "Gunakan input manual untuk mengetik barcode atau SKU produk. Tap panel ini untuk mencoba kode sampel.");
      }
    });
  }

  function showCamFallback(title, sub) {
    els.camFallback.hidden = false;
    els.camFallback.querySelector(".cam-fallback__title").textContent = title;
    els.camFallback.querySelector(".cam-fallback__sub").textContent = sub;
    els.scanStatus.hidden = true;
    els.viewScan.querySelector(".scan-stage").classList.add("is-nocam");
  }

  function setTorchUI(on) {
    els.btnTorch.setAttribute("aria-pressed", on ? "true" : "false");
    els.btnTorch.classList.toggle("is-on", on);
  }

  /* ---------- Gerbang PIN ---------- */
  function initGate() {
    if (localStorage.getItem(PIN_KEY) === "1") {
      unlock(true);
      return;
    }
    els.pinInput.focus({ preventScroll: true });

    els.pinInput.addEventListener("input", () => {
      const digits = els.pinInput.value.replace(/\D/g, "").slice(0, 6);
      els.pinInput.value = digits;
      renderPinCells(digits);
      els.gateMsg.textContent = "";
      els.gateMsg.classList.remove("is-error");
      if (digits.length === 6) {
        setTimeout(tryUnlock, 140);
      }
    });

    els.gateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      tryUnlock();
    });

    els.pinFill.addEventListener("click", () => {
      els.pinInput.value = PIN_CODE;
      renderPinCells(PIN_CODE);
      setTimeout(tryUnlock, 160);
    });
  }

  function renderPinCells(digits) {
    const cells = els.pinCellsList();
    cells.forEach((cell, i) => {
      const d = digits[i];
      cell.textContent = d ? "•" : "";
      cell.classList.toggle("is-filled", !!d);
      cell.classList.toggle("is-active", i === digits.length && digits.length < 6);
    });
  }

  function tryUnlock() {
    const val = els.pinInput.value;
    if (val.length < 6) {
      els.gateMsg.textContent = "Masukkan lengkap 6 digit kode akses.";
      els.gateMsg.classList.add("is-error");
      els.pinInput.focus();
      return;
    }
    if (val !== PIN_CODE) {
      els.gateMsg.textContent = "Kode akses salah. Coba lagi atau hubungi supervisor.";
      els.gateMsg.classList.add("is-error");
      els.pinFieldShake();
      els.pinInput.value = "";
      renderPinCells("");
      els.pinInput.focus();
      vibrate([60, 40, 60]);
      return;
    }
    localStorage.setItem(PIN_KEY, "1");
    unlock();
  }

  function pinFieldShake() {
    const field = document.querySelector(".pin-field");
    field.classList.remove("is-shake");
    void field.offsetWidth;
    field.classList.add("is-shake");
  }

  function unlock(instant) {
    els.gate.hidden = true;
    els.app.hidden = false;
    initSyncPill();
    showView("scan");
    if (!instant) vibrate(30);
  }

  function lockout() {
    localStorage.removeItem(PIN_KEY);
    Scanner.stop();
    closeSheet(true);
    els.app.hidden = true;
    els.gate.hidden = false;
    els.pinInput.value = "";
    renderPinCells("");
    els.gateMsg.textContent = "";
    setTimeout(() => els.pinInput.focus(), 60);
  }

  /* ---------- Pill kesegaran data ---------- */
  function initSyncPill() {
    const t = API ? null : null;
    const hhmm = window.BeautyData.updatedAt.split(" ")[1];
    els.syncPillText.textContent = "Data diperbarui " + hhmm;
    els.syncPill.classList.add("is-stale");
    setTimeout(() => els.syncPill.classList.remove("is-stale"), 2200);
  }

  /* ---------- Deteksi kode (dari scanner / keyboard) ---------- */
  function onCodeDetected(code) {
    vibrate(45);
    els.viewfinder.classList.add("is-found");
    els.scanStatusText.textContent = "Kode terbaca: " + code;
    openPriceResult(code, { fromScan: true });
    setTimeout(() => els.viewfinder.classList.remove("is-found"), 900);
  }

  /* ---------- Hasil harga (sheet) ---------- */
  function openPriceResult(code, opts = {}) {
    openSheetSkeleton();
    API.getPrice(code).then((res) => {
      state.activeResult = res.ok ? res : null;
      if (res.ok) {
        pushHistory({
          code: res.product.barcode || code,
          sku: res.product.sku,
          name: res.product.name,
          price: res.effective_price,
          flash: !!res.flash_sale,
          at: Date.now()
        });
      }
      renderResult(res, code, opts);
    });
  }

  function openSheetSkeleton() {
    els.sheetScroll.innerHTML =
      '<div class="skel-row" style="grid-template-columns: 1fr"><div class="skel-lines" style="gap:14px">' +
      '<span style="width:38%;height:13px"></span><span style="width:72%;height:30px"></span>' +
      '<span style="width:52%;height:13px"></span><span style="width:60%;height:13px"></span></div></div>';
    showSheet();
  }

  function showSheet() {
    els.overlay.hidden = false;
    els.sheet.hidden = false;
    requestAnimationFrame(() => {
      els.overlay.classList.add("is-open");
      els.sheet.classList.add("is-open");
    });
  }

  function closeSheet(instant) {
    if (els.sheet.hidden) return;
    stopCountdown();
    els.overlay.classList.remove("is-open");
    els.sheet.classList.remove("is-open");
    const done = () => {
      els.overlay.hidden = true;
      els.sheet.hidden = true;
      els.sheetScroll.innerHTML = "";
    };
    if (instant) done();
    else setTimeout(done, 330);
  }

  function renderResult(res, code, opts) {
    if (!res.ok) {
      renderNotFound(code, opts);
      return;
    }

    const p = res.product;
    const flash = res.flash_sale;
    const isFlash = !!flash;

    let hero = "";
    if (isFlash) {
      hero =
        '<div class="res-hero is-flash">' +
          '<span class="res-hero__label"><span class="bolt">' + ICONS.bolt + '</span>Flash Sale Berlaku</span>' +
          '<div class="res-hero__price">' + esc(Fmt.rupiah(flash.price)) + '</div>' +
          '<div class="res-hero__sub">' +
            '<span class="cut">' + esc(Fmt.rupiah(res.regular_price)) + '</span>' +
            '<span class="chip-save">Hemat ' + flash.discount_percent + '%</span>' +
          '</div>' +
          '<div class="res-hero__count">' + ICONS.clock +
            '<span class="res-hero__count-num" id="cd-num">—</span>' +
          '</div>' +
        '</div>';
    } else if (res.flash_upcoming) {
      hero =
        '<div class="res-hero">' +
          '<span class="res-hero__label">Harga Reguler</span>' +
          '<div class="res-hero__price is-upcoming">' + esc(Fmt.rupiah(res.regular_price)) + '</div>' +
          '<div class="res-hero__sub"><span>Flash sale ' + esc(Fmt.rupiah(res.flash_upcoming_price)) +
            ' dimulai ' + esc(fmtWitaDateID(res.flash_upcoming_start)) + ' WITA</span></div>' +
        '</div>';
    } else {
      hero =
        '<div class="res-hero">' +
          '<span class="res-hero__label">Harga Reguler</span>' +
          '<div class="res-hero__price">' + esc(Fmt.rupiah(res.regular_price)) + '</div>' +
          '<div class="res-hero__sub"><span>' + (opts.fromScan ? "Hasil scan " + esc(code) : "Pencarian: " + esc(code)) + '</span></div>' +
        '</div>';
    }

    const schedCard = isFlash
      ? ""
      : '<div class="res-foot">' +
          '<span>Waktu server WITA · ' + esc(hhmmNowWita()) + '</span>' +
          '<span>Data diperbarui ' + esc(res.data_updated_hhmm) + '</span>' +
        '</div>';

    els.sheetScroll.innerHTML =
      hero +
      '<div class="res-id">' +
        '<div class="thumb ' + toneClass(p.sku.charCodeAt(4) + p.sku.charCodeAt(5)) + '">' + esc(initials(p.name)) + '</div>' +
        '<div class="res-id__txt">' +
          '<h3 class="res-id__name">' + esc(p.name) + '</h3>' +
          '<p class="res-id__codes">' + esc(p.sku) + ' · ' + esc(p.barcode) + '</p>' +
        '</div>' +
      '</div>' +
      '<dl>' +
        '<div class="res-row"><dt>Kategori</dt><dd>' + esc(p.category || "—") + '</dd></div>' +
        '<div class="res-row"><dt>Harga reguler</dt><dd>' + esc(Fmt.rupiah(res.regular_price)) + '</dd></div>' +
        (isFlash
          ? '<div class="res-row"><dt>Harga flash sale</dt><dd class="is-flash" style="color:var(--rose-ink)">' + esc(Fmt.rupiah(flash.price)) + '</dd></div>' +
            '<div class="res-row"><dt>Berlaku sampai</dt><dd>' + esc(fmtWitaDateID(flash.ends_at)) + ' WITA</dd></div>'
          : '<div class="res-row"><dt>Flash sale</dt><dd>' + (res.flash_upcoming ? "Terjadwal" : "Tidak aktif") + '</dd></div>') +
        '<div class="res-row"><dt>Harga efektif sekarang</dt><dd class="is-now">' + ICONS.check + esc(Fmt.rupiah(res.effective_price)) + '</dd></div>' +
      '</dl>' +
      schedCard;

    if (isFlash) startCountdown(flash.ends_at);
  }

  function renderNotFound(code, opts) {
    els.sheetScroll.innerHTML =
      '<div class="res-miss">' +
        '<div class="res-miss__art">' + ICONS.search + '</div>' +
        '<h3>Produk tidak ditemukan</h3>' +
        '<p>Kode <code>' + esc(code) + '</code> tidak terdaftar di spreadsheet. Coba cari manual, atau lapor ke admin jika barcode ini seharusnya ada.</p>' +
        '<div class="res-miss__actions">' +
          '<button type="button" class="btn btn--ghost" id="miss-search">Cari Manual</button>' +
        '</div>' +
      '</div>';
    $("#miss-search").addEventListener("click", () => {
      closeSheet();
      els.searchInput.value = code.length > 3 ? "" : "";
      showView("search");
      setTimeout(() => els.searchInput.focus(), 240);
    });
  }

  /* ---------- Countdown ---------- */
  function startCountdown(endsAtIso) {
    stopCountdown();
    const numEl = $("#cd-num");
    if (!numEl) return;
    const end = Date.parse(endsAtIso);

    const tick = () => {
      const remain = end - Date.now();
      if (remain <= 0) {
        stopCountdown();
        if (state.activeResult && state.activeResult.product) {
          toast("info", "Flash sale untuk produk ini telah berakhir", 4200);
          openPriceResult(state.activeResult.product.barcode || state.activeResult.product.sku, {});
        }
        return;
      }
      numEl.innerHTML = "<b>" + fmtClock(remain) + "</b><span>" + (remain >= 3600000 ? "jam" : "menit") + " lagi</span>";
    };
    tick();
    state.countdownTimer = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
  }

  /* ---------- Pencarian ---------- */
  let searchSeq = 0;
  let searchTimer = null;

  function initSearch() {
    els.searchForm.addEventListener("submit", (e) => e.preventDefault());

    els.searchInput.addEventListener("input", () => {
      els.searchClear.hidden = els.searchInput.value.length === 0;
      clearTimeout(searchTimer);
      const q = els.searchInput.value.trim();
      if (!q) {
        searchSeq++;
        renderSearchResults([], "");
        return;
      }
      els.searchSkeleton.hidden = false;
      els.searchEmpty.hidden = true;
      searchTimer = setTimeout(() => doSearch(q), 180);
    });

    els.searchClear.addEventListener("click", () => {
      els.searchInput.value = "";
      els.searchClear.hidden = true;
      els.searchInput.focus();
      renderSearchResults([], "");
    });

    els.searchBack.addEventListener("click", () => showView("scan"));
  }

  async function doSearch(q) {
    const seq = ++searchSeq;
    const results = await API.search(q);
    if (seq !== searchSeq) return; //abaikan hasil usang
    els.searchSkeleton.hidden = true;
    renderSearchResults(results, q);
  }

  function renderSearchResults(results, q) {
    els.searchResults.innerHTML = "";
    if (!q) {
      els.searchEmpty.hidden = false;
      els.searchEmptyTitle.textContent = "Mulai mengetik untuk mencari";
      els.searchEmptySub.textContent = "Cocokkan dengan nama produk, SKU, atau barcode. Maksimal 20 hasil teratas ditampilkan.";
      els.searchCount.textContent = "";
      return;
    }
    if (!results.length) {
      els.searchEmpty.hidden = false;
      els.searchEmptyTitle.textContent = "Tidak ada produk cocok";
      els.searchEmptySub.textContent = "Tidak ada hasil untuk \"" + q + "\". Coba kata kunci lain atau cek ejaan SKU.";
      els.searchCount.textContent = "0 hasil";
      return;
    }
    els.searchEmpty.hidden = true;
    els.searchCount.textContent = results.length + " produk ditemukan";

    results.forEach((r, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "result-card";
      btn.setAttribute("role", "option");
      btn.innerHTML =
        '<span class="thumb ' + toneClass(i) + '">' + esc(initials(r.name)) + '</span>' +
        '<span class="result-main">' +
          '<span class="result-name">' + esc(r.name) + '</span>' +
          '<span class="result-sku">' + esc(r.sku) + ' · ' + esc(r.barcode) + '</span>' +
        '</span>' +
        '<span class="result-price">' +
          (r.flash_active
            ? '<em>FLASH</em><strong class="rp-flash">' + esc(Fmt.rupiah(r.flash_price)) + '</strong>' +
              '<span class="rp-reg-cut">' + esc(Fmt.rupiah(r.regular_price)) + '</span>'
            : '<strong class="rp-reg">' + esc(Fmt.rupiah(r.regular_price)) + '</strong>') +
        '</span>';
      btn.addEventListener("click", () => openPriceResult(r.barcode || r.sku, { fromScan: false }));
      els.searchResults.appendChild(btn);
    });
  }

  /* ---------- Riwayat ---------- */
  function loadHistory() {
    try {
      state.history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch (_) {
      state.history = [];
    }
  }

  function pushHistory(entry) {
    // buang entri kode sama yang lama, taruh terbaru di depan
    state.history = state.history.filter((h) => h.code !== entry.code);
    state.history.unshift(entry);
    if (state.history.length > HISTORY_MAX) state.history.length = HISTORY_MAX;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    renderHistoryBadge();
  }

  function renderHistoryBadge() {
    const n = state.history.length;
    els.historyBadge.hidden = n === 0;
    els.historyBadge.textContent = n > 9 ? "9+" : String(n);
  }

  function renderHistory() {
    els.historyList.innerHTML = "";
    const items = state.history;
    els.historyEmpty.hidden = items.length > 0;
    els.historyCount.textContent = items.length
      ? items.length + " scan terakhir · tersimpan di perangkat ini"
      : "Tersimpan di perangkat ini";

    items.forEach((h) => {
      const d = new Date(h.at);
      const when = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(d) +
        " · " + new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item";
      btn.innerHTML =
        '<span class="thumb ' + toneClass(h.sku ? h.sku.charCodeAt(4) : h.code.length) + '">' + esc(initials(h.name || h.code)) + '</span>' +
        '<span class="history-main">' +
          '<span class="history-name">' + esc(h.name || h.code) + '</span>' +
          '<span class="history-sub">' + esc(h.sku || h.code) + '</span>' +
        '</span>' +
        '<span>' +
          '<span class="history-price' + (h.flash ? " is-flash" : "") + '">' + esc(Fmt.rupiah(h.price)) + '</span>' +
          '<span class="history-when">' + esc(when) + '</span>' +
        '</span>';
      btn.addEventListener("click", () => openPriceResult(h.code, { fromScan: false }));
      els.historyList.appendChild(btn);
    });
  }

  function initHistoryControls() {
    els.historyBack.addEventListener("click", () => showView("scan"));
    els.historyEmptyCta.addEventListener("click", () => showView("scan"));
    els.btnHistoryDock.addEventListener("click", () => showView("history"));

    els.historyClear.addEventListener("click", () => {
      if (!state.history.length) return;
      if (confirm("Hapus semua riwayat scan di perangkat ini?")) {
        state.history = [];
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
        renderHistoryBadge();
        toast("ok", "Riwayat dihapus");
      }
    });
  }

  /* ---------- Offline & konektivitas ---------- */
  function initConnectivity() {
    const update = () => {
      state.online = navigator.onLine;
      if (!state.online) {
        els.syncPill.classList.add("is-stale");
        els.syncPillText.textContent = "Offline — data mungkin usang";
        toast("info", "Sinyal lemah — menampilkan data terakhir yang tersimpan", 4000);
      } else {
        els.syncPill.classList.remove("is-stale");
        const hhmm = window.BeautyData.updatedAt.split(" ")[1];
        els.syncPillText.textContent = "Data diperbarui " + hhmm;
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
  }

  /* ---------- Keyboard helper (mode desktop demo) ---------- */
  function initKeyboardDemo() {
    // Ketik angka lalu Enter di layar scan → dianggap hasil scan (uji cepat tanpa kamera)
    document.addEventListener("keydown", (e) => {
      const inField = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (inField || els.app.hidden || !els.viewScan.hidden === false) return;
      if (els.viewScan.hidden) return;
      if (e.key === "Enter" && demoBuffer.length >= 8) {
        onCodeDetected(demoBuffer);
        demoBuffer = "";
        return;
      }
      if (/^\d$/.test(e.key)) {
        demoBuffer += e.key;
        if (demoBuffer.length > 14) demoBuffer = demoBuffer.slice(-14);
        els.scanStatus.hidden = false;
        els.scanStatusText.textContent = "Ketik barcode (" + demoBuffer + ") lalu Enter";
      }
    });
  }
  let demoBuffer = "";

  /* ---------- Service worker & PWA ---------- */
  function initPWA() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  /* ---------- Init ---------- */
  function init() {
    loadHistory();
    renderHistoryBadge();
    initGate();
    initSearch();
    initHistoryControls();
    initConnectivity();
    initKeyboardDemo();
    initPWA();

    els.btnManual.addEventListener("click", () => showView("search"));
    els.sheetClose.addEventListener("click", () => closeSheet());
    els.sheetRescan.addEventListener("click", () => {
      closeSheet();
      showView("scan");
    });
    els.overlay.addEventListener("click", () => closeSheet());
    els.btnLockout.addEventListener("click", lockout);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.sheet.hidden) closeSheet();
    });

    els.btnTorch.addEventListener("click", async () => {
      const on = await Scanner.toggleTorch();
      if (!on && !Scanner.torchOn()) {
        toast("info", "Senter tidak didukung kamera ini");
      } else {
        setTorchUI(Scanner.torchOn());
      }
    });

    Scanner.onUnavailable((reason) => {
      if (reason === "denied") {
        showCamFallback("Izin kamera ditolak", "Aktifkan izin kamera dari pengaturan browser, atau gunakan input manual.");
      } else {
        showCamFallback("Kamera tidak tersedia", "Gunakan input manual untuk mengetik barcode atau SKU produk.");
      }
    });

    // demo cepat: tap area viewfinder mensimulasikan scan salah satu barcode
    els.camFallback.addEventListener("click", () => {
      const demo = ["8991004102109", "8991004102406", "8991004103005", "8991004104804", "9999999999999"];
      Scanner.simulate(demo[Math.floor(Math.random() * demo.length)]);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
