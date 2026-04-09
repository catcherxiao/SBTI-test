const CACHE_NAME = 'sbti-static-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/share-qr.png',
  './image/ATM-er.png',
  './image/BOSS.png',
  './image/CTRL.png',
  './image/DEAD.png',
  './image/DRUNK.png',
  './image/Dior-s.jpg',
  './image/FAKE.png',
  './image/FUCK.png',
  './image/GOGO.png',
  './image/HHHH.png',
  './image/IMFW.png',
  './image/IMSB.png',
  './image/JOKE-R.jpg',
  './image/LOVE-R.png',
  './image/MALO.png',
  './image/MONK.png',
  './image/MUM.png',
  './image/OH-NO.png',
  './image/OJBK.png',
  './image/POOR.png',
  './image/SEXY.png',
  './image/SHIT.png',
  './image/SOLO.png',
  './image/THAN-K.png',
  './image/THIN-K.png',
  './image/WOC.png',
  './image/ZZZZ.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isHtml2CanvasCdn = url.origin === 'https://cdn.jsdelivr.net';

  if (!isSameOrigin && !isHtml2CanvasCdn) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      });
    })
  );
});
