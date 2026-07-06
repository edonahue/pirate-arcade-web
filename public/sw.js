// Pirate Arcade Service Worker
// Cache same-origin assets for faster repeat visits.
// Version bump when behavior changes.
// v6: fix install result counting, exact origin check, warm dedup,
//     awaited cache writes, versioned cache-key consistency.
//
// NOTE: This is a CLASSIC service worker (not module). The CACHE_VERSION
// constant is populated by scripts/apply-game-asset-versions.mjs when
// versions change. Do NOT add top-level import statements.

const CACHE_VERSION = "pirate-arcade-games-v14";
const CACHE_NAME = CACHE_VERSION;

// Lightweight shell/shared assets to cache on install.
// Game archives are ~12 MB each and downloaded on demand via
// cache-first — their URLs carry ?h=<sha256> content hashes,
// making each version a unique, immutable cache entry.
// Only assets loaded WITHOUT a version query param are listed here.
const ASSETS_TO_CACHE = [
  "/play/cannonball-clash/",
  "/play/treasure-cove/",
  "/play/krakens-wake/",
  "/play/shared/game-boot-metrics.js",
  "/play/shared/pygame-input-bridge.js",
  "/play/shared/mobile-controls.js",
  "/play/shared/mobile-controls.css",
  "/play/shared/audio-bridge.js",
  "/favicon.svg",
];

// Install: cache each asset individually so one failure does not
// reject the whole promise. On failure we log and move on.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url)),
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
// Cache-aware: checks cache first, fetches only on miss.
// Deduplicates concurrent requests for the same URL via in-flight map.
// Accepts same-origin URLs only, normalizes relative paths, caches
// successful 200 responses, and posts a result message back to the client.
var _warmInFlight = {};

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
          normalized = new URL(raw, self.location.origin).href;
        } catch {
          results.push({ url: raw, status: "failed", error: "invalid URL" });
          continue;
        }
        // Reject cross-origin URLs using exact origin comparison
        try {
          const parsed = new URL(normalized);
          if (parsed.origin !== self.location.origin) {
            results.push({
              url: raw,
              status: "failed",
              error: "cross-origin rejected",
            });
            continue;
          }
        } catch {
          results.push({
            url: raw,
            status: "failed",
            error: "invalid URL",
          });
          continue;
        }
        // Check cache first (cache hit)
        try {
          const cached = await cache.match(normalized);
          if (cached && cached.status === 200) {
            results.push({
              url: normalized,
              status: "hit",
              httpStatus: cached.status,
            });
            continue;
          }
        } catch {
          // cache.match failure is non-fatal; fall through to fetch
        }
        // Deduplicate concurrent in-flight requests for the same URL.
        // If a fetch is already in flight, await its original promise.
        if (_warmInFlight[normalized]) {
          try {
            var original = await _warmInFlight[normalized];
            results.push({
              url: normalized,
              status: "deduplicated",
              httpStatus: original.httpStatus,
            });
          } catch (err) {
            results.push({
              url: normalized,
              status: "deduplicated-failed",
              error: err.message || "original fetch failed",
            });
          }
          continue;
        }
        // Fetch and cache — store the actual promise for dedup
        var fetchPromise = (async () => {
          try {
            const response = await fetch(normalized);
            if (response.status === 200) {
              await cache.put(normalized, response.clone());
              return {
                url: normalized,
                status: "fetched",
                httpStatus: response.status,
              };
            } else {
              return {
                url: normalized,
                status: "failed",
                httpStatus: response.status,
                error: "non-200 response",
              };
            }
          } catch (err) {
            return {
              url: normalized,
              status: "failed",
              error: err.message,
            };
          }
        })();
        _warmInFlight[normalized] = fetchPromise;
        try {
          const result = await fetchPromise;
          results.push(result);
        } finally {
          delete _warmInFlight[normalized];
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
  return fetch(event.request).then((res) => {
    if (res && res.status === 200) {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
    }
    return res;
  });
}

// Helper: cache-first with fetch fallback (for versioned assets)
function cacheFirst(event) {
  return caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        return caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone))
          .then(() => res);
      }
      return res;
    });
  });
}

// Fetch strategy
self.addEventListener("fetch", (event) => {
  try {
    var url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
      return;
    }
  } catch {
    return;
  }

  // Cache-first for versioned assets — ?v= for shared JS/CSS cache-busting
  // on each deploy, and ?h=<sha256> for content-addressed game archives.
  // Both produce unique URLs per version, safe to serve from cache indefinitely.
  if (url.search.includes("v=") || url.search.includes("h=")) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Cache-first for game archives (unversioned fallback).
  // Production archives always carry ?h= (caught above), but this
  // catch-all ensures archived game assets are cached on first fetch
  // even if the hash parameter is missing.
  if (url.pathname.endsWith(".tar.gz")) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Network-first for game shell JS/CSS so mobile controls update immediately
  // Web-native (Phaser) game routes also use network-first for JS/CSS bundles.
  const isGameShell =
    url.pathname.startsWith("/play/shared/") ||
    url.pathname.startsWith("/play/cannonball-clash/") ||
    url.pathname.startsWith("/play/treasure-cove/") ||
    url.pathname.startsWith("/play/krakens-wake/") ||
    url.pathname.startsWith("/play/race-to-treasure-island/");
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
