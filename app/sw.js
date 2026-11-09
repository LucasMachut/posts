// Service worker : l'application fonctionne hors ligne une fois ouverte une premiere fois.
// En ligne, le code est toujours pris sur le reseau (donc toujours a jour) ; hors ligne, depuis le cache.
const V = 'posts-v3-3';
const SHELL = ['./', './index.html', './css/app.css', './manifest.webmanifest',
  './js/main.js', './js/ui.js', './js/render.js', './js/state.js', './js/model.js', './js/photos.js',
  './js/gestures.js', './js/geometry.js', './js/veil.js', './js/grain.js', './js/export.js', './js/generator.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (isFont) {
    // polices : cache d'abord, reseau sinon
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r;
    }).catch(() => fetch(e.request)));
    return;
  }
  if (url.origin !== location.origin) return;
  // application : reseau d'abord, cache en secours
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) caches.open(V).then(c => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match(e.request).then(h => h || caches.match('./index.html'))));
});
