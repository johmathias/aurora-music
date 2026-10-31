/* ZERO OS — core: namespace, dates, formatting, local database (IndexedDB)
   Plain scripts (no modules) so the app also opens by double-clicking index.html. */
(function () {
  'use strict';
  var Z = window.Z = window.Z || {};
  Z.cfg = window.ZERO_CONFIG || {};
  Z.views = {};
  Z.actions = {};
  Z.TZ = 'Africa/Dar_es_Salaam';
  Z.VERSION = '1.0.0';
  Z.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- helpers ---------- */
  Z.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };
  Z.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  Z.ic = function (name, cls) {
    return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ((window.ZICONS || {})[name] || '') + '</svg>';
  };
  Z.clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  Z.sum = function (arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f ? f(arr[i]) : arr[i]; return t; };
  Z.$ = function (sel, root) { return (root || document).querySelector(sel); };
  Z.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- dates (all strings: YYYY-MM-DD, Dar es Salaam time) ---------- */
  var dtf = new Intl.DateTimeFormat('en-CA', { timeZone: Z.TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  var tmf = new Intl.DateTimeFormat('en-GB', { timeZone: Z.TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  Z.today = function () { return dtf.format(new Date()); };
  Z.nowMin = function () {
    var p = tmf.formatToParts(new Date()), h = 0, m = 0;
    p.forEach(function (x) { if (x.type === 'hour') h = +x.value % 24; if (x.type === 'minute') m = +x.value; });
    return h * 60 + m;
  };
  Z.d = function (s) { return new Date(s + 'T00:00:00Z'); };
  Z.ds = function (d) { return d.toISOString().slice(0, 10); };
  Z.addDays = function (s, n) { var d = Z.d(s); d.setUTCDate(d.getUTCDate() + n); return Z.ds(d); };
  Z.addMonths = function (s, n) {
    var d = Z.d(s), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
    var dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, dim)); return Z.ds(d);
  };
  Z.dow = function (s) { return Z.d(s).getUTCDay(); };               // 0 = Sunday
  Z.diff = function (a, b) { return Math.round((Z.d(b) - Z.d(a)) / 864e5); };
  Z.weekStart = function (s) { return Z.addDays(s, -((Z.dow(s) + 6) % 7)); }; // Monday first
  Z.monthStart = function (s) { return s.slice(0, 8) + '01'; };
  Z.monthEnd = function (s) { var d = Z.d(s); return Z.ds(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))); };
  Z.range = function (a, b) { var out = [], n = Z.diff(a, b); for (var i = 0; i <= n; i++) out.push(Z.addDays(a, i)); return out; };
  Z.fmt = function (s, o) { return Z.d(s).toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC' }, o || { day: 'numeric', month: 'short' })); };
  Z.fmtLong = function (s) { return Z.fmt(s, { weekday: 'long', day: 'numeric', month: 'long' }); };
  Z.fmtMonth = function (s) { return Z.fmt(s, { month: 'long', year: 'numeric' }); };
  Z.fmtDow = function (s) { return Z.fmt(s, { weekday: 'short' }); };
  Z.rel = function (s) {          // "Today", "Tomorrow", "In 3 days", "2 days ago"
    var n = Z.diff(Z.today(), s);
    if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday';
    if (n > 1 && n < 8) return 'In ' + n + ' days'; if (n < -1 && n > -8) return Math.abs(n) + ' days ago';
    return Z.fmt(s);
  };
  Z.tm = function (min) { var h = Math.floor(min / 60) % 24, m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  Z.toMin = function (t) { if (!t) return null; var p = t.split(':'); return (+p[0]) * 60 + (+p[1]); };
  Z.greeting = function () { var h = Math.floor(Z.nowMin() / 60); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'; };
  Z.DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  Z.DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------- number formatting ---------- */
  var nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  Z.num = function (n) { return nf.format(Math.round(n || 0)); };
  Z.money = function (n, o) {
    n = n || 0; o = o || {};
    var abs = Math.abs(n), s;
    if (o.compact && abs >= 1e6) s = (abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    else if (o.compact && abs >= 1e4) s = (abs / 1e3).toFixed(0) + 'K';
    else s = nf.format(Math.round(abs));
    return (n < 0 ? '−' : (o.plus && n > 0 ? '+' : '')) + (o.bare ? '' : 'TSh ') + s;
  };
  Z.pct = function (a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; };

  /* ---------- constants shared by several views ---------- */
  Z.COLORS = { home: '#9A95FF', habits: '#FF6B3D', schedule: '#3DB8FF', plans: '#B565F5', money: '#34D399', progress: '#FFC93D' };
  Z.EVENT_CATS = {
    class: { label: 'Class', color: '#3DB8FF', icon: 'graduation-cap' },
    study: { label: 'Study', color: '#B565F5', icon: 'book-open' },
    assignment: { label: 'Assignment', color: '#FFC93D', icon: 'file-text' },
    exam: { label: 'Exam', color: '#FF5C6C', icon: 'pen-line' },
    appointment: { label: 'Appointment', color: '#2DD4BF', icon: 'calendar-days' },
    personal: { label: 'Personal', color: '#34D399', icon: 'coffee' },
    custom: { label: 'Custom', color: '#A5A8C0', icon: 'star' }
  };
  Z.TASK_CATS = ['Personal', 'University', 'Work', 'Money', 'Health', 'Other'];
  Z.PRIORITY = { 3: { label: 'High', color: '#FF5C6C' }, 2: { label: 'Medium', color: '#FFC93D' }, 1: { label: 'Low', color: '#3DB8FF' } };
  Z.EXP_CATS = ['Food', 'Transport', 'Airtime & Data', 'Rent', 'Bills', 'Shopping', 'Health', 'Education', 'Entertainment', 'Family', 'Savings', 'Other'];
  Z.INC_CATS = ['Salary', 'Business', 'Allowance', 'Gift', 'Other'];
  Z.CAT_COLORS = ['#34D399', '#3DB8FF', '#FFC93D', '#FF6B3D', '#B565F5', '#2DD4BF', '#FF5C8A', '#7C8CFF', '#A3E635', '#F59E0B', '#22D3EE', '#94A3B8'];
  Z.catColor = function (cat) { var i = Z.EXP_CATS.indexOf(cat); return Z.CAT_COLORS[i < 0 ? 11 : i % 12]; };
  Z.ACCOUNT_TYPES = [
    { v: 'bank', label: 'Bank', icon: 'landmark' }, { v: 'mobile', label: 'Mobile money', icon: 'smartphone' },
    { v: 'cash', label: 'Cash', icon: 'banknote' }, { v: 'savings', label: 'Savings', icon: 'piggy-bank' }, { v: 'custom', label: 'Custom', icon: 'circle-dollar-sign' }
  ];
  Z.ACCOUNT_PRESETS = ['NMB', 'CRDB', 'M-Pesa', 'Mixx by Yas', 'Airtel Money', 'HaloPesa', 'Azam Pesa', 'Selcom', 'Cash', 'Savings'];
  Z.MOODS = [
    { v: 1, label: 'Rough', icon: 'frown', color: '#FF5C6C' }, { v: 2, label: 'Low', icon: 'meh', color: '#FF9F0A' },
    { v: 3, label: 'Okay', icon: 'circle', color: '#A5A8C0' }, { v: 4, label: 'Good', icon: 'smile', color: '#34D399' }, { v: 5, label: 'Great', icon: 'laugh', color: '#FFC93D' }
  ];
  Z.moodOf = function (v) { return Z.MOODS.filter(function (m) { return m.v === v; })[0]; };

  /* ---------- tiny meta store (device-only values; kept in memory + IndexedDB) ---------- */
  var metaMem = {};
  Z.meta = {
    get: function (k, def) { return metaMem[k] === undefined ? def : metaMem[k]; },
    set: function (k, v) { metaMem[k] = v; dbPut('meta', { k: k, v: v }); }
  };

  /* ---------- local database ---------- */
  var COLS = ['settings', 'habits', 'habitLogs', 'behaviours', 'behaviourLogs', 'challengeLogs', 'events', 'tasks', 'goals', 'courses', 'uni', 'accounts', 'transactions', 'budgets', 'savings', 'journal'];
  Z.COLS = COLS;
  var mem = {}; COLS.forEach(function (c) { mem[c] = new Map(); });
  var db = null, fallback = false, listeners = [], changedCols = {}, emitTimer = 0, batching = 0;

  function openDB() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no indexedDB'));
      var r = indexedDB.open('zeroos', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        d.createObjectStore('records', { keyPath: 'key' });
        d.createObjectStore('pending', { keyPath: 'key' });
        d.createObjectStore('meta', { keyPath: 'k' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.onblocked = function () { rej(new Error('blocked')); };
    });
  }
  function dbPut(store, obj) {
    if (fallback) { saveFallback(); return; }
    if (!db) return;
    try { db.transaction(store, 'readwrite').objectStore(store).put(obj); } catch (e) { console.warn('db put failed', e); }
  }
  function dbDelete(store, key) {
    if (!db) return;
    try { db.transaction(store, 'readwrite').objectStore(store).delete(key); } catch (e) { }
  }
  function getAllFrom(store) {
    return new Promise(function (res) {
      try { var q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; }
      catch (e) { res([]); }
    });
  }
  var fbTimer = 0;
  function saveFallback() {
    clearTimeout(fbTimer);
    fbTimer = setTimeout(function () {
      try {
        var out = { data: {}, meta: metaMem };
        COLS.forEach(function (c) { out.data[c] = Array.from(mem[c].values()); });
        localStorage.setItem('zero.fallback', JSON.stringify(out));
      } catch (e) { console.warn('fallback save failed', e); }
    }, 300);
  }

  Z.store = {
    init: function () {
      return openDB().then(function (d) {
        db = d;
        return Promise.all([getAllFrom('records'), getAllFrom('meta')]);
      }).then(function (r) {
        r[0].forEach(function (rec) { if (mem[rec.col]) mem[rec.col].set(rec.id, rec.data); });
        r[1].forEach(function (m) { metaMem[m.k] = m.v; });
      }).catch(function (e) {
        console.warn('IndexedDB unavailable, using fallback storage', e);
        fallback = true;
        try {
          var raw = JSON.parse(localStorage.getItem('zero.fallback') || 'null');
          if (raw) { COLS.forEach(function (c) { (raw.data[c] || []).forEach(function (o) { mem[c].set(o.id, o); }); }); metaMem = raw.meta || {}; }
        } catch (e2) { }
      });
    },
    isFallback: function () { return fallback; },
    all: function (col) { var out = []; mem[col].forEach(function (v) { if (!v.deleted) out.push(v); }); return out; },
    get: function (col, id) { var v = mem[col].get(id); return v && !v.deleted ? v : undefined; },
    raw: function (col, id) { return mem[col].get(id); },
    put: function (col, obj) {
      var now = Date.now(); obj = Object.assign({}, obj);
      if (!obj.id) obj.id = Z.uid();
      var prev = mem[col].get(obj.id);
      if (!obj.createdAt) obj.createdAt = prev && prev.createdAt ? prev.createdAt : now;
      obj.updatedAt = now; delete obj.deleted;
      mem[col].set(obj.id, obj);
      persist(col, obj); emit(col); return obj;
    },
    putRemote: function (col, obj) { mem[col].set(obj.id, obj); dbPut('records', { key: col + ':' + obj.id, col: col, id: obj.id, data: obj }); emit(col); },
    del: function (col, id) {
      var prev = mem[col].get(id); if (!prev) return;
      var t = { id: id, deleted: true, updatedAt: Date.now(), createdAt: prev.createdAt };
      mem[col].set(id, t); persist(col, t); emit(col);
    },
    delMany: function (col, ids) { Z.store.batch(function () { ids.forEach(function (i) { Z.store.del(col, i); }); }); },
    batch: function (fn) { batching++; try { fn(); } finally { batching--; if (!batching) flushEmit(); } },
    queueAll: function () {
      COLS.forEach(function (c) { mem[c].forEach(function (o, id) { dbPut('pending', { key: c + ':' + id, col: c, id: id, at: o.updatedAt || 0 }); }); });
    },
    pending: function () { return getAllFrom('pending'); },
    clearPending: function (key) { dbDelete('pending', key); },
    onChange: function (fn) { listeners.push(fn); },
    dump: function () {
      var data = {}; COLS.forEach(function (c) { data[c] = Z.store.all(c); });
      return { app: 'zero-os', version: 1, exportedAt: new Date().toISOString(), data: data };
    },
    restore: function (obj, mode) {
      if (!obj || obj.app !== 'zero-os' || !obj.data) throw new Error('This is not a ZERO OS backup file.');
      Z.store.batch(function () {
        if (mode === 'replace') COLS.forEach(function (c) { Z.store.all(c).forEach(function (o) { Z.store.del(c, o.id); }); });
        COLS.forEach(function (c) {
          (obj.data[c] || []).forEach(function (o) {
            if (!o || !o.id) return;
            var cur = mem[c].get(o.id);
            if (mode === 'merge' && cur && !cur.deleted && (cur.updatedAt || 0) >= (o.updatedAt || 0)) return;
            var copy = Object.assign({}, o); delete copy.deleted; Z.store.put(c, copy);
          });
        });
      });
    },
    wipe: function () {
      return new Promise(function (res) {
        COLS.forEach(function (c) { mem[c].clear(); }); metaMem = {};
        if (db) { try { db.close(); } catch (e) { } }
        try { localStorage.removeItem('zero.fallback'); localStorage.removeItem('zero.session'); } catch (e) { }
        if (!window.indexedDB) return res();
        var r = indexedDB.deleteDatabase('zeroos'); r.onsuccess = r.onerror = r.onblocked = function () { res(); };
      });
    }
  };
  function persist(col, obj) {
    var key = col + ':' + obj.id;
    dbPut('records', { key: key, col: col, id: obj.id, data: obj });
    dbPut('pending', { key: key, col: col, id: obj.id, at: obj.updatedAt });
  }
  function emit(col) {
    changedCols[col] = 1;
    if (batching) return;
    clearTimeout(emitTimer); emitTimer = setTimeout(flushEmit, 16);
  }
  function flushEmit() {
    var c = changedCols; changedCols = {};
    if (!Object.keys(c).length) return;
    listeners.forEach(function (fn) { try { fn(c); } catch (e) { console.error(e); } });
  }

  /* ---------- settings (one synced record) ---------- */
  var DEFAULTS = { name: '', showTime: true, studyTargetHours: 10, reminderLead: 15, currency: 'TZS', challenge: null, dailyHabitReminder: '' };
  Z.settings = function () { return Object.assign({}, DEFAULTS, Z.store.get('settings', 'main') || {}); };
  Z.setSettings = function (patch) { return Z.store.put('settings', Object.assign({}, Z.store.get('settings', 'main') || {}, patch, { id: 'main' })); };

  /* ---------- export helpers ---------- */
  Z.csvCell = function (v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  // cols: field names, or [header, function(row)] pairs
  Z.toCSV = function (rows, cols) {
    var head = cols.map(function (c) { return Z.csvCell(typeof c === 'string' ? c : c[0]); }).join(',');
    var lines = rows.map(function (r) { return cols.map(function (c) { return Z.csvCell(typeof c === 'string' ? r[c] : c[1](r)); }).join(','); });
    return [head].concat(lines).join('\n');
  };
  Z.download = function (name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  Z.parseCSV = function (text) {
    var rows = [], row = [], cur = '', q = false, i = 0, c;
    text = text.replace(/^﻿/, '');
    for (; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',' || c === ';' || c === '\t') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
    return rows;
  };
})();
