/* OSES-J service worker: makes the installed app feel native (instant shell, offline notice).
   Static assets are cached; API responses and pages are always network-first and never stored stale. */
const VERSION = "oses-sw-v1";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll([OFFLINE_URL, "/brand/oses-j-mark.svg", "/brand/oses-j-wordmark.svg", "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("oses-sw-") && k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/fonts/") || /\.(woff2|png|svg|ico)$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(caches.open(STATIC).then(async (cache) => (await cache.match(req)) ?? fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
