/* ============================================================
   sw.js — Service worker Beauty Price Checker
   Strategi (PRD F5):
   - App shell: cache-first untuk aset statis (stale-while-revalidate)
   - Navigasi: network-first, fallback ke shell saat offline
   - Data harga: jangan di-cache permanen — network-first, fallback cache terakhir
     dengan penanda "mungkin tidak terbaru" (ditangani UI).
   ============================================================ */

const CACHE = "beauty-price-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/data.js",
  "./js/api.js",
  "./js/scanner.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(ASSETS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigasi halaman: network-first, fallback shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Aset same-origin: stale-while-revalidate
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fresh;
      })
    );
  }
  // Permintaan lintas origin (font, CDN zxing): biarkan lewat network biasa.
});
