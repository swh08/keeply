const VERSION = "keeply-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PRIVATE_CACHE = `${VERSION}-private`;
const APP_SHELL = [
  "/zh-CN/offline",
  "/en/offline",
  "/manifest.webmanifest",
  "/app-icons/icon-192.png",
  "/app-icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHE") event.waitUntil(caches.delete(PRIVATE_CACHE));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok && !response.redirected && url.pathname.includes("/app/")) {
            const clone = response.clone();
            const cache = await caches.open(PRIVATE_CACHE);
            await cache.put(event.request, clone);
          }
          return response;
        })
        .catch(async () =>
          (await caches.match(event.request)) ||
          (await caches.match(url.pathname.startsWith("/en/") ? "/en/offline" : "/zh-CN/offline"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then(async (response) => {
      if (response.ok && ["style", "script", "image", "font"].includes(event.request.destination)) {
        const clone = response.clone();
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(event.request, clone);
      }
      return response;
    }))
  );
});
