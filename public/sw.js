// Service Worker for 変拍子メトロノーム PWA
// Strategy: Network-first with cache fallback for offline support

// IMPORTANT: Increment CACHE_VERSION on each deployment to invalidate old caches.
// Failing to update will cause users to continue running stale cached code.
// Consider using a build tool (e.g., Workbox) to automate cache versioning.
const CACHE_VERSION = 2;
const CACHE_NAME = `metronome-v${CACHE_VERSION}`;

// Core app shell files to pre-cache on install
const PRECACHE_URLS = [
  '/Metronome/',
  '/Metronome/index.html',
  '/Metronome/favicon.svg',
  '/Metronome/icon-192.png',
  '/Metronome/icon-512.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// Fetch: network-first strategy
// Tries network first; if offline, falls back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (e.g. Google Fonts, Analytics)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses to prevent cache poisoning with error pages
        if (!response || !response.ok) {
          return response;
        }

        // Clone response before caching (response body can only be consumed once)
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Network failed — try to serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});
