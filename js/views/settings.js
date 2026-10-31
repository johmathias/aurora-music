/* ZERO OS — Settings: profile, cloud account, sync, reminders, security, data export/import */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc, F = Z.forms;
  var pendingCount = 0;

  function row(icon, title, sub, right, act, arg) {
    return '<' + (act ? 'button data-act="' + act + '"' + (arg ? ' data-arg="' + arg + '"' : '') : 'div') + ' class="item' + (act ? ' tap' : '') + '"><span class="avatar" style="--c:var(--acc)">' + ic(icon) + '</span><div class="grow"><div class="ti">' + title + '</div>' + (sub ? '<div class="su">' + sub + '</div>' : '') + '</div>' + (right || (act ? ic('chevron-right') : '')) + '</' + (act ? 'button' : 'div') + '>';
  }
  function ago(ts) { if (!ts) return 'never'; var m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Z.fmt(Z.ds(new Date(ts))); }

  function cloudCard() {
    var Y = Z.sync, u = Y.user(), st = Y.state();
    if (!Y.configured()) return '<section class="card rz" style="--n:2"><div class="head"><div class="label">' + ic('cloud-off') + 'Cloud sync</div><span class="statuspill"><i></i>Offline mode</span></div><p class="muted small" style="margin-bottom:14px">The app can’t see your Supabase keys, so it is saving only on this phone. Tap the button to find out why — it checks each step for you.</p><button class="btn primary block" data-act="stCheck">' + ic('activity') + 'Check connection</button></section>';
    if (!u) return '<section class="card rz" style="--n:2"><div class="head"><div class="label">' + ic('cloud') + 'Cloud sync</div></div><p class="muted small" style="margin-bottom:14px">Sign in to back up and sync across your devices. Needs internet. Your records are private to your account.</p><div class="row" style="gap:10px"><button class="btn primary grow" data-act="stAuth" data-arg="in">Sign in</button><button class="btn grow" data-act="stAuth" data-arg="up">Create account</button></div></section>';
    return '<section class="card rz" style="--n:2"><div class="head"><div class="label">' + ic('cloud') + 'Cloud sync</div>' + Z.syncPill() + '</div>' +
      '<div class="list">' + row('user', esc(u.email || 'Signed in'), 'Signed in · last sync ' + ago(Y.lastSyncAt() || Z.meta.get('lastSyncAt', 0))) +
      row('refresh-cw', 'Sync now', pendingCount ? pendingCount + ' change' + (pendingCount > 1 ? 's' : '') + ' waiting to upload' : 'Everything is up to date', '', 'stSync') +
      (Y.conflicts().length ? row('circle-alert', 'Review sync conflicts', Y.conflicts().length + ' older version' + (Y.conflicts().length > 1 ? 's' : '') + ' kept safe', '<span class="badge" style="--c:var(--warn)">' + Y.conflicts().length + '</span>', 'stConf') : '') + '</div>' +
      (Y.error() ? '<div class="small bad" style="margin-top:10px">' + esc(Y.error()) + '</div>' : '') +
      '<div class="row" style="gap:10px;margin-top:14px"><button class="btn grow" data-act="stCheck">' + ic('activity') + 'Check</button><button class="btn grow" data-act="stOut">' + ic('log-out') + 'Sign out</button></div></section>';
  }

  function pushRow() {
    var why = Z.push.blocker(), on = Z.push.enabled();
    if (why && !on) return row('bell-off', 'Push alerts when the app is closed', esc(why), '');
    if (on) return row('bell', 'Push alerts when the app is closed', 'On — sent from your Supabase account', '<button class="btn sm" data-act="stPushTest">Test</button>') +
      '<div class="item" style="min-height:48px"><div class="grow"></div><button class="btn sm danger" data-act="stPushOff">Turn off</button></div>';
    return row('bell', 'Push alerts when the app is closed', 'Off — tap to turn on', '', 'stPushOn');
  }
  function body() {
    var st = Z.settings(), perm = Z.reminders.permission(), ios = Z.reminders.isIOS(), standalone = Z.reminders.isStandalone();
    var html = '';
    html += '<section class="card rz" style="--n:1"><div class="head"><div class="label">' + ic('user') + 'Profile</div></div><div class="stack">' +
      U.field('Your name', '<input class="input" id="stname" value="' + esc(st.name) + '" maxlength="30" placeholder="Name" autocomplete="off">', 'stname') +
      U.switchRow('showtime', 'Show time on Home', st.showTime, 'Africa/Dar_es_Salaam') +
      U.field('Weekly study target (hours)', '<input class="input" id="sttarget" type="number" inputmode="numeric" min="1" max="100" value="' + (st.studyTargetHours || 10) + '">', 'sttarget') + '</div></section>';
    html += cloudCard();
    html += '<section class="card rz" style="--n:3"><div class="head"><div class="label">' + ic('bell') + 'Reminders</div></div><div class="list">' +
      row(perm === 'granted' ? 'bell' : 'bell-off', 'Notifications', perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Blocked in your browser settings' : perm === 'unsupported' ? 'Not supported in this browser' : 'Tap to allow', perm === 'granted' ? '<button class="btn sm" data-act="stTestN">Test</button>' : '', perm === 'default' ? 'stAskN' : '') +
      '<div class="item"><span class="avatar" style="--c:var(--acc)">' + ic('clock') + '</span><div class="grow"><div class="ti">Event reminder lead time</div></div>' + U.select('stlead', [{ v: 0, label: 'At start' }, { v: 5, label: '5 min' }, { v: 10, label: '10 min' }, { v: 15, label: '15 min' }, { v: 30, label: '30 min' }, { v: 60, label: '1 hour' }], st.reminderLead).replace('class="select"', 'class="select" style="width:auto;min-height:40px"') + '</div>' +
      pushRow() +
      row('calendar-days', 'Export events to Apple Calendar', 'Get real alarms even when the app is closed', '', 'stIcs') + '</div>' +
      '<div class="card flat" style="margin-top:14px;padding:14px"><div class="small" style="font-weight:640;margin-bottom:4px">' + ic('info') + ' Honest limits on iPhone</div><div class="small muted">' + (ios && !standalone ? '<b class="warn">Add ZERO OS to your Home Screen first</b> — iPhone only allows web notifications for installed apps (iOS 16.4+). ' : '') + 'A web app can’t run in the background, so alerts fire while ZERO OS is open or recently used. Anything you missed appears in the <b>Due now</b> card when you open the app. For guaranteed alerts, export events to Apple Calendar.</div></div></section>';
    html += '<section class="card rz" style="--n:4"><div class="head"><div class="label">' + ic('lock') + 'Privacy & security</div></div><div class="list">' +
      row('lock', 'App passcode', Z.meta.get('pinHash', '') ? 'On — asked each time you open the app' : 'Off — a 4-digit code that stays on this device', '', 'stPin') + '</div><p class="xs dim" style="margin-top:10px">The passcode locks the screen on this device. It does not encrypt your data; your cloud records are protected by your account and Row Level Security.</p></section>';
    html += '<section class="card rz" style="--n:5"><div class="head"><div class="label">' + ic('download') + 'Your data</div></div><div class="list">' +
      row('file-text', 'Export everything (JSON)', 'Full backup you can restore later', '', 'stJson') +
      row('wallet', 'Export transactions (CSV)', 'Opens in Excel or Google Sheets', '', 'stCsvTx') +
      row('list-checks', 'Export tasks, habits & journal (CSV)', 'One file per type', '', 'stCsvMore') +
      row('upload', 'Restore from backup', 'Merge or replace from a JSON file', '', 'stRestore') + '</div></section>';
    html += '<section class="card rz" style="--n:6"><div class="head"><div class="label">' + ic('shield') + 'Danger zone</div></div><div class="list">' +
      row('trash-2', 'Delete all data on this device', 'Your cloud copy (if any) is not affected', '', 'stWipe') + (Z.sync.user() ? row('cloud-off', 'Delete my cloud data', 'Removes everything from Supabase', '', 'stWipeCloud') : '') + '</div></section>';
    html += '<section class="card flat rz" style="--n:7;text-align:center"><div style="font-weight:700;letter-spacing:.4em;padding-left:.4em">ZERO OS</div><div class="xs dim" style="margin-top:6px">Version ' + Z.VERSION + ' · ' + (S.isFallback() ? 'Using basic storage' : 'Saved on this device') + '</div><div class="xs dim" style="margin-top:4px">Start from zero. Build everything.</div></section>';
    return html;
  }

  /* ---------- auth sheet ---------- */
  function authSheet(mode) {
    var up = mode === 'up';
    F.sheet({
      title: up ? 'Create your account' : 'Welcome back',
      fields: '<p class="muted" style="margin-top:-4px">' + (up ? 'Your email and a password. You may need to confirm your email.' : 'Sign in to sync your data.') + '</p>' +
        U.field('Email', '<input class="input" id="aemail" type="email" autocomplete="email" inputmode="email" autocapitalize="none" placeholder="you@example.com" data-af>', 'aemail') +
        U.field('Password', '<input class="input" id="apass" type="password" autocomplete="' + (up ? 'new-password' : 'current-password') + '" placeholder="' + (up ? 'At least 8 characters' : 'Your password') + '">', 'apass') +
        (up ? '' : '<button type="button" class="link" id="aforgot" style="align-self:flex-start">Forgot password?</button>') + '<div class="msg bad small" id="aerr" style="display:none"></div>',
      save: up ? 'Create account' : 'Sign in',
      onMount: function (root, api) {
        var f = Z.$('#aforgot', root); if (f) f.addEventListener('click', function () { var e = U.val(root, 'aemail'); if (!e) return U.fail(root, 'aemail', 'Enter your email first.'); Z.sync.resetPassword(e).then(function () { U.toast('Reset link sent — check your email', 'info'); }).catch(function (x) { U.fail(root, 'aemail', x.message); }); });
        var form = Z.$('form', root); form.addEventListener('submit', function (ev) {
          ev.preventDefault(); ev.stopImmediatePropagation(); U.clearErr(root);
          var email = U.val(root, 'aemail'), pass = Z.$('#apass', root).value;
          if (!/^\S+@\S+\.\S+$/.test(email)) return U.fail(root, 'aemail', 'Enter a valid email address.');
          if (pass.length < 8) return U.fail(root, 'apass', 'Use at least 8 characters.');
          if (!navigator.onLine) return U.fail(root, 'aemail', 'You’re offline. Signing in needs internet.');
          var btn = Z.$('button[type=submit]', root); btn.disabled = true; btn.innerHTML = ic('loader-circle') + ' Please wait';
          (up ? Z.sync.signUp(email, pass) : Z.sync.signIn(email, pass)).then(function (r) {
            if (r && r.confirm) { api.close(); U.sheet({ title: 'Check your email', body: '<div class="empty"><div class="orb">' + ic('mail') + '</div><h4>Confirm your email</h4><p>We sent a link to ' + esc(email) + '. Open it, then come back and sign in.</p></div>' }); }
            else { api.close(); U.toast('Signed in'); }
          }).catch(function (x) { btn.disabled = false; btn.textContent = up ? 'Create account' : 'Sign in'; U.fail(root, up ? 'aemail' : 'apass', x.message); });
        }, true);
      },
      onSubmit: function () { return false; }
    });
  }

  function pinSheet() {
    var has = !!Z.meta.get('pinHash', '');
    if (has) return U.choice({ title: 'App passcode', text: 'A passcode is set on this device.', options: [{ label: 'Change passcode', value: 'chg', primary: true }, { label: 'Turn off', value: 'off', danger: true }] }).then(function (v) { if (v === 'off') { Z.meta.set('pinHash', ''); U.toast('Passcode turned off'); Z.refresh(); } else if (v === 'chg') setPin(); });
    setPin();
  }
  function setPin() {
    F.sheet({
      title: 'Set a passcode', fields: '<p class="muted" style="margin-top:-4px">Choose 4 digits. If you forget it, you can clear site data in Safari — that deletes data that hasn’t synced, so export a backup first.</p>' + U.field('Passcode', '<input class="input" id="pin1" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off" placeholder="••••" data-af>', 'pin1') + U.field('Repeat passcode', '<input class="input" id="pin2" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off" placeholder="••••">', 'pin2'), save: 'Turn on',
      onSubmit: function (root) { var a = U.val(root, 'pin1'), b = U.val(root, 'pin2'); if (!/^\d{4}$/.test(a)) { U.fail(root, 'pin1', 'Use exactly 4 digits.'); return false; } if (a !== b) { U.fail(root, 'pin2', 'The two codes don’t match.'); return false; } Z.hashPin(a).then(function (h) { Z.meta.set('pinHash', h); U.toast('Passcode is on'); Z.refresh(); }); }
    });
  }

  function conflictsSheet() {
    var list = Z.sync.conflicts(), api = U.sheet({
      title: 'Sync conflicts',
      body: '<p class="muted" style="margin-top:-4px">The same item was changed on two devices. The newest version was kept — the older one is saved here so nothing is lost.</p><div class="list">' + list.map(function (c, i) {
        var d = c.data || {}; return '<div class="item" style="align-items:flex-start"><div class="grow"><div class="ti">' + esc(d.title || d.name || d.text && d.text.slice(0, 40) || c.col) + '</div><div class="su">' + esc(c.col) + ' · older ' + (c.side === 'local' ? 'device' : 'cloud') + ' copy · ' + ago(c.at) + '</div></div><div class="row" style="gap:6px"><button class="btn sm" data-keep="' + i + '">Restore this</button><button class="iconbtn sm" data-drop="' + i + '" aria-label="Dismiss">' + ic('x') + '</button></div></div>'; }).join('') + '</div>',
      onMount: function (root) { root.addEventListener('click', function (e) { var k = e.target.closest('[data-keep]'), d = e.target.closest('[data-drop]'); if (k) { Z.sync.restoreConflict(+k.dataset.keep); api.close(); U.toast('Restored'); } else if (d) { Z.sync.dismissConflict(+d.dataset.drop); api.close(); Z.refresh(); } }); }
    });
  }

  var A = Z.actions;
  A.stAuth = function (el) { authSheet(el.dataset.arg); };
  A.stSync = function () { U.toast('Syncing…', 'info'); Z.sync.syncNow().then(function () { updatePending(); if (Z.sync.error()) U.toast(Z.sync.error(), 'err'); else U.toast('Up to date'); }); };
  A.stOut = function () { U.confirm({ title: 'Sign out?', text: 'Your data stays on this device. Unsynced changes will upload next time you sign in.', ok: 'Sign out' }).then(function (y) { if (y) Z.push.disable(true).then(function () { return Z.sync.signOut(); }).then(function () { U.toast('Signed out'); Z.refresh(); }); }); };
  A.stConf = conflictsSheet;
  A.stAskN = function () { Z.reminders.ask().then(function (p) { U.toast(p === 'granted' ? 'Notifications allowed' : 'Notifications not allowed', p === 'granted' ? '' : 'err'); Z.refresh(); }); };
  A.stTestN = function () { Z.reminders.test(); U.toast('Test sent', 'info'); };
  A.stIcs = function () { if (!S.all('events').length) return U.toast('Add some events first', 'info'); Z.download('zero-os-events.ics', Z.reminders.ics(), 'text/calendar'); U.toast('Calendar file ready — open it to add events'); };
  A.stPushOn = function () { U.toast('Turning on…', 'info'); Z.push.enable().then(function () { U.toast('Push alerts are on'); Z.refresh(); }).catch(function (e) { U.toast(e.message || 'Could not turn on push', 'err'); Z.refresh(); }); };
  A.stPushOff = function () { Z.push.disable().then(function () { U.toast('Push alerts are off'); Z.refresh(); }).catch(function (e) { U.toast(e.message, 'err'); Z.refresh(); }); };
  A.stPushTest = function () { Z.push.test().then(function () { U.toast('Test sent — it should arrive within a minute. Close the app to see it.', 'info'); }).catch(function (e) { U.toast(e.message, 'err'); }); };
  A.stPin = pinSheet;
  A.stJson = function () { Z.download('zero-os-backup-' + Z.today() + '.json', JSON.stringify(S.dump(), null, 2), 'application/json'); U.toast('Backup saved'); };
  A.stCsvTx = function () { Z.exportTransactionsCSV(); };
  A.stCsvMore = function () {
    var n = 0;
    if (L.tasks().length) { Z.download('zero-os-tasks.csv', '﻿' + Z.toCSV(L.tasks(), ['title', 'cat', 'due', ['priority', function (t) { return Z.PRIORITY[t.priority || 2].label; }], ['done', function (t) { return t.done ? 'yes' : 'no'; }], ['description', function (t) { return t.desc; }]]), 'text/csv'); n++; }
    if (S.all('habitLogs').length) { Z.download('zero-os-habit-log.csv', '﻿' + Z.toCSV(S.all('habitLogs').sort(function (a, b) { return a.date.localeCompare(b.date); }), ['date', ['habit', function (l) { var h = S.get('habits', l.habitId); return h ? h.name : ''; }]]), 'text/csv'); n++; }
    if (S.all('journal').length) { Z.download('zero-os-journal.csv', '﻿' + Z.toCSV(S.all('journal').sort(function (a, b) { return a.date.localeCompare(b.date); }), ['date', ['mood', function (j) { var m = Z.moodOf(j.mood); return m ? m.label : ''; }], 'text']), 'text/csv'); n++; }
    U.toast(n ? n + ' file' + (n > 1 ? 's' : '') + ' exported' : 'Nothing to export yet', n ? '' : 'info');
  };
  A.stRestore = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () {
        var data; try { data = JSON.parse(r.result); if (data.app !== 'zero-os') throw 0; } catch (e) { return U.toast('That is not a valid ZERO OS backup.', 'err'); }
        U.choice({ title: 'Restore backup', text: 'Backup from ' + (data.exportedAt || '').slice(0, 10) + '. How should it be applied?', options: [{ label: 'Merge (keep newest of each item)', value: 'merge', primary: true }, { label: 'Replace everything on this device', value: 'replace', danger: true }] }).then(function (m) {
          if (!m) return; try { S.restore(data, m); U.celebrate('Backup restored', '', 'database'); } catch (e) { U.toast(e.message, 'err'); }
        });
      };
      r.readAsText(f);
    };
    inp.click();
  };
  A.stWipe = function () {
    U.confirm({ title: 'Delete all data on this device?', text: 'Export a backup first if you want to keep anything. Cloud data is not touched.', ok: 'Delete everything', danger: true }).then(function (y) { if (!y) return; U.confirm({ title: 'Really delete?', text: 'This cannot be undone.', ok: 'Yes, delete', danger: true }).then(function (y2) { if (y2) S.wipe().then(function () { location.hash = '#/home'; location.reload(); }); }); });
  };
  A.stCheck = function () {
    var api = U.sheet({ title: 'Cloud connection', body: '<div class="stack" id="cchk"></div>' });
    var box = Z.$('#cchk', api.el);
    function draw(items, extra) {
      box.innerHTML = items.map(function (c) { return '<div class="row" style="align-items:flex-start;gap:12px"><span style="color:' + (c.ok ? 'var(--good)' : 'var(--bad)') + ';margin-top:2px">' + ic(c.ok ? 'circle-check' : 'circle-alert') + '</span><div class="grow"><div style="font-weight:620">' + esc(c.title) + '</div>' + (!c.ok && c.fix ? '<div class="small muted" style="margin-top:3px">' + esc(c.fix) + '</div>' : '') + '</div></div>'; }).join('') + (extra || '');
    }
    var items = Z.sync.diagnose(); draw(items);
    var bad = items.filter(function (c) { return !c.ok; });
    if (bad.length) { box.insertAdjacentHTML('beforeend', '<p class="small dim">After you fix config.js on GitHub, wait for the green tick in Actions, then close and reopen the app (swipe it away first).</p>'); return; }
    box.insertAdjacentHTML('beforeend', '<div class="small dim" id="cping">Contacting Supabase…</div>');
    Z.sync.ping().then(function (r) { var el = Z.$('#cping', box); if (el) el.outerHTML = '<div class="row" style="gap:12px;align-items:flex-start"><span style="color:' + (r.ok ? 'var(--good)' : 'var(--bad)') + '">' + ic(r.ok ? 'circle-check' : 'circle-alert') + '</span><div class="grow" style="font-weight:620">' + esc(r.text) + '</div></div>'; });
  };
  A.stWipeCloud = function () { U.confirm({ title: 'Delete your cloud data?', text: 'Removes all your records from Supabase. Data on this device stays.', ok: 'Delete cloud data', danger: true }).then(function (y) { if (y) Z.sync.deleteCloudData().then(function () { U.toast('Cloud data deleted'); }).catch(function (e) { U.toast(e.message, 'err'); }); }); };

  function updatePending() { Z.sync.pendingCount().then(function (n) { if (n !== pendingCount) { pendingCount = n; if (Z.current() === 'settings') Z.refresh(); } }); }

  Z.views.settings = {
    title: 'Settings', area: 'settings',
    render: function () { return Z.hd({ eyebrow: 'Account', title: 'Settings', sub: 'Everything is yours.', noGear: true, acts: '<button class="iconbtn glass" data-act="go" data-arg="home" aria-label="Back to Home">' + ic('house') + '</button>' }) + '<div class="cols">' + body() + '</div>'; },
    mount: function (root) {
      updatePending(); U.wire(root);
      var nm = Z.$('#stname', root); nm.addEventListener('change', function () { Z.setSettings({ name: nm.value.trim().slice(0, 30) }); U.toast('Saved'); });
      var tg = Z.$('#sttarget', root); tg.addEventListener('change', function () { var v = Math.max(1, Math.min(100, parseInt(tg.value, 10) || 10)); tg.value = v; Z.setSettings({ studyTargetHours: v }); U.toast('Saved'); });
      var ld = Z.$('#stlead', root); ld.addEventListener('change', function () { Z.setSettings({ reminderLead: +ld.value }); U.toast('Saved'); });
      root.addEventListener('flip', function (e) { if (e.target.dataset.switch === 'showtime') Z.setSettings({ showTime: e.detail }); });
    },
    onChange: function () { var a = document.activeElement; if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return false; return true; }
  };
})();
