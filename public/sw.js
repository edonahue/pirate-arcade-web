// Pirate Arcade Service Worker
// Cache same-origin assets for faster repeat visits

const CACHE_NAME = 'pirate-arcade-games-v1';
const ASSETS_TO_CACHE = [
  // Core game pages
  '/play/cannonball-clash/',
  '/play/treasure-cove/',
  '/play/krakens-wake/',
  
  // Shared assets
  '/play/shared/game-boot-metrics.js',
  '/play/shared/pygame-input-bridge.js',
  '/play/shared/mobile-controls.js',
  '/play/shared/mobile-controls.css',
  '/play/shared/audio-bridge.js',
  
  // Game archives
  '/play/cannonball-clash/cannonball-clash.tar.gz',
  '/play/treasure-cove/treasure-cove.tar.gz',
  '/play/krakens-wake/krakens-wake.tar.gz',
  
  // Favicons and icons
  '/favicon.svg',
];

// Install service worker and cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate service worker and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName.startsWith('pirate-arcade-') && cacheName !== CACHE_NAME;
        }).map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch assets from cache, falling back to network
self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise, fetch from network and cache for future
        return fetch(event.request).then((networkResponse) => {
          // Don't cache non-200 responses or non-GET requests
          if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
            return networkResponse;
          }
          
          // Clone the response since it's a stream that can only be consumed once
          const responseToCache = networkResponse.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
            
          return networkResponse;
        });
      })
      .catch(() => {
        // If both cache and network fail, show a fallback for HTML requests
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/play/'); // Fallback to arcade homepage
        }
      })
  );
});