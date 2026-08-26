// sw.js — Service Worker de Motiv Producción.
//
// Estrategia deliberadamente simple: cachea el "app shell" (HTML, JS,
// CSS, iconos) para que la app abra aunque no haya red, pero NUNCA
// cachea llamadas a Supabase, Cloudinary ni ninguna API externa — los
// datos de producción tienen que ser siempre los reales, cachear una
// respuesta vieja de la base de datos sería activamente peligroso
// (puntos, partes, turnos desactualizados mostrados como si fueran
// actuales). Esto da "abre aunque no haya cobertura en la fábrica",
// no "funciona sin conexión de verdad" — la app sigue necesitando red
// para cualquier lectura/escritura real.
//
// Sube este número cada vez que cambies este archivo, para forzar a
// los dispositivos ya instalados a limpiar la caché vieja.
const VERSION = "v2";
const CACHE_NAME = `motiv-shell-${VERSION}`;

// Dominios que NUNCA se interceptan ni se cachean — todo lo que no sea
// el propio origen de la app pasa directo a la red.
function esPeticionPropia(url) {
  return url.origin === self.location.origin;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith("motiv-shell-") && nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET, y solo peticiones al propio origen — Supabase, Cloudinary
  // y cualquier otra API quedan completamente fuera de este service
  // worker, se comportan exactamente igual que sin él.
  if (req.method !== "GET" || !esPeticionPropia(url)) {
    return;
  }

  // Navegación (cargar la app / recargar página): red primero, para
  // tener siempre la versión desplegada más reciente; si no hay red,
  // cae al index.html cacheado — así la app ABRE aunque no haya
  // cobertura, aunque luego no pueda cargar datos reales.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/index.html"))),
    );
    return;
  }

  // Assets estáticos (JS/CSS/imágenes/fuentes propios del build):
  // cache-first — si ya está en caché se sirve al instante, y de paso
  // se refresca en segundo plano para la próxima vez.
  if (["script", "style", "image", "font"].includes(req.destination)) {
    event.respondWith(
      caches.match(req).then((cacheado) => {
        const redFetch = fetch(req)
          .then((res) => {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
            return res;
          })
          .catch(() => cacheado);
        return cacheado || redFetch;
      }),
    );
  }
});
