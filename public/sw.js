/*
 * Daet Watch service worker.
 *
 * Hand-written on purpose: next-pwa and Serwist both inject their worker through
 * a webpack plugin, and Next 16 builds with Turbopack — the plugin silently does
 * nothing there. This file is served with `Cache-Control: no-store` (see
 * next.config.ts) so a new deploy always gets a new worker.
 *
 * Strategies:
 *   app shell + icons     cache-first (precached on install)
 *   API GETs              stale-while-revalidate
 *   issue detail pages    network-first, cached fallback when offline
 *   navigations           network-first → cached page → /offline
 */
const VERSION = "v1";
const SHELL = `dw-shell-${VERSION}`;
const RUNTIME = `dw-runtime-${VERSION}`;
const PAGES = `dw-pages-${VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("dw-") && ![SHELL, RUNTIME, PAGES].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isApiGet = (request) =>
  request.method === "GET" && new URL(request.url).pathname.startsWith("/api/");

const isIssuePage = (request) =>
  request.mode === "navigate" && new URL(request.url).pathname.startsWith("/issue/");

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const fresh = await network;
  if (fresh) return fresh;
  return new Response(JSON.stringify({ error: { code: "offline", message: "You are offline" } }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isApiGet(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isIssuePage(request)) {
    event.respondWith(
      networkFirst(request, PAGES).catch(() => caches.match("/offline").then((r) => r ?? Response.error())),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, PAGES).catch(() => caches.match("/offline").then((r) => r ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && (request.destination === "script" || request.destination === "style" || request.destination === "image" || request.destination === "font")) {
            const copy = response.clone();
            void caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
    }),
  );
});

// Background Sync is Chromium-only; the client also flushes on `online` and on
// visibilitychange, which is what actually works on iOS.
self.addEventListener("sync", (event) => {
  if (event.tag === "daet-watch-flush") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        for (const client of clients) client.postMessage({ type: "sync-queue" });
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "skip-waiting") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "Daet Watch", body: "An issue you follow changed.", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    /* keep the default */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
