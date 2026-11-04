// Сервис-воркер: кэширует только файлы этого же сайта, чтобы приложение открывалось без сети.
// Страница берётся из сети (свежая версия), при отсутствии сети — из кэша.
const CACHE = 'dispatcher-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const remember = (res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(remember).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then(remember).catch(() => hit);
      return hit || net;
    }),
  );
});
