/**
 * Service Worker — Puntero
 * Estrategia: Cache-First para assets, Network-First para HTML.
 * Permite uso offline en obra cuando no hay señal.
 */

const CACHE_NAME = 'puntero-v2-rebrand';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './logo.svg',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable.svg',
  './app.js',
  './db_precios.js',
  './schedule.js',
  './logs.js',
  './contractors.js',
  './materials.js',
  './finances.js',
  './performance.js',
  './documents.js',
  './suppliers.js',
  './resources.js',
  // CDNs externos (jspdf)
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js'
];

// INSTALL: precachear assets críticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear todo pero sin fallar si algún CDN no responde
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('[SW] No se cacheó:', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ACTIVATE: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

// FETCH: estrategia diferenciada
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo manejar GET (no POST a APIs como Google Drive)
  if (event.request.method !== 'GET') return;

  // No interferir con APIs externas que requieren red real
  if (url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com')) {
    return; // dejar que pase normal
  }

  // Estrategia para HTML: network-first (para tener siempre la última versión)
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Guardar copia fresca en cache
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Estrategia para JS/CSS/imágenes: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Refrescar en background ("stale-while-revalidate")
        fetch(event.request).then(fresh => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, fresh));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, cloned));
        }
        return response;
      }).catch(() => {
        // Si falla todo, devolver fallback genérico
        if (event.request.destination === 'image') {
          return new Response('', { status: 200, headers: { 'Content-Type': 'image/png' } });
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// MENSAJES: permitir forzar actualización desde el app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0]?.postMessage({ done: true });
    });
  }
});
