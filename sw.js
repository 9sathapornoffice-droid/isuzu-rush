// ISUZU RUSH - Progressive Web App (PWA) Service Worker
const CACHE_NAME = 'isuzu-rush-pwa-v1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.png'
];

// Install: Cache offline essentials and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches & take control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first strategy with offline cache fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and non-http(s) schemes (like chrome-extension://)
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Bypass caching for live server API calls (Leaderboard, anti-cheat, session)
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Network First, fallback to cache for offline support
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        // Clone and cache successful response
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      })
      .catch(async () => {
        // Network failed (offline) -> serve from cache
        const cachedRes = await caches.match(req);
        if (cachedRes) {
          return cachedRes;
        }
        // Fallback for page navigation to root/index.html
        if (req.mode === 'navigate') {
          const navFallback = await caches.match('./') || await caches.match('./index.html');
          if (navFallback) return navFallback;
        }
        return new Response('Network error occurred', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      })
  );
});
