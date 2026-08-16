const CACHE_NAME = 'jimbox-shell-v2';
const SHELL_FILES = ['./index.html', './manifest.json', './icon-192-final.png', './icon-512-final.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    ))
  );
  self.clients.claim();
});

// Estrategia: intenta siempre la red primero (para no trabajar nunca con datos
// desactualizados en una app que se guarda en la nube), y si no hay conexión,
// sirve la última copia guardada del "cascarón" de la app para que al menos abra.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
