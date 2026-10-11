/* ═══════════════════════════════════════════════════════════════════════════
   Service worker de HIERRO
   Objetivo: que la app abra en el gimnasio aunque no haya señal.
     · El shell (HTML, CSS, JS, datos) se guarda al instalar.
     · Las navegaciones van primero a la red, con el shell cacheado de respaldo.
     · Las microfiguras del CDN se guardan a medida que se ven.
   Al publicar cambios, subí el número de VERSION para invalidar la caché vieja.
   ═══════════════════════════════════════════════════════════════════════════ */

var VERSION = 'hierro-v10';
var SHELL = [
  './',
  './index.html',
  './styles.css',
  './app-core.js',
  './app.js',
  './data/exercises.js',
  './data/routines.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { /* un asset faltante no debe romper la instalación */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Navegación: red primero, shell cacheado como respaldo.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Mismo origen (CSS, JS, datos): se responde al instante desde la copia
  // guardada y en paralelo se busca la versión nueva para actualizarla
  // (stale-while-revalidate). Así una versión nueva entra en la carga
  // siguiente sin depender de que alguien se acuerde de subir VERSION.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        var red = fetch(req).then(function (res) {
          if (res && res.ok && res.type === 'basic') {
            var copy = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || red;
      })
    );
    return;
  }

  // Terceros (CDN de microfiguras, tipografías, Tailwind, FontAwesome):
  // se responde de la caché si está, y se refresca en segundo plano.
  event.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
