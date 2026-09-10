const CACHE_NAME = 'jimbox-shell-v4';
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
// Importante: usamos {cache:'no-store'} para saltarnos también la caché normal
// del navegador (no solo la del Service Worker) — sin esto, GitHub Pages puede
// servir una copia guardada del archivo aunque el Service Worker "pida red",
// y los cambios tardan en llegar a quien tiene la app instalada.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, {cache: 'no-store'})
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Avisos push: esto es lo que permite que llegue un aviso al móvil aunque la
// app esté cerrada. El aviso lo manda un Cloud Function de Firebase (todavía
// por implementar) al token de cada dispositivo suscrito; aquí solo nos
// encargamos de mostrarlo con el icono de JIMBOX, y de abrir la app si se
// toca. Si el mensaje trae datos raros o viene mal formado, no rompe nada:
// se muestra un aviso genérico en vez de fallar en silencio.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'JIMBOX', body: event.data ? event.data.text() : '' };
  }
  // A veces Firebase envuelve los datos dentro de un campo "data" adicional
  // en vez de mandarlos sueltos; aquí comprobamos las dos formas posibles.
  const data = (payload.data && (payload.data.title || payload.data.body)) ? payload.data : payload;
  const title = data.title || 'JIMBOX';
  const options = {
    body: data.body || '',
    icon: 'https://mailabstudio.github.io/jimbox/icon-192-final.png',
    badge: 'https://mailabstudio.github.io/jimbox/icon-badge-silhouette.png',
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
