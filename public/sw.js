// Minimal service worker: makes the app installable and offline-capable.
// Network-first for pages/assets; API requests are never cached (always fresh).
const CACHE = "budget-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs; let API + everything else go straight to network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, res.clone());
        return res;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error("offline and not cached");
      }
    })()
  );
});
