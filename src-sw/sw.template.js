/* Aurora Music service worker.
 * Job: keep the APP (screens, code, icons) available offline.
 * It never touches your music - songs are stored in IndexedDB by the app itself. */
const VERSION = '__VERSION__';
const CACHE = 'aurora-shell-' + VERSION;
const PRECACHE = __PRECACHE__;
const scope = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(new URL(url, scope).href, { cache: 'reload' }))),
    ),
  );
  // No skipWaiting on purpose: a new version waits until the app is fully closed,
  // so a song never gets interrupted by an update.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('aurora-shell-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const shell = await cache.match(new URL('./index.html', scope).href);
        if (shell) return shell; // app shell first: works with no internet
        try {
          return await fetch(request);
        } catch {
          return (await cache.match(new URL('./offline.html', scope).href)) || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })(),
  );
});
