/* ============================================================
   data.js — Katalog demo (stub spreadsheet)
   Nanti diganti: fetch CSV/JSON dari backend yang membaca Google Sheets.
   Kontrak baris mengikuti PRD §5.2:
   { sku, barcode, nama, harga_reguler, harga_flash, flash_mulai, flash_selesai }
   ============================================================ */

(function () {
  "use strict";

  /**
   * Generator timestamp WITA (UTC+8) relatif terhadap "sekarang",
   * agar demo selalu punya flash sale yang aktif, belum mulai, dan sudah berakhir.
   * Format mengikuti spreadsheet: "YYYY-MM-DD HH:mm" (waktu WITA).
   */
  function witaOffset(dt, minutes) {
    const d = new Date(dt.getTime() + minutes * 60000);
    // geser ke waktu WITA lalu cetak komponen lokal sebagai teks sheet
    const wita = new Date(d.getTime() + 8 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, "0");
    return (
      wita.getUTCFullYear() + "-" + p(wita.getUTCMonth() + 1) + "-" + p(wita.getUTCDate()) +
      " " + p(wita.getUTCHours()) + ":" + p(wita.getUTCMinutes())
    );
  }

  // Matriks kategori → palet thumbnail (hindari kemiripan berulang)
  const TONES = ["thumb--rose", "thumb--mint", "thumb--blue", "thumb--amber", "thumb--lilac", "thumb--green"];

  /**
   * Baris demo. Kolom mengikuti spreadsheet PRD.
   * flashDelta: [mulaiMenitRelatif, selesaiMenitRelatif] — null berarti tanpa flash.
   */
  const RAW = [
    ["BK-0001", "8991004102109", "Glow Serum Vit C 30ml", 189000, 139000, [-95, 125]],
    ["BK-0002", "8991004102208", "Hydra Barrier Cream 50g", 249000, null, null],
    ["BK-0003", "8991004102307", "Micellar Water 400ml", 119000, 89000, [-160, 20]],
    ["BK-0004", "8991004102406", "Sunscreen SPF 50 PA++++ 60ml", 159000, 119000, [-30, 150]],
    ["BK-0005", "8991004102505", "AHA BHA Exfoliating Toner 250ml", 175000, null, null],
    ["BK-0006", "8991004102604", "Retinol Night Serum 20ml", 279000, 199000, [-300, 60]],
    ["BK-0007", "8991004102703", "Cushion Foundation #23 15g", 229000, null, null],
    ["BK-0008", "8991004102802", "Matte Lip Mousse - Velvette", 109000, 79000, [-50, 45]],
    ["BK-0009", "8991004102901", "Gentle Gel Cleanser 150ml", 98000, null, null],
    ["BK-0010", "8991004103005", "Peptide Eye Cream 15ml", 215000, 169000, [-500, 200]],
    ["BK-0011", "8991004103104", "Rice Water Shampoo 320ml", 129000, null, null],
    ["BK-0012", "8991004103203", "Keratin Repair Hair Mask 250ml", 149000, 109000, [-120, 480]],
    ["BK-0013", "8991004103302", "Rose Water Face Mist 120ml", 89000, 65000, [25, 95]],
    ["BK-0014", "8991004103401", "Niacinamide 10% Serum 30ml", 165000, null, null],
    ["BK-0015", "8991004103500", "Ceramide Barrier Essence 150ml", 199000, 149000, [-240, -30]],
    ["BK-0016", "8991004103609", "Velvet Blush - Peach Fuzz", 89000, null, null],
    ["BK-0017", "8991004103708", "Precision Liquid Liner 1.2ml", 79000, 59000, [-400, 90]],
    ["BK-0018", "8991004103807", "Brow Sculpt Pencil - Taupe", 69000, null, null],
    ["BK-0019", "8991004103906", "Overnight Sleeping Mask 100ml", 189000, 145000, [-75, 25]],
    ["BK-0020", "8991004104002", "Vitamin C Brightening Sheet Mask (5 pcs)", 95000, null, null],
    ["BK-0021", "8991004104101", "Clay Detox Mask 75g", 119000, 85000, [-600, 180]],
    ["BK-0022", "8991004104200", "Lip Sleeping Butter 20g", 75000, 55000, [-15, 105]],
    ["BK-0023", "8991004104309", "Body Lotion Shea & Oat 250ml", 109000, null, null],
    ["BK-0024", "8991004104408", "Hand Cream Amber Vanilla 50ml", 69000, 49000, [-90, 300]],
    ["BK-0025", "8991004104507", "Pore Cleansing Oil 200ml", 145000, null, null],
    ["BK-0026", "8991004104606", "Tinted Moisturizer SPF 30 40ml", 185000, 139000, [-180, 30]],
    ["BK-0027", "8991004104705", "Setting Spray Dewy Fix 100ml", 99000, null, null],
    ["BK-0028", "8991004104804", "Eyeshadow Palette Muted Muse", 279000, 219000, [-55, 35]],
    ["BK-0029", "8991004104903", "Scalp Tonic Anti Hairfall 120ml", 155000, null, null],
    ["BK-0030", "8991004105009", "Collagen Boost Ampoule 7x2ml", 259000, 199000, [-350, 240]]
  ];

  const now = Date.now();

  const ROWS = RAW.map(function (r, i) {
    const hasFlash = r[4] !== null && r[5] !== null;
    return {
      sku: r[0],
      barcode: r[1],
      nama: r[2],
      harga_reguler: r[3],
      harga_flash: r[4],
      flash_mulai: hasFlash ? witaOffset(new Date(now), r[5][0]) : "",
      flash_selesai: hasFlash ? witaOffset(new Date(now), r[5][1]) : "",
      kategori: categoryOf(r[2]),
      tone: TONES[i % TONES.length]
    };
  });

  function categoryOf(nama) {
    const n = nama.toLowerCase();
    if (/serum|ampoule|essence|retinol|niacinamide|peptide/.test(n)) return "Perawatan";
    if (/lip|blush|liner|brow|eyeshadow|cushion|foundation|palette|spray|moisturizer/.test(n)) return "Makeup";
    if (/shampoo|mask .*hair|keratin|scalp/.test(n)) return "Rambut";
    if (/body|hand/.test(n)) return "Tubuh";
    return "Skincare";
  }

  /**
   * Paerseet tanggal sheet "YYYY-MM-DD HH:mm" sebagai WITA (UTC+8) → epoch ms.
   * Meniru perilaku backend (PRD §6 poin 4).
   */
  function parseWita(s) {
    if (!s) return NaN;
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s.trim());
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 8 * 3600 * 1000;
  }

  window.BeautyData = {
    ROWS: ROWS,
    parseWita: parseWita,
    // "kapan sheet terakhir diperbarui" — demo: beberapa menit lalu
    updatedAt: witaOffset(new Date(now - 2 * 60000), 0)
  };
})();
