// Pirate Arcade Service Worker
// Cache same-origin assets for faster repeat visits.
// Version bump when behavior changes.
// v4: robust install (no single-asset failure kills whole SW),
//     network-first HTML, stale-while-revalidate JS/CSS,
//     cache-first archives, debug signal for tests.
//
// NOTE: This is a CLASSIC service worker (not module). The CACHE_VERSION
// constant is populated by scripts/apply-game-asset-versions.mjs when
// versions change. Do NOT add top-level import statements.

const CACHE_VERSION = "pirate-arcade-games-v7";
const CACHE_NAME = CACHE_VERSION;

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

// WARM_CACHE handling at top-level scope (not nested inside activate).
// Accepts same-origin URLs only, normalizes relative paths, caches
// successful 200 responses, and posts a result message back to the client.
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "WARM_CACHE") return;
  const urls = event.data.urls || [];
  if (!Array.isArray(urls) || urls.length === 0) return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = [];
      for (const raw of urls) {
        let normalized;
        try {
          // Normalize relative URLs against origin
          normalized = new URL(raw, self.location.origin).href;
        } catch {
          results.push({ url: raw, ok: false, reason: "invalid URL" });
          continue;
        }
        // Reject cross-origin URLs
        if (!normalized.startsWith(self.location.origin)) {
          results.push({
            url: raw,
            ok: false,
            reason: "cross-origin rejected",
          });
          continue;
        }
        try {
          const response = await fetch(normalized, { cache: "no-store" });
          if (response.status === 200) {
            await cache.put(normalized, response.clone());
            results.push({ url: normalized, ok: true });
          } else {
            results.push({
              url: normalized,
              ok: false,
              reason: `HTTP ${response.status}`,
            });
          }
        } catch (err) {
          results.push({ url: normalized, ok: false, reason: err.message });
        }
      }
      // Post result back to the client so tests can verify
      if (event.source) {
        event.source.postMessage({ type: "WARM_CACHE_RESULT", results });
      }
    })(),
  );
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
