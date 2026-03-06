const CACHE_NAME = "nativan-finance-v3"; // update versi jika ada perubahan besar

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",

  // CDN
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
];


// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );

  // langsung aktif tanpa menunggu SW lama
  self.skipWaiting();
});


// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});


// FETCH
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // hanya handle GET request
  if (req.method !== "GET") return;

  // ===== HTML (Network First) =====
  if (req.mode === "navigate" || req.headers.get("accept").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {

          const clone = networkRes.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone);
          });

          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((res) => {
            return res || caches.match("./index.html");
          });
        })
    );
  }

  // ===== Asset (Cache First) =====
  else {

    event.respondWith(
      caches.match(req).then((cacheRes) => {

        if (cacheRes) return cacheRes;

        return fetch(req).then((networkRes) => {

          const clone = networkRes.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone);
          });

          return networkRes;

        }).catch(() => {
          return caches.match("./index.html");
        });

      })
    );

  }
});