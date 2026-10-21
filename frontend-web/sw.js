/* Service worker de Switch.
   - Guarda el armazón de la app para abrirla sin conexión.
   - Nunca cachea /api ni /uploads: los datos y las imágenes cambian y
     además las respuestas de administración son privadas.
   - Estrategia: red primero para navegación; stale-while-revalidate para
     los archivos estáticos propios. */

const VERSION = 'switch-v1.1.7';
const CACHE_ESTATICO = `${VERSION}-estatico`;
const CACHE_NAVEGACION = `${VERSION}-navegacion`;
const SCOPE = new URL('./', self.location.href).pathname;

const ARMAZON = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tema.css',
  './css/componentes.css',
  './css/pantallas.css',
  './js/config.js',
  './js/store.js',
  './js/api.js',
  './js/ui.js',
  './js/router.js',
  './js/app.js',
  './js/screens/login.js',
  './js/screens/registro.js',
  './js/screens/catalogo.js',
  './js/screens/detalle.js',
  './js/screens/crear-publicacion.js',
  './js/screens/trueques.js',
  './js/screens/chat.js',
  './js/screens/perfil.js',
  './js/screens/voluntariado.js',
  './js/screens/qr.js',
  './js/screens/contacto.js',
  './js/screens/accesibilidad.js',
  './js/screens/registro-institucion.js',
  './js/screens/admin/dashboard.js',
  './js/screens/admin/moderacion.js',
  './js/screens/admin/reportes.js',
  './js/screens/admin/bloqueados.js',
  './js/screens/admin/contacto-admin.js',
  './js/screens/admin/sugerencias.js',
  './icons/favicon.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_ESTATICO);
      // Se agrega archivo por archivo: si uno falta, el resto igual se guarda.
      await Promise.all(
        ARMAZON.map(async (ruta) => {
          try {
            const respuesta = await fetch(new Request(ruta, { cache: 'reload' }));
            if (respuesta.ok) await cache.put(ruta, respuesta);
          } catch (e) {
            /* Sin conexión durante la instalación: se completará al usar la app. */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter((clave) => !clave.startsWith(VERSION))
          .map((clave) => caches.delete(clave))
      );
      await self.clients.claim();
    })()
  );
});

function esApiOImagen(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/uploads/')
  );
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (esApiOImagen(url)) return;

  // Navegación (recarga, abrir desde el icono): red primero y, si falla,
  // el index guardado. El router trabaja con el hash, así que alcanza.
  if (req.mode === 'navigate') {
    const fueraDelScope =
      url.pathname !== '/app' && !url.pathname.startsWith(SCOPE);
    if (fueraDelScope && SCOPE !== '/') return;

    evento.respondWith(
      (async () => {
        try {
          const respuesta = await fetch(req);
          if (respuesta.ok) {
            const cache = await caches.open(CACHE_NAVEGACION);
            cache.put(req, respuesta.clone());
          }
          return respuesta;
        } catch (e) {
          const cacheNavegacion = await caches.open(CACHE_NAVEGACION);
          const guardada = await cacheNavegacion.match(req);
          return (
            guardada ||
            (await caches.match('./index.html')) ||
            new Response(
              '<!doctype html><meta charset="utf-8"><title>Switch sin conexión</title><body style="font-family:system-ui;background:#F0FDF4;color:#0F172A;padding:2rem"><h1>Sin conexión</h1><p>Volvé a abrir Switch cuando tengas internet.</p></body>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
        }
      })()
    );
    return;
  }

  // Estáticos: red primero (para que los cambios se vean al instante);
  // si no hay conexión, se responde con lo guardado.
  evento.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_ESTATICO);
      try {
        const respuesta = await fetch(req);
        if (respuesta.ok) cache.put(req, respuesta.clone());
        return respuesta;
      } catch (e) {
        const guardada = await cache.match(req);
        return guardada || Response.error();
      }
    })()
  );
});
