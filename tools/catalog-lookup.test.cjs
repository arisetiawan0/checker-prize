const assert = require("node:assert/strict");
const { test } = require("node:test");
const { findCatalogProduct } = require("../web/lib/catalog-lookup.ts");

const barcode = "8901526631605";

function promo(code = barcode) {
  return {
    barcode: code,
    nama: "GARNIER COL NAT ULTRA COOL ASH",
    tab: "promo",
    pareto: "FM",
    harga_jual: 22000,
    disc_reguler: 10,
    harga_reguler_diskon: 19800,
    disc_flash: 50,
    harga_flash_diskon: 11000
  };
}

function master(code = barcode) {
  return { barcode: code, nama: "Produk master", harga_jual: 22000, pareto: "FM" };
}

function catalog(promoRows = [], masterRows = []) {
  return {
    promo: new Map(promoRows.map((row) => [row.barcode.toLowerCase(), row])),
    master: new Map(masterRows.map((row) => [row.barcode.toLowerCase(), row]))
  };
}

test("631605 resolves to the unique full Garnier barcode", () => {
  const row = promo();
  assert.equal(findCatalogProduct(catalog([row]), "631605").promo, row);
});

test("the same barcode in promo and master is not ambiguous", () => {
  const promoRow = promo();
  const masterRow = master();
  assert.deepEqual(findCatalogProduct(catalog([promoRow], [masterRow]), "631605"), {
    promo: promoRow,
    master: masterRow
  });
});

test("full barcode returns both promo and master data", () => {
  const promoRow = promo();
  const masterRow = master();
  assert.deepEqual(findCatalogProduct(catalog([promoRow], [masterRow]), barcode), {
    promo: promoRow,
    master: masterRow
  });
});

test("an exact six-digit barcode takes priority over a longer barcode suffix", () => {
  const exact = master("631605");
  assert.deepEqual(findCatalogProduct(catalog([promo()], [exact]), "631605"), {
    promo: undefined,
    master: exact
  });
});

test("a unique master-only suffix resolves a non-promo product", () => {
  const row = master();
  assert.deepEqual(findCatalogProduct(catalog([], [row]), "631605"), {
    promo: undefined,
    master: row
  });
});

test("two promo barcodes with the same suffix are not automatically selected", () => {
  assert.equal(findCatalogProduct(catalog([promo(), promo("8999999631605")]), "631605"), null);
});

test("a suffix shared by promo and another master product is ambiguous", () => {
  assert.equal(findCatalogProduct(catalog([promo()], [master("8999999631605")]), "631605"), null);
});

test("a suffix shared by two master products is ambiguous", () => {
  assert.equal(findCatalogProduct(catalog([], [master(), master("8999999631605")]), "631605"), null);
});

test("suffixes shorter than six digits do not select a product", () => {
  assert.equal(findCatalogProduct(catalog([promo()]), "31605"), null);
});

test("exact lookup preserves short and case-insensitive catalog codes", () => {
  const short = master("12345");
  const sku = master("BK-0012");
  const rows = catalog([], [short, sku]);
  assert.equal(findCatalogProduct(rows, "12345").master, short);
  assert.equal(findCatalogProduct(rows, " bk-0012 ").master, sku);
});

test("prefix and middle matches are not used for automatic price lookup", () => {
  const rows = catalog([promo()]);
  assert.equal(findCatalogProduct(rows, "890152"), null);
  assert.equal(findCatalogProduct(rows, "152663"), null);
});

test("leading zeros in suffixes remain significant", () => {
  const row = master("8901526001605");
  const rows = catalog([], [row]);
  assert.equal(findCatalogProduct(rows, "001605").master, row);
  assert.equal(findCatalogProduct(rows, "01605"), null);
});

test("unknown and empty codes do not resolve a product", () => {
  const rows = catalog([promo()]);
  for (const code of ["", "   ", "999999", "8901526631606", "ASH", "63 1605"]) {
    assert.equal(findCatalogProduct(rows, code), null);
  }
});
