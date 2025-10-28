const CACHE_NAME = "nativan-finance-v2"; // ubah versi setiap kali update besar
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
];

// Install - cache file utama
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // langsung aktif tanpa nunggu versi lama selesai
});

// Activate - hapus cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// Fetch - network first untuk index.html, cache first untuk file lain
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // HTML → selalu ambil dari jaringan dulu, agar update langsung muncul
  if (req.mode === "navigate" || req.url.endsWith("index.html")) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
  }
  // Selain HTML → ambil dari cache dulu, baru jaringan
  else {
    event.respondWith(
      caches.match(req).then(
        (cacheRes) =>
          cacheRes ||
          fetch(req).then((networkRes) => {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            return networkRes;
          })
      )
    );
  }
});
