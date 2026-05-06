const CACHE_NAME = "ffc-cache";

const FILES = [
  "./",
  "./ffc_v4.html",
  "./app.js",
  "./style.css"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});