// Self-healing Service Worker: Clears legacy stale caches and unregisters.
const CACHE_NAME = 'meteor-split-shell-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch directly from network to prevent caching stale shells
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
