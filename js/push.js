/* ZERO OS — push notifications that arrive even when the app is closed.
   How it works:
   1. You tap "Turn on" in Settings. Your phone gives the app a private delivery address (a push subscription).
   2. The app saves the address and a list of your upcoming alerts (next 14 days) in your Supabase account.
   3. A scheduled Supabase function checks every minute and sends the alerts that are due.
   Honest limit: the list is refreshed whenever you open the app or change something, so an alert for something
   scheduled more than 14 days after your last visit will not exist yet. Needs internet, a signed-in account, and
   (on iPhone) the app added to the Home Screen. */
(function () {
  'use strict';
  var Z = window.Z, S = Z.store;
  var P = Z.push = {};
  var HORIZON = 14, timer = 0, running = false, again = false;

  P.supported = function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && /^https?:$/.test(location.protocol); };
  P.configured = function () { return !!Z.cfg.VAPID_PUBLIC_KEY; };
  P.enabled = function () { return !!Z.meta.get('pushOn', false) && P.supported() && Notification.permission === 'granted'; };
  // Why can't push be used right now? Returns plain-English text, or '' when it can.
  P.blocker = function () {
    if (!Z.sync.configured()) return 'Needs cloud sync first (see README, step 3).';
    if (!P.configured()) return 'Not set up yet — add your push key (README, step 4).';
    if (!Z.sync.user()) return 'Sign in first (Cloud sync above).';
    if (!P.supported()) return Z.reminders.isIOS() && !Z.reminders.isStandalone() ? 'On iPhone, add ZERO OS to your Home Screen first, then open it from there.' : 'This browser does not support push notifications.';
    if (Notification.permission === 'denied') return 'Notifications are blocked. Allow them for this app in your phone settings.';
    return '';
  };

  function key64(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }

  // The alerts we want the server to send: next 14 days, only the future ones.
  P.buildQueue = function () {
    var out = {}, count = 0, t = Z.today(), floor = Date.now() + 20000;
    for (var i = 0; i < HORIZON && count < 400; i++) {
      var date = Z.addDays(t, i);
      Z.reminders.forDate(date).forEach(function (r) {
        var mins = Z.clamp(r.at, 0, 1439), fire = new Date(date + 'T' + Z.tm(mins) + ':00+03:00');   // Dar es Salaam is UTC+3 all year
        if (isNaN(fire) || fire.getTime() <= floor) return;
        var k = r.key + '@' + Z.tm(mins).replace(':', '');
        out[k] = { key: k, fire_at: fire.toISOString(), title: String(r.title || 'ZERO OS').slice(0, 120), body: String(r.body || '').slice(0, 160) }; count++;
      });
    }
    return out;
  };

  // Make the server's list match the app's list (add new, change edited, remove finished or deleted).
  P.sync = function () {
    var c = Z.sync.client(), u = Z.sync.user();
    if (!c || !u || !P.enabled() || !navigator.onLine) return Promise.resolve();
    if (running) { again = true; return Promise.resolve(); }
    running = true;
    var want = P.buildQueue();
    return Promise.resolve().then(function () { return c.from('push_queue').select('key,fire_at,title,body').is('sent_at', null).gt('fire_at', new Date().toISOString()).limit(1000).then(function (r) {
      if (r.error) throw r.error;
      var have = {}; (r.data || []).forEach(function (x) { have[x.key] = x; });
      var up = [], del = [];
      Object.keys(want).forEach(function (k) { var w = want[k], h = have[k]; if (!h || h.title !== w.title || h.body !== w.body) up.push({ user_id: u.id, key: k, fire_at: w.fire_at, title: w.title, body: w.body }); });
      Object.keys(have).forEach(function (k) { if (!want[k] && k.indexOf('test:') !== 0) del.push(k); });
      var chain = Promise.resolve();
      if (up.length) chain = chain.then(function () { return c.from('push_queue').upsert(up, { onConflict: 'user_id,key' }).then(function (x) { if (x.error) throw x.error; }); });
      if (del.length) chain = chain.then(function () { return c.from('push_queue').delete().eq('user_id', u.id).in('key', del).then(function (x) { if (x.error) throw x.error; }); });
      return chain;
    }); }).catch(function (e) { console.warn('push queue sync failed', e); }).then(function () { running = false; if (again) { again = false; P.schedule(2000); } });
  };
  P.schedule = function (ms) { clearTimeout(timer); timer = setTimeout(P.sync, ms == null ? 4000 : ms); };

  P.enable = function () {
    var why = P.blocker(); if (why) return Promise.reject(new Error(why));
    var c = Z.sync.client(), u = Z.sync.user();
    return Promise.resolve(Notification.requestPermission()).then(function (perm) {
      if (perm !== 'granted') throw new Error('Notifications were not allowed.');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) { return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key64(Z.cfg.VAPID_PUBLIC_KEY) }); });
    }).then(function (sub) {
      var j = sub.toJSON();
      return c.from('push_subscriptions').upsert({ user_id: u.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: String(navigator.userAgent).slice(0, 200) }, { onConflict: 'user_id,endpoint' }).then(function (r) { if (r.error) throw r.error; });
    }).then(function () { Z.meta.set('pushOn', true); return P.sync(); });
  };

  // quiet = true when signing out (no error if offline)
  P.disable = function (quiet) {
    var c = Z.sync.client(), u = Z.sync.user();
    Z.meta.set('pushOn', false);
    if (!P.supported()) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      var ep = sub && sub.endpoint, tasks = [];
      if (sub) tasks.push(sub.unsubscribe());
      if (c && u) {
        if (ep) tasks.push(c.from('push_subscriptions').delete().eq('user_id', u.id).eq('endpoint', ep));
        tasks.push(c.from('push_queue').delete().eq('user_id', u.id).is('sent_at', null));
      }
      return Promise.all(tasks);
    }).catch(function (e) { if (!quiet) throw e; });
  };

  // Ask the server to send a test alert (arrives within about a minute).
  P.test = function () {
    var c = Z.sync.client(), u = Z.sync.user(); if (!c || !u) return Promise.reject(new Error('Sign in first.'));
    return c.from('push_queue').insert({ user_id: u.id, key: 'test:' + Date.now(), fire_at: new Date().toISOString(), title: 'ZERO OS', body: 'Push notifications are working.' }).then(function (r) { if (r.error) throw r.error; });
  };

  // keep the server list fresh
  S.onChange(function () { if (P.enabled()) P.schedule(5000); });
  document.addEventListener('zero:login', function () { P.schedule(3000); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && P.enabled()) P.schedule(2500); });
  setTimeout(function () { if (P.enabled()) P.schedule(0); }, 4000);
})();
