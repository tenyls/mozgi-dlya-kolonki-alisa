// Офлайн-копия сайта (PWA). При обновлении сайта поменяйте VERSION.
const VERSION = 'mozgi-16';
const FILES = ['./', 'index.html', 'instrukciya.html', 'styles.css', 'app.js', 'guide.js', 'idei.html', 'ideas.js', 'igra.html', 'gemini-help.html', 'manifest.webmanifest', 'img/logo-512.png', 'img/logo.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Сначала сеть (чтобы всегда была свежая версия), без сети — из кэша
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.search.includes('hash=')) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
