/* ZERO OS — app shell: router, navigation, global actions, lock screen, start-up */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store;

  var TABS = [
    { id: 'home', label: 'Home', icon: 'house' }, { id: 'habits', label: 'Habits', icon: 'flame' }, { id: 'schedule', label: 'Schedule', icon: 'calendar' },
    { id: 'plans', label: 'Plans', icon: 'target' }, { id: 'money', label: 'Money', icon: 'wallet' }, { id: 'progress', label: 'Progress', icon: 'activity' }
  ];
  var current = null, rootEl, tabbar, fab, lastIdx = 0, rerenderTimer = 0;
  Z.current = function () { return current; };

  /* ---------- shared header ---------- */
  Z.hd = function (o) {
    return '<header class="hd rz" style="--n:0"><div class="grow">' + (o.eyebrow ? '<div class="eyebrow">' + Z.esc(o.eyebrow) + '</div>' : '') +
      '<h1>' + Z.esc(o.title) + '</h1>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + '</div><div class="acts">' + (o.acts || '') +
      (o.noGear ? '' : '<button class="iconbtn glass" data-act="go" data-arg="settings" aria-label="Settings">' + ic('settings') + '</button>') + '</div></header>';
  };
  Z.rz = function (n) { return 'rz" style="--n:' + n; };   // usage: class="card <%= Z.rz(2) %>"  →  class="card rz" style="--n:2"

  /* ---------- navigation ---------- */
  function buildShell() {
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="atmos" aria-hidden="true"><i></i><i></i><i></i></div><div class="topfade" aria-hidden="true"></div>' +
      '<main id="app"><div id="view"></div></main>' +
      '<nav class="tabbar glass" id="tabbar" aria-label="Main"><div class="ind"></div>' +
      TABS.map(function (t) { return '<a href="#/' + t.id + '" data-tab="' + t.id + '" aria-label="' + t.label + '">' + ic(t.icon) + '<span>' + t.label + '</span></a>'; }).join('') + '</nav>' +
      '<button class="fab" id="fab" aria-label="Add">' + ic('plus') + '</button><div class="toasts" id="toasts" aria-live="polite"></div>');
    rootEl = Z.$('#view'); tabbar = Z.$('#tabbar'); fab = Z.$('#fab');
    fab.addEventListener('click', function () { var v = Z.views[current]; if (v && v.fab) v.fab(fab); });
  }
  Z.go = function (name) { if (location.hash === '#/' + name) render(name, true); else location.hash = '#/' + name; };
  function routeName() { var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0]; return Z.views[h] ? h : 'home'; }

  function render(name, entering, keepScroll) {
    var v = Z.views[name]; if (!v) return;
    var y = window.scrollY, same = name === current;
    Z.entering = entering !== false;
    U.destroyCharts(); U.closeMenu();
    var idx = TABS.findIndex(function (t) { return t.id === name; });
    var back = idx >= 0 && idx < lastIdx;
    current = name; document.body.dataset.area = v.area || name;
    var html = '';
    try { html = v.render(); } catch (e) { console.error(e); html = '<div class="card"><h3>Something went wrong</h3><p class="muted">' + Z.esc(e.message) + '</p></div>'; }
    rootEl.innerHTML = '<div class="view' + (Z.entering ? ' enter entering' + (back ? ' back' : '') : '') + '" data-view="' + name + '">' + html + '</div>';
    if (v.mount) { try { v.mount(rootEl); } catch (e) { console.error(e); } }
    U.animate(rootEl);
    Z.$$('#tabbar a').forEach(function (a) { var on = a.dataset.tab === name; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (idx >= 0) { tabbar.style.setProperty('--i', idx); lastIdx = idx; }
    tabbar.classList.toggle('noind', idx < 0);
    var f = v.fab ? (v.fabIcon || 'plus') : null;
    fab.classList.toggle('hide', !f); if (f) fab.innerHTML = ic(f);
    if (Z.entering && !same) window.scrollTo(0, 0); else if (!Z.entering || keepScroll) window.scrollTo(0, y);
    Z.badges();
    document.title = (name === 'home' ? '' : (v.title || name) + ' · ') + 'ZERO OS';
  }
  // small red numbers / dots on tabs for things that need a look
  Z.badges = function () {
    var list = []; try { list = Z.logic.attention(); } catch (e) { }
    var by = {}; list.forEach(function (x) { by[x.tab] = (by[x.tab] || 0) + (x.count || 1); });
    Z.$$('#tabbar a').forEach(function (el) {
      var n = by[el.dataset.tab] || 0, b = Z.$('.nb', el);
      if (!n || el.dataset.tab === current) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('b'); b.className = 'nb'; el.appendChild(b); }
      b.textContent = n > 9 ? '9+' : n; b.classList.toggle('dot', false);
    });
  };
  Z.refresh = function (enter) { render(current, enter === true, true); };
  function onRoute() { U.closeTopSheet(); render(routeName(), true); }

  // re-render the visible screen when data changes (debounced, skipped while the user is typing in a view that opts out)
  S.onChange(function (cols) {
    var v = Z.views[current]; if (!v) return;
    if (v.onChange && v.onChange(cols) === false) return;
    clearTimeout(rerenderTimer); rerenderTimer = setTimeout(function () { render(current, false, true); }, 30);
  });
  document.addEventListener('zero:tick', function () { Z.badges(); });
  document.addEventListener('zero:tick', function () { if (current === 'home' || current === 'schedule') { var v = Z.views[current]; if (!v.onTick || v.onTick() !== false) Z.refresh(); } });
  document.addEventListener('zero:login', function () { Z.refresh(); });
  Z.sync.onState(function () { var el = Z.$('[data-syncpill]'); if (el) el.outerHTML = Z.syncPill(); });
  Z.syncPill = function () {
    var s = Z.sync.state(), map = { local: ['', 'Offline mode'], signedout: ['', 'Not signed in'], offline: ['off', 'Offline'], syncing: ['sync', 'Syncing'], synced: ['ok', 'Synced'], error: ['bad', 'Sync issue'] }[s] || ['', ''];
    return '<button class="statuspill ' + map[0] + '" data-syncpill data-act="go" data-arg="settings" aria-label="Sync status: ' + map[1] + '"><i></i>' + map[1] + '</button>';
  };

  /* ---------- global click delegation ---------- */
  Z.actions.go = function (el) { Z.go(el.dataset.arg); };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var fn = Z.actions[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  });

  /* ---------- lock screen (optional PIN, stays on this device) ---------- */
  function sha(s) {
    if (window.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', new TextEncoder().encode('zero-os:' + s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
    var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return Promise.resolve('x' + h);
  }
  Z.hashPin = sha;
  function lockScreen(hash) {
    return new Promise(function (resolve) {
      var el = document.createElement('div'); el.className = 'lock';
      var entered = '';
      el.innerHTML = '<div style="text-align:center"><div style="color:var(--acc)">' + ic('lock') + '</div><h2 style="font-size:24px;font-weight:720;margin-top:10px">Enter passcode</h2><div class="small dim" style="margin-top:4px">ZERO OS is private to you</div></div>' +
        '<div class="pindots"><i></i><i></i><i></i><i></i></div><div class="pin">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button data-n="' + n + '">' + n + '</button>'; }).join('') +
        '<button class="blank"></button><button data-n="0">0</button><button data-back aria-label="Delete">' + ic('arrow-left') + '</button></div>';
      document.body.appendChild(el);
      var dots = Z.$$('.pindots i', el), box = Z.$('.pindots', el);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.back !== undefined) entered = entered.slice(0, -1); else if (b.dataset.n && entered.length < 4) entered += b.dataset.n;
        dots.forEach(function (d, i) { d.classList.toggle('on', i < entered.length); });
        if (entered.length === 4) sha(entered).then(function (h) {
          if (h === hash) { el.classList.add('out'); setTimeout(function () { el.remove(); }, 600); resolve(); }
          else { box.classList.add('bad'); if (navigator.vibrate) try { navigator.vibrate(80); } catch (x) { } setTimeout(function () { box.classList.remove('bad'); entered = ''; dots.forEach(function (d) { d.classList.remove('on'); }); }, 450); }
        });
      });
    });
  }

  /* ---------- behave like an app: no pinch-zoom, no double-tap zoom ---------- */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  var lastTap = 0; document.addEventListener('touchend', function (e) { var t = Date.now(); if (t - lastTap < 320 && !(e.target.closest && e.target.closest('input,textarea,select'))) e.preventDefault(); lastTap = t; }, { passive: false });

  /* ---------- first-run welcome ---------- */
  function welcome() {
    var st = Z.settings(); if (st.name || Z.meta.get('welcomed')) return;
    U.sheet({
      title: 'Welcome to ZERO OS',
      body: '<form class="form" id="wf"><p class="muted">Your private life system — habits, time, plans and money in one place. Everything is saved on this device first, so it works offline.</p>' +
        U.field('What should I call you?', U.input('wname', 'Joh', { ph: 'Your name', max: 30, autofocus: true }), 'wname') +
        U.footer({ save: 'Start from zero' }) + '</form>',
      onMount: function (root, api) {
        Z.$('#wf', root).addEventListener('submit', function (e) { e.preventDefault(); var n = U.val(root, 'wname'); Z.setSettings({ name: n || 'there' }); Z.meta.set('welcomed', 1); api.close(); U.toast('Welcome, ' + (n || 'friend')); });
      },
      onClose: function () { Z.meta.set('welcomed', 1); }
    });
  }

  /* ---------- start-up ---------- */
  function hideSplash(min) {
    var sp = Z.$('#splash'); if (!sp) return;
    setTimeout(function () { sp.classList.add('out'); setTimeout(function () { sp.remove(); }, 900); }, min);
  }
  function boot() {
    var seen = false; try { seen = sessionStorage.getItem('zero.splash') === '1'; sessionStorage.setItem('zero.splash', '1'); } catch (e) { }
    var started = performance.now();
    S.init().then(function () {
      buildShell();
      if (Z.reduced) document.body.classList.add('reduced');
      window.addEventListener('hashchange', onRoute);
      var hash = Z.meta.get('pinHash', '');
      var after = function () {
        render(routeName(), true);
        Z.reminders.start();
        Z.sync.init().then(function () { if (Z.current() === 'home') Z.refresh(); });
        var wait = Math.max(0, (seen || Z.reduced ? 350 : 2100) - (performance.now() - started));
        hideSplash(wait); setTimeout(welcome, wait + 600);
      };
      if (hash) { hideSplash(300); lockScreen(hash).then(after); } else after();
    }).catch(function (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:#fff;padding:20px;position:relative;z-index:999">ZERO OS could not start: ' + Z.esc(e.message) + '</pre>'); });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('sw failed', e); }); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
