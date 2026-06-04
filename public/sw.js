// Pirate Arcade Service Worker
// Cache same-origin assets for faster repeat visits.
// Version bump when behavior changes.
// v4: robust install (no single-asset failure kills whole SW),
//     network-first HTML, stale-while-revalidate JS/CSS,
//     cache-first archives, debug signal for tests.

const CACHE_NAME = "pirate-arcade-games-v6";

// List of assets to cache - only confirmed browser-playable games.
// Missing assets are added with individual try/catch so one failure
// does not prevent the rest from being cached.
const ASSETS_TO_CACHE = [
  "/play/cannonball-clash/",
  "/play/treasure-cove/",
  "/play/shared/game-boot-metrics.js",
  "/play/shared/pygame-input-bridge.js",
  "/play/shared/mobile-controls.js",
  "/play/shared/mobile-controls.css",
  "/play/shared/audio-bridge.js",
  "/play/cannonball-clash/cannonball-clash.tar.gz",
  "/play/treasure-cove/treasure-cove.tar.gz",
  "/favicon.svg",
];

// Install: cache each asset individually so one failure does not
// reject the whole promise. On failure we log and move on.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache ${url}:`, err);
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.warn(`[SW] ${failed} asset(s) failed to cache during install`);
      }
      // Skip waiting so the new SW activates immediately
      self.skipWaiting();
    })(),
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith("pirate-arcade-") && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
  );
  // Signal that this SW is active
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: "SW_ACTIVATED", cache: CACHE_NAME });
    });
  });
});

// Helper: network-first with cache fallback
function networkFirst(event) {
  return fetch(event.request)
    .then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
      }
      return res;
    })
    .catch(() =>
      caches.match(event.request).then((fallback) => {
        if (fallback) return fallback;
        return new Response("Offline", { status: 503 });
      }),
    );
}

// Helper: cache-first with fetch fallback (for versioned assets)
function cacheFirst(event) {
  return caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
      }
      return res;
    });
  });
}

// Fetch strategy
self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // Network-first for game archives — always get latest after deploy
  if (url.pathname.endsWith(".tar.gz")) {
    event.respondWith(networkFirst(event));
    return;
  }

  // Network-first for game shell JS/CSS so mobile controls update immediately
  const isGameShell =
    url.pathname.startsWith("/play/shared/") ||
    url.pathname.startsWith("/play/cannonball-clash/") ||
    url.pathname.startsWith("/play/treasure-cove/");
  if (
    isGameShell &&
    (event.request.destination === "script" ||
      event.request.destination === "style")
  ) {
    event.respondWith(networkFirst(event));
    return;
  }

  // Network-first for HTML pages
  if (
    event.request.destination === "document" ||
    url.pathname.endsWith(".html")
  ) {
    event.respondWith(networkFirst(event));
    return;
  }

  // Cache-first for versioned assets (has ?v= query)
  if (url.search.includes("v=")) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Cache-first for favicon and other stable assets
  if (url.pathname === "/favicon.svg") {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Stale-while-revalidate for everything else (non-game JS/CSS, images, etc.)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
