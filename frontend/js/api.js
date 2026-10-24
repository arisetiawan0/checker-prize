/* ============================================================
   api.js — Lapisan API (mock, kontrak sesuai PRD §8)
   Respon meniru persis:
   GET /api/price?code={barcode|sku}  → 200 JSON | 404 {"error":"PRODUCT_NOT_FOUND"}
   GET /api/search?q={teks}           → [{...maks 20 hasil}]
   Nanti tinggal ganti isi fungsi dengan fetch() ke backend asli.
   ============================================================ */

(function () {
  "use strict";

  const DATA = window.BeautyData;

  // Zona waktu server: WITA (UTC+8) — PRD §6 poin 4
  const WITA_MS = 8 * 3600 * 1000;

  function nowWitaParts() {
    const w = new Date(Date.now() + WITA_MS);
    return {
      y: w.getUTCFullYear(), mo: w.getUTCMonth(), d: w.getUTCDate(),
      h: w.getUTCHours(), mi: w.getUTCMinutes(), s: w.getUTCSeconds()
    };
  }

  /** ISO string dengan offset +08:00, untuk field API (epoch → dinding jam WITA) */
  function isoWita(ms) {
    if (ms == null || isNaN(ms)) return null;
    return new Date(ms + WITA_MS).toISOString().replace("Z", "+08:00");
  }

  /** format "HH:MM" WITA dari epoch */
  function hhmmWita(ms) {
    const w = new Date(ms + WITA_MS);
    const p = (n) => String(n).padStart(2, "0");
    return p(w.getUTCHours()) + ":" + p(w.getUTCMinutes());
  }

  const fmt = new Intl.NumberFormat("id-ID");
  window.BeautyFmt = { rupiah: (n) => "Rp " + fmt.format(n) };

  /**
   * Resolve harga efektif — aturan PRD §6.
   * flash aktif hanya jika: harga_flash terisi && < reguler && sekarang ∈ [mulai, selesai].
   */
  function resolveFlash(row, nowMs) {
    if (!row.harga_flash || row.harga_flash >= row.harga_reguler) return null;
    const start = DATA.parseWita(row.flash_mulai);
    const end = DATA.parseWita(row.flash_selesai);
    const hasWindow = !isNaN(start) && !isNaN(end);

    // Opsi A: ada kolom periode → cek rentang waktu
    if (hasWindow) {
      if (nowMs >= start && nowMs <= end) {
        return {
          active: true,
          price: row.harga_flash,
          discount_percent: Math.round(((row.harga_reguler - row.harga_flash) / row.harga_reguler) * 100),
          starts_at: isoWita(start),
          ends_at: isoWita(end),
          seconds_remaining: Math.max(0, Math.round((end - nowMs) / 1000)),
          _startMs: start,
          _endMs: end
        };
      }
      // belum mulai → info jadwal untuk UI
      if (nowMs < start) {
        return { active: false, upcoming: true, price: row.harga_flash, _startMs: start, _endMs: end };
      }
      return null; // sudah berakhir
    }
    // Opsi B (tanpa periode): terisi = aktif
    return {
      active: true,
      price: row.harga_flash,
      discount_percent: Math.round(((row.harga_reguler - row.harga_flash) / row.harga_reguler) * 100),
      starts_at: null,
      ends_at: null,
      seconds_remaining: null,
      _startMs: null,
      _endMs: null
    };
  }

  // delay jaringan palsu agar state loading/skeleton teruji (cache hit ~120ms, miss ~450ms)
  function netDelay(base, jitter) {
    return new Promise(function (res) {
      setTimeout(res, base + Math.random() * jitter);
    });
  }

  function findRow(code) {
    const c = String(code || "").trim().toLowerCase();
    if (!c) return null;
    return (
      DATA.ROWS.find((r) => r.barcode.toLowerCase() === c) ||
      DATA.ROWS.find((r) => r.sku.toLowerCase() === c) ||
      null
    );
  }

  window.BeautyAPI = {
    /**
     * Mirip GET /api/price?code=...
     * resolve: { ok, product, regular_price, flash_sale, effective_price, data_updated_at, data_updated_hhmm }
     *          | { ok:false, notFound:true, code }
     */
    getPrice: async function (code) {
      await netDelay(140, 320);
      const row = findRow(code);
      if (!row) return { ok: false, notFound: true, code: String(code || "") };

      const nowMs = Date.now();
      const flash = resolveFlash(row, nowMs);
      const cleanFlash = flash && flash.active
        ? {
            active: true,
            price: flash.price,
            discount_percent: flash.discount_percent,
            starts_at: flash.starts_at,
            ends_at: flash.ends_at,
            seconds_remaining: flash.seconds_remaining
          }
        : null;

      return {
        ok: true,
        product: { sku: row.sku, barcode: row.barcode, name: row.nama, category: row.kategori },
        regular_price: row.harga_reguler,
        flash_sale: cleanFlash,
        flash_upcoming: !!(flash && !flash.active && flash.upcoming),
        flash_upcoming_price: flash && flash.upcoming ? flash.price : null,
        flash_upcoming_start: flash && flash.upcoming ? isoWita(flash._startMs) : null,
        effective_price: cleanFlash ? cleanFlash.price : row.harga_reguler,
        data_updated_at: isoWita(DATA.parseWita(DATA.updatedAt)),
        data_updated_hhmm: hhmmWita(DATA.parseWita(DATA.updatedAt)),
        // internal untuk countdown UI:
        _flash_end_ms: cleanFlash ? flash._endMs : null
      };
    },

    /**
     * Mirip GET /api/search?q=... — cocokkan nama/SKU/barcode, maks 20 hasil.
     * Query berisi ≥4 digit angka dianggap barcode/SKU prefix; selain itu nama.
     */
    search: async function (q) {
      await netDelay(120, 200);
      const term = String(q || "").trim().toLowerCase();
      if (!term) return [];
      const scored = [];
      for (const r of DATA.ROWS) {
        const name = r.nama.toLowerCase();
        let score = -1;
        if (r.sku.toLowerCase() === term || r.barcode === term) score = 100;
        else if (r.sku.toLowerCase().startsWith(term)) score = 90;
        else if (name.startsWith(term)) score = 80;
        else if (name.includes(term)) score = 60;
        else if (r.sku.toLowerCase().includes(term)) score = 50;
        else if (r.barcode.includes(term)) score = 40;
        if (score > 0) {
          const nowMs = Date.now();
          const f = resolveFlash(r, nowMs);
          scored.push({
            sku: r.sku,
            barcode: r.barcode,
            name: r.nama,
            regular_price: r.harga_reguler,
            flash_active: !!(f && f.active),
            flash_price: f && f.active ? f.price : null,
            _score: score
          });
        }
      }
      scored.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
      return scored.slice(0, 20).map(({ _score, ...rest }) => rest);
    }
  };
})();
