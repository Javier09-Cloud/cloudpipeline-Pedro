self.addEventListener("install", (e) => {
  console.log("Service Worker Installed");
  e.waitUntil(
    caches.open("optiroute-cache").then((cache) => {
      return cache.addAll([
        "./",
        "./index.html",
        "./style.css",
        "./script.js",
        "./assets/icon-192.png",
        "./assets/icon-512.png"
      ]);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
