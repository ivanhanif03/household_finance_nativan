const CACHE_NAME = "nativan-finance-v2"; // versi cache terbaru
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./sw.js",
  // CSS
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
  // Tambahkan font Google jika ingin offline
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap"
  // Jika ada JS lokal, tambahkan juga
];

// Install service worker dan cache semua asset
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting()) // aktifkan SW segera
  );
});

// Activate: hapus cache lama jika versi berubah
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: ambil dari cache dulu, jika tidak ada fetch online
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cachedRes => {
      return cachedRes || fetch(e.request).then(fetchRes => {
        // Simpan hasil fetch baru ke cache
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, fetchRes.clone());
          return fetchRes;
        });
      });
    }).catch(() => {
      // Fallback jika offline dan resource tidak ada di cache
      if (e.request.destination === "document") return caches.match("./index.html");
    })
  );
});
