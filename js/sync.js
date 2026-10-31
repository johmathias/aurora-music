/* ZERO OS — cloud sync (Supabase) with offline queue.
   Strategy: every change is saved locally first (IndexedDB) and queued. When online + signed in,
   the queue is pushed to one table (public.zero_records) protected by Row Level Security.
   Conflicts: newest edit wins, but the losing copy is ALWAYS kept in a "conflicts" list (Settings → Sync)
   so nothing is silently discarded. If the cloud is not configured the app works fully offline. */
(function () {
  'use strict';
  var Z = window.Z, S = Z.store;
  var Y = Z.sync = {};
  var client = null, user = null, state = 'local', lastError = '', running = false, again = false, timer = 0, subs = [], lastSyncAt = 0;

  Y.configured = function () { return !!(Z.cfg.SUPABASE_URL && Z.cfg.SUPABASE_ANON_KEY && window.supabase); };
  Y.user = function () { return user; };
  Y.client = function () { return client; };
  Y.state = function () { return state; };
  Y.error = function () { return lastError; };
  Y.lastSyncAt = function () { return lastSyncAt; };
  // plain-English checks of the cloud set-up (used by Settings → Check connection)
  Y.diagnose = function () {
    var out = [], url = (Z.cfg.SUPABASE_URL || ''), key = (Z.cfg.SUPABASE_ANON_KEY || '');
    function add(ok, title, fix) { out.push({ ok: ok, title: title, fix: fix || '' }); }
    add(!!window.ZERO_CONFIG, 'config.js was found', 'The file config/config.js did not load. Upload it to GitHub (folder "config") and refresh.');
    add(!!url, 'Project URL is filled in', 'Open config/config.js on GitHub and paste your Project URL between the quotes after SUPABASE_URL.');
    if (url) add(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url), 'Project URL looks right', 'It should look like https://abcdxyz.supabase.co — no spaces, no /rest/v1 at the end.');
    add(!!key, 'Public key is filled in', 'Paste the anon / publishable key after SUPABASE_ANON_KEY in config/config.js.');
    if (key) {
      var secret = /^sb_secret_/.test(key), role = '';
      try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role || ''; } catch (e) { }
      add(!secret && role !== 'service_role', 'It is the PUBLIC key (not the secret one)', 'You pasted a SECRET key. Remove it from config.js and from GitHub right away, then paste the anon / publishable key instead.');
      add(/^(eyJ|sb_publishable_)/.test(key) && key.length > 30 && !/\s/.test(key), 'Key has the right shape', 'The key should start with eyJ or sb_publishable_ with no spaces or line breaks. Copy it again from Supabase → Project Settings → API.');
    }
    add(!!window.supabase, 'Supabase library loaded', 'js/vendor/supabase.js did not load. Make sure the whole js/vendor folder is on GitHub.');
    return out;
  };
  Y.ping = function () {
    var url = (Z.cfg.SUPABASE_URL || '').replace(/\/$/, ''), key = Z.cfg.SUPABASE_ANON_KEY || '';
    if (!url || !key) return Promise.resolve({ ok: false, text: 'Not set up yet.' });
    if (!navigator.onLine) return Promise.resolve({ ok: false, text: 'This phone has no internet right now.' });
    return fetch(url + '/auth/v1/settings', { headers: { apikey: key } }).then(function (r) {
      if (r.ok) return { ok: true, text: 'Supabase answered — the URL and key work.' };
      if (r.status === 401 || r.status === 403) return { ok: false, text: 'Supabase refused the key (error ' + r.status + '). Copy the anon / publishable key again.' };
      return { ok: false, text: 'Supabase answered with error ' + r.status + '. Check the Project URL.' };
    }).catch(function () { return { ok: false, text: 'Could not reach that address. The Project URL is probably mistyped.' }; });
  };
  Y.onState = function (fn) { subs.push(fn); };
  function set(s, err) { state = s; lastError = err || ''; subs.forEach(function (f) { try { f(s); } catch (e) { } }); }
  Y.refreshState = function () {
    if (!Y.configured()) return set('local'); if (!user) return set('signedout');
    if (!navigator.onLine) return set('offline'); if (running) return set('syncing'); set(lastError ? 'error' : 'synced', lastError);
  };

  Y.init = function () {
    return new Promise(function (resolve) {
      if (!Y.configured()) { set('local'); return resolve(); }
      try {
        client = window.supabase.createClient(Z.cfg.SUPABASE_URL, Z.cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'zero.session' } });
      } catch (e) { set('error', 'Could not start cloud sync: ' + e.message); return resolve(); }
      client.auth.getSession().then(function (r) {
        user = r.data && r.data.session ? r.data.session.user : null;
        Y.refreshState(); resolve(); if (user) Y.schedule(500);
      }).catch(function () { Y.refreshState(); resolve(); });
      client.auth.onAuthStateChange(function (ev, session) {
        var u = session ? session.user : null;
        if (ev === 'SIGNED_IN' && u && (!user || user.id !== u.id)) { user = u; Y.onLogin(); }
        if (ev === 'SIGNED_OUT') { user = null; Y.refreshState(); }
      });
      window.addEventListener('online', function () { Y.refreshState(); Y.schedule(600); });
      window.addEventListener('offline', function () { Y.refreshState(); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && user) Y.schedule(800); });
      setInterval(function () { if (document.visibilityState === 'visible' && user && navigator.onLine) Y.schedule(0); }, 60000);
      S.onChange(function (c) { if (user) Y.schedule(2500); });
    });
  };

  function friendly(err) {
    var m = (err && err.message) || String(err || ''), l = m.toLowerCase();
    if (l.indexOf('invalid login') > -1) return 'Email or password is not correct.';
    if (l.indexOf('already registered') > -1 || l.indexOf('already been registered') > -1) return 'This email already has an account. Try signing in.';
    if (l.indexOf('email not confirmed') > -1) return 'Please confirm your email first — check your inbox for the link, then sign in.';
    if (l.indexOf('password') > -1 && l.indexOf('least') > -1) return 'Password is too short — use at least 8 characters.';
    if (l.indexOf('failed to fetch') > -1 || l.indexOf('network') > -1) return 'No internet connection. Sign-in needs internet.';
    if (l.indexOf('rate') > -1 && l.indexOf('limit') > -1) return 'Too many attempts. Please wait a minute and try again.';
    return m || 'Something went wrong. Please try again.';
  }
  Y.signUp = function (email, pass) {
    if (!client) return Promise.reject(new Error('Cloud is not configured.'));
    return client.auth.signUp({ email: email, password: pass }).then(function (r) {
      if (r.error) throw new Error(friendly(r.error));
      if (!r.data.session) return { confirm: true };
      return { confirm: false };
    });
  };
  Y.signIn = function (email, pass) {
    if (!client) return Promise.reject(new Error('Cloud is not configured.'));
    return client.auth.signInWithPassword({ email: email, password: pass }).then(function (r) { if (r.error) throw new Error(friendly(r.error)); });
  };
  Y.resetPassword = function (email) {
    return client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function (r) { if (r.error) throw new Error(friendly(r.error)); });
  };
  Y.signOut = function () { if (!client) return Promise.resolve(); return client.auth.signOut().then(function () { user = null; Y.refreshState(); }); };

  // first login on this device: queue everything for upload; if the device held another account's data, back it up first
  Y.onLogin = function () {
    var prev = Z.meta.get('syncUser', null);
    var go = function () {
      Z.meta.set('syncUser', user.id);
      if (!prev) S.queueAll();      // first login on this device: upload everything already stored here (timestamps untouched)
      Z.meta.set('lastPull', ''); Y.refreshState(); Y.schedule(100);
      document.dispatchEvent(new CustomEvent('zero:login'));
    };
    if (prev && prev !== user.id && Z.logic.hasAnyData()) {
      Z.download('zero-os-backup-before-switch-' + Z.today() + '.json', JSON.stringify(S.dump(), null, 2), 'application/json');
      Z.COLS.forEach(function (c) { S.all(c).forEach(function (o) { S.del(c, o.id); }); });
      S.pending().then(function (p) { p.forEach(function (x) { S.clearPending(x.key); }); go(); });
      Z.ui.toast('Another account was used here. A backup file was saved first.', 'info');
    } else go();
  };

  Y.schedule = function (ms) { clearTimeout(timer); timer = setTimeout(Y.syncNow, ms == null ? 1500 : ms); };

  var CHUNK = 150;
  Y.syncNow = function () {
    if (!client || !user || !navigator.onLine) { Y.refreshState(); return Promise.resolve(); }
    if (running) { again = true; return Promise.resolve(); }
    running = true; again = false; set('syncing');
    return pull().then(push).then(function () {
      lastError = ''; lastSyncAt = Date.now(); Z.meta.set('lastSyncAt', lastSyncAt);
    }).catch(function (e) {
      console.warn('sync failed', e);
      lastError = friendly(e) || 'Sync failed'; if (/jwt|token|expired/i.test(String(e && e.message))) lastError = 'Your session expired. Please sign in again.';
    }).then(function () {
      running = false; Y.refreshState();
      if (again) Y.schedule(800); else if (lastError && navigator.onLine) Y.schedule(45000);   // gentle retry
    });
  };

  function pending() { return S.pending(); }

  function pull() {
    var since = Z.meta.get('lastPull', ''), maxSeen = since;
    return pending().then(function (pend) {
      var pk = {}; pend.forEach(function (p) { pk[p.key] = 1; });
      function page(from) {
        var q = client.from('zero_records').select('col,id,data,synced_at').order('synced_at', { ascending: true }).range(from, from + 999);
        if (since) q = q.gt('synced_at', since);
        return q.then(function (r) {
          if (r.error) throw r.error;
          var rows = r.data || [];
          S.batch(function () { rows.forEach(function (row) { apply(row, pk); if (row.synced_at > maxSeen) maxSeen = row.synced_at; }); });
          if (rows.length === 1000) return page(from + 1000);
        });
      }
      return page(0);
    }).then(function () { if (maxSeen) Z.meta.set('lastPull', maxSeen); });
  }
  function apply(row, pk) {
    if (Z.COLS.indexOf(row.col) < 0) return;
    var remote = row.data || {}; remote.id = row.id;
    var local = S.raw(row.col, row.id), key = row.col + ':' + row.id;
    var rt = remote.updatedAt || 0, lt = local ? (local.updatedAt || 0) : -1;
    if (!local) { S.putRemote(row.col, remote); return; }
    if (rt === lt) { S.clearPending(key); return; }
    if (pk[key]) {                                    // both sides changed → keep newest, stash the other
      keepConflict(row.col, row.id, rt > lt ? local : remote, rt > lt ? 'local' : 'cloud');
      if (rt > lt) { S.putRemote(row.col, remote); S.clearPending(key); }
      return;
    }
    if (rt > lt) S.putRemote(row.col, remote);
  }
  function keepConflict(col, id, losing, side) {
    if (losing && losing.deleted) return;
    var list = Z.meta.get('conflicts', []).slice(); list.push({ col: col, id: id, side: side, at: Date.now(), data: losing });
    Z.meta.set('conflicts', list.slice(-100));
  }
  Y.conflicts = function () { return Z.meta.get('conflicts', []); };
  Y.dismissConflict = function (i) { var l = Y.conflicts().slice(); l.splice(i, 1); Z.meta.set('conflicts', l); };
  Y.restoreConflict = function (i) {
    var c = Y.conflicts()[i]; if (!c) return; var d = Object.assign({}, c.data); delete d.deleted; S.put(c.col, d); Y.dismissConflict(i);
  };

  function push() {
    return pending().then(function (pend) {
      if (!pend.length) return;
      var rows = [], keys = [];
      pend.forEach(function (p) {
        var rec = S.raw(p.col, p.id); if (!rec) { S.clearPending(p.key); return; }
        rows.push({ user_id: user.id, col: p.col, id: p.id, data: rec, deleted: !!rec.deleted, rec_updated: rec.updatedAt || 0 }); keys.push(p.key);
      });
      var chain = Promise.resolve();
      for (var i = 0; i < rows.length; i += CHUNK) (function (a) {
        chain = chain.then(function () {
          return client.from('zero_records').upsert(rows.slice(a, a + CHUNK), { onConflict: 'user_id,col,id' }).then(function (r) {
            if (r.error) throw r.error;
            // only clear entries that were not edited again while we were uploading
            keys.slice(a, a + CHUNK).forEach(function (k, j) { var row = rows[a + j], cur = S.raw(row.col, row.id); if (cur && (cur.updatedAt || 0) === row.rec_updated) S.clearPending(k); });
          });
        });
      })(i);
      return chain;
    });
  }

  Y.pendingCount = function () { return pending().then(function (p) { return p.length; }); };
  Y.deleteCloudData = function () {
    if (!client || !user) return Promise.reject(new Error('Sign in first.'));
    return client.from('zero_records').delete().eq('user_id', user.id).then(function (r) { if (r.error) throw r.error; });
  };
})();
