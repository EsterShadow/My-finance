/* =============================================
   SERVICE WORKER — cache-first, офлайн-режим
   ============================================= */

const CACHE_NAME = 'myfinance-v8';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/reports.js',
  './js/export.js',
  './js/backup.js',
  './js/cloud.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
