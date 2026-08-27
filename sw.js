const CACHE_NAME = "ffc-cache-v5";

const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
"./icon-192.png",
"./icon-512.png"

];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME)
            return caches.delete(key);
        })
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {

  event.respondWith(
    caches.match(event.request)
      .then(response => {

        if (response)
          return response;

        return fetch(event.request)
          .then(networkResponse => {

            const cloned = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, cloned));

            return networkResponse;
          })
          .catch(() =>
            caches.match("./index.html")
          );
      })
  );

});