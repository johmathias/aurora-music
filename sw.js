/* ZERO OS service worker — makes the app open instantly and work offline.
   Strategy: cache the app files on install; load from the network first (always fresh), use the saved copy when offline.
   Supabase / network API calls are never cached. Bump VERSION when you change files. */
const VERSION = 'zero-os-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'config/config.js', 'css/styles.css',
  'js/icons.js', 'js/core.js', 'js/ui.js', 'js/logic.js', 'js/sync.js', 'js/reminders.js', 'js/push.js', 'js/motivation.js', 'js/app.js',
  'js/vendor/chart.umd.min.js', 'js/vendor/supabase.js',
  'js/views/common.js', 'js/views/habits.js', 'js/views/schedule.js', 'js/views/plans.js', 'js/views/money.js',
  'js/views/progress.js', 'js/views/journal.js', 'js/views/home.js', 'js/views/settings.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/favicon-32.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;       // let Supabase etc. go straight to the network
  // Network first (so updates and config changes show up straight away); fall back to the saved copy when offline or slow.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([
        fetch(req, { cache: 'no-cache' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))
      ]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (_) {
      const hit = await caches.match(req, { ignoreSearch: true });
      return hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    }
  })());
});
// Push alerts sent by the server (works even when the app is closed).
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ZERO OS', {
    body: d.body || '', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', tag: d.key || undefined
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => { for (const c of list) if ('focus' in c) return c.focus(); return clients.openWindow('./index.html#/home'); }));
});
