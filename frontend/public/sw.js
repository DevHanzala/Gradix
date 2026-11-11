/*
 * Gradix service worker. It caches ONLY static files (the built JS/CSS in /assets/, fonts,
 * icons and the offline page). It never caches or answers API requests (exams, login,
 * results...): those always go to the network. Page navigations go to the network and
 * fall back to the offline page when there is no connection.
 */
const CACHE = "gradix-static-v1";
const PRECACHE = ["/offline.html", "/favicon.svg", "/icon-192.png", "/manifest.webmanifest"];
const STATIC = /^\/(assets|fonts)\/|^\/(favicon\.svg|icon-[\w-]+\.png|manifest\.webmanifest|offline\.html)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Other origins (the API, R2 files, Google sign-in) and /api are never touched.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (!STATIC.test(url.pathname)) return;
  // Built files have content hashes in their names, so cache-first is safe.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
