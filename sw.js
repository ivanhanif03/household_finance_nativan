// sw.js
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("nativan-finance-v1").then(cache => {
      return cache.addAll([
        "./",
        "./index.html",
        "./manifest.json",
        "./assets/icons/icon-192.png",
        "./assets/icons/icon-512.png",
        // tambahkan CSS/JS jika perlu
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
      ]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
