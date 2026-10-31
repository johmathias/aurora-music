/* ZERO OS — UI helpers: toast, bottom sheets, dialogs, menus, rings, count-up, charts, forms */
(function () {
  'use strict';
  var Z = window.Z, esc = Z.esc, ic = Z.ic;
  var U = Z.ui = {};

  /* ---------- toast ---------- */
  U.toast = function (msg, type) {
    var box = Z.$('#toasts'); if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.setAttribute('role', 'status');
    el.innerHTML = ic(type === 'err' ? 'circle-alert' : type === 'info' ? 'info' : 'circle-check') + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 400); }, type === 'err' ? 4200 : 2300);
  };

  /* ---------- success celebration ---------- */
  U.celebrate = function (title, text, icon) {
    var el = document.createElement('div'); el.className = 'celebrate';
    var sparks = '';
    if (!Z.reduced) for (var i = 0; i < 14; i++) {
      var a = (i / 14) * Math.PI * 2, r = 90 + Math.random() * 60;
      sparks += '<i class="spark" style="--x:' + Math.cos(a) * r + 'px;--y:' + Math.sin(a) * r + 'px;animation-delay:' + (i % 3) * 40 + 'ms"></i>';
    }
    el.innerHTML = '<div class="cc glass"><div class="seal">' + ic(icon || 'check') + '</div><h3>' + esc(title) + '</h3>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div>' + sparks;
    document.body.appendChild(el);
    if (navigator.vibrate) try { navigator.vibrate(18); } catch (e) { }
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 500); }, 1900);
  };

  /* ---------- bottom sheet ---------- */
  var sheetStack = [];
  U.sheet = function (opts) {
    // opts: title, body (html), onMount(root, api), onClose, foot (html)
    var wrap = document.createElement('div'); wrap.className = 'backdrop';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || '') + '">' +
      '<div class="grab"><i></i></div><div class="sh-head"><h2>' + esc(opts.title || '') + '</h2>' +
      '<button class="iconbtn sm glass" data-close aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="sh-body">' + (opts.body || '') + '</div></div>';
    document.body.appendChild(wrap); document.body.classList.add('noscroll');
    var sheet = wrap.firstChild, closed = false;
    var api = {
      el: wrap, body: Z.$('.sh-body', wrap), sheet: sheet,
      close: function (r) {
        if (closed) return; closed = true; wrap.classList.remove('show');
        sheetStack = sheetStack.filter(function (s) { return s !== api; });
        if (!sheetStack.length) document.body.classList.remove('noscroll');
        setTimeout(function () { wrap.remove(); }, 450);
        if (opts.onClose) opts.onClose(r);
      }
    };
    sheetStack.push(api);
    requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('show'); }); });
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('[data-close]')) api.close(); });
    // drag to dismiss
    var grab = Z.$('.grab', wrap), startY = 0, dy = 0, dragging = false;
    grab.addEventListener('pointerdown', function (e) { dragging = true; startY = e.clientY; dy = 0; sheet.classList.add('drag'); grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', function (e) { if (!dragging) return; dy = Math.max(0, e.clientY - startY); sheet.style.transform = 'translate3d(0,' + dy + 'px,0)'; });
    function endDrag() { if (!dragging) return; dragging = false; sheet.classList.remove('drag'); sheet.style.transform = ''; if (dy > 110) api.close(); }
    grab.addEventListener('pointerup', endDrag); grab.addEventListener('pointercancel', endDrag);
    if (opts.onMount) opts.onMount(api.body, api);
    return api;
  };
  U.closeTopSheet = function () { var s = sheetStack[sheetStack.length - 1]; if (s) { s.close(); return true; } return false; };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') U.closeTopSheet(); });

  // keep sheets above the on-screen keyboard
  if (window.visualViewport) {
    var vv = window.visualViewport;
    var fit = function () { var r = document.documentElement.style; r.setProperty('--vvh', vv.height + 'px'); r.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  document.addEventListener('focusin', function (e) {
    if (e.target.closest && e.target.closest('.sh-body') && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      setTimeout(function () { try { e.target.scrollIntoView({ block: 'center', behavior: Z.reduced ? 'auto' : 'smooth' }); } catch (x) { } }, 320);
    }
  });

  /* ---------- confirm / alert dialog ---------- */
  U.confirm = function (o) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div'); wrap.className = 'backdrop dialog-wrap';
      wrap.innerHTML = '<div class="dialog" role="alertdialog" aria-modal="true"><h3>' + esc(o.title || 'Are you sure?') + '</h3><p>' + esc(o.text || '') + '</p>' +
        '<div class="btns"><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-ok>' + esc(o.ok || 'Confirm') + '</button>' +
        '<button class="btn ghost" data-no>' + esc(o.cancel || 'Cancel') + '</button></div></div>';
      document.body.appendChild(wrap); document.body.classList.add('noscroll');
      requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('show'); }); });
      function done(v) { wrap.classList.remove('show'); if (!sheetStack.length) document.body.classList.remove('noscroll'); setTimeout(function () { wrap.remove(); }, 400); resolve(v); }
      wrap.addEventListener('click', function (e) { if (e.target.closest('[data-ok]')) done(true); else if (e.target === wrap || e.target.closest('[data-no]')) done(false); });
      Z.$('[data-ok]', wrap).focus();
    });
  };

  /* ---------- multi-choice dialog: resolves with the chosen value, or null ---------- */
  U.choice = function (o) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div'); wrap.className = 'backdrop dialog-wrap';
      wrap.innerHTML = '<div class="dialog" role="alertdialog" aria-modal="true"><h3>' + esc(o.title) + '</h3><p>' + esc(o.text || '') + '</p><div class="btns">' +
        o.options.map(function (b, i) { return '<button class="btn ' + (b.danger ? 'danger' : b.primary ? 'primary' : '') + '" data-i="' + i + '">' + esc(b.label) + '</button>'; }).join('') +
        '<button class="btn ghost" data-no>Cancel</button></div></div>';
      document.body.appendChild(wrap); document.body.classList.add('noscroll');
      requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('show'); }); });
      function done(v) { wrap.classList.remove('show'); if (!sheetStack.length) document.body.classList.remove('noscroll'); setTimeout(function () { wrap.remove(); }, 400); resolve(v); }
      wrap.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) done(o.options[+b.dataset.i].value); else if (e.target === wrap || e.target.closest('[data-no]')) done(null); });
    });
  };

  /* ---------- month grid (Monday first). cell(date, inMonth) -> {cls, style, inner} ---------- */
  U.monthGrid = function (o) {
    var first = Z.monthStart(o.month), lead = (Z.dow(first) + 6) % 7, start = Z.addDays(first, -lead), end = Z.monthEnd(first);
    var total = Math.ceil((lead + Z.diff(first, end) + 1) / 7) * 7, html = '<div class="cal ' + (o.cls || '') + '">';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (d) { html += '<div class="dn">' + d + '</div>'; });
    for (var i = 0; i < total; i++) {
      var d = Z.addDays(start, i), inM = d.slice(0, 7) === first.slice(0, 7), c = o.cell(d, inM) || {};
      html += '<button type="button" class="d' + (inM ? '' : ' out') + (d === Z.today() ? ' today' : '') + (d === o.selected ? ' sel' : '') + (d > Z.today() ? ' fut' : '') + ' ' + (c.cls || '') + '" data-date="' + d + '" style="' + (c.style || '') + '" aria-label="' + Z.fmtLong(d) + '"><span class="fillbg"></span>' + Z.d(d).getUTCDate() + (c.inner || '<span class="dots"></span>') + '</button>';
    }
    return html + '</div>';
  };

  /* ---------- context menu ---------- */
  U.menu = function (anchor, items) {
    U.closeMenu();
    var m = document.createElement('div'); m.className = 'menu'; m.id = 'ctxmenu';
    m.innerHTML = items.map(function (it, i) { return '<button data-i="' + i + '" class="' + (it.danger ? 'dng' : '') + '">' + ic(it.icon || 'circle') + esc(it.label) + '</button>'; }).join('');
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    var left = Z.clamp(r.right - w, 10, window.innerWidth - w - 10), top = r.bottom + 8;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 8);
    m.style.left = left + 'px'; m.style.top = top + 'px';
    m.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var it = items[+b.dataset.i]; U.closeMenu(); it.run(); });
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
    function outside(e) { if (!m.contains(e.target)) U.closeMenu(); }
    m._out = outside;
  };
  U.closeMenu = function () { var m = Z.$('#ctxmenu'); if (m) { document.removeEventListener('pointerdown', m._out, true); m.remove(); } };

  /* ---------- progress ring (SVG) ---------- */
  U.ring = function (o) {
    // o: size, stroke, value (0-1), color, mid (html), id
    var s = o.size || 120, st = o.stroke || 12, r = (s - st) / 2, c = 2 * Math.PI * r;
    var v = Z.clamp(o.value || 0, 0, 1);
    return '<div class="ring" style="width:' + s + 'px;height:' + s + 'px;--rc:' + (o.color || 'var(--acc)') + '">' +
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '"><circle class="tr" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" stroke-width="' + st + '"/>' +
      '<circle class="pg" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" stroke-width="' + st + '" stroke="' + (o.color || 'var(--acc)') + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" data-v="' + v + '" data-c="' + c + '"/></svg>' +
      '<div class="mid">' + (o.mid || '') + '</div></div>';
  };
  // animate rings, bars and count-up numbers inside a root element
  U.animate = function (root) {
    root = root || document;
    var instant = Z.reduced || Z.entering === false;      // re-renders after a data change should not replay the intro
    function setAll() {
      Z.$$('.ring .pg', root).forEach(function (p) { if (instant) p.style.transition = 'none'; p.style.strokeDashoffset = (+p.dataset.c) * (1 - (+p.dataset.v)); });
      Z.$$('.bar > i[data-w]', root).forEach(function (b) { if (instant) b.style.transition = 'none'; b.style.width = b.dataset.w + '%'; });
    }
    if (instant) setAll(); else requestAnimationFrame(function () { requestAnimationFrame(setAll); });
    Z.$$('[data-count]', root).forEach(function (el) {
      var to = +el.dataset.count, kind = el.dataset.kind || 'num', dur = instant ? 0 : 1100, t0 = performance.now();
      var fmtv = function (v) {
        return kind === 'money' ? Z.money(v, { compact: el.dataset.compact === '1' }) : kind === 'pct' ? Math.round(v) + '%' : el.dataset.dec ? (Math.round(v * 10) / 10).toFixed(1) : Z.num(v);
      };
      if (!dur) { el.textContent = fmtv(to); return; }
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.textContent = fmtv(to * e);
        if (k < 1) requestAnimationFrame(step); else el.textContent = fmtv(to);
      })(t0);
    });
  };
  U.bar = function (pct, color) { return '<div class="bar"' + (color ? ' style="--c:' + color + '"' : '') + '><i data-w="' + Z.clamp(pct, 0, 100) + '"></i></div>'; };
  U.count = function (n, kind, extra) { return '<span class="num" data-count="' + (n || 0) + '" data-kind="' + (kind || 'num') + '" ' + (extra || '') + '>0</span>'; };

  /* ---------- empty state ---------- */
  U.empty = function (icon, title, text, btn) {
    return '<div class="empty fade-swap"><div class="orb">' + ic(icon) + '</div><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p>' +
      (btn ? '<button class="btn primary sm" data-act="' + btn.act + '" ' + (btn.arg ? 'data-arg="' + esc(btn.arg) + '"' : '') + '>' + ic(btn.icon || 'plus') + esc(btn.label) + '</button>' : '') + '</div>';
  };
  U.skeleton = function () { return '<div class="stack"><div class="skel" style="height:150px"></div><div class="skel" style="height:110px"></div><div class="skel" style="height:110px"></div></div>'; };

  /* ---------- segmented control ---------- */
  U.seg = function (id, options, current) {
    var idx = Math.max(0, options.findIndex(function (o) { return o.v === current; }));
    return '<div class="seg" id="' + id + '" style="--n:' + options.length + ';--i:' + idx + '" role="tablist"><div class="thumb"></div>' +
      options.map(function (o) { return '<button role="tab" data-v="' + o.v + '" class="' + (o.v === current ? 'on' : '') + '">' + esc(o.label) + '</button>'; }).join('') + '</div>';
  };
  U.bindSeg = function (root, id, cb) {
    var seg = Z.$('#' + id, root); if (!seg) return;
    var btns = Z.$$('button', seg);
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      btns.forEach(function (x, i) { x.classList.toggle('on', x === b); if (x === b) seg.style.setProperty('--i', i); });
      cb(b.dataset.v);
    });
  };

  /* ---------- charts (Chart.js, themed) ---------- */
  var charts = [];
  U.destroyCharts = function () { charts.forEach(function (c) { try { c.destroy(); } catch (e) { } }); charts = []; };
  U.chart = function (canvas, cfg) {
    if (!window.Chart || !canvas) return null;
    var C = window.Chart;
    C.defaults.font.family = getComputedStyle(document.body).fontFamily;
    C.defaults.color = 'rgba(245,245,247,.55)';
    C.defaults.borderColor = 'rgba(255,255,255,.07)';
    var userOpt = cfg.options || {}, userPl = userOpt.plugins || {};
    cfg.options = Object.assign({
      responsive: true, maintainAspectRatio: false,
      animation: (Z.reduced || Z.entering === false) ? false : { duration: 1000, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(30,30,38,.95)', borderColor: 'rgba(255,255,255,.15)', borderWidth: 1, padding: 10, cornerRadius: 12, titleColor: '#fff', bodyColor: '#ddd', displayColors: true, boxPadding: 4 } }
    }, userOpt);
    var dp = { legend: { display: false } }; cfg.options.plugins = Object.assign({}, dp, cfg.options.plugins);
    if (userPl.tooltip) cfg.options.plugins.tooltip = Object.assign({ backgroundColor: 'rgba(30,30,38,.95)', borderColor: 'rgba(255,255,255,.15)', borderWidth: 1, padding: 10, cornerRadius: 12, titleColor: '#fff', bodyColor: '#ddd', displayColors: true, boxPadding: 4 }, userPl.tooltip);
    if (cfg.type !== 'doughnut' && cfg.type !== 'pie') {
      cfg.options.scales = cfg.options.scales || {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0 } },
        y: { grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false }, beginAtZero: true, ticks: { maxTicksLimit: 4 } }
      };
    }
    var ch = new C(canvas, cfg); charts.push(ch); return ch;
  };
  U.gradient = function (canvas, color, h) {
    var ctx = canvas.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, h || 220);
    g.addColorStop(0, color + '88'); g.addColorStop(1, color + '00'); return g;
  };

  /* ---------- forms ---------- */
  U.field = function (label, inner, id, hint) {
    return '<div class="field" data-f="' + (id || '') + '"><label' + (id ? ' for="' + id + '"' : '') + '>' + esc(label) + '</label>' + inner + '<div class="msg" role="alert"></div>' + (hint ? '<div class="xs dim">' + esc(hint) + '</div>' : '') + '</div>';
  };
  U.input = function (id, val, o) {
    o = o || {};
    return '<input class="input" id="' + id + '" name="' + id + '" type="' + (o.type || 'text') + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(o.ph || '') + '"' +
      (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.step ? ' step="' + o.step + '"' : '') +
      (o.autofocus ? ' data-af' : '') + ' autocomplete="off" ' + (o.cls ? 'class="input ' + o.cls + '"' : '') + '>';
  };
  U.select = function (id, options, val) {
    return '<select class="select" id="' + id + '" name="' + id + '">' + options.map(function (o) {
      var v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.label : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('') + '</select>';
  };
  U.textarea = function (id, val, ph, rows) { return '<textarea class="textarea" id="' + id + '" name="' + id + '" rows="' + (rows || 3) + '" placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea>'; };
  U.chipSelect = function (id, options, val, multi) {
    return '<div class="chips" data-chips="' + id + '" data-multi="' + (multi ? 1 : 0) + '">' + options.map(function (o) {
      var v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.label : o, c = typeof o === 'object' && o.color ? ' style="--c:' + o.color + '"' : '';
      var on = multi ? (val || []).indexOf(v) > -1 : v === val;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-v="' + esc(v) + '"' + c + '>' + (c ? '<i class="dot"></i>' : '') + esc(l) + '</button>';
    }).join('') + '</div>';
  };
  U.dayPicker = function (id, val) {
    var order = [1, 2, 3, 4, 5, 6, 0];
    return '<div class="days" data-days="' + id + '">' + order.map(function (d) { return '<button type="button" data-d="' + d + '" class="' + ((val || []).indexOf(d) > -1 ? 'on' : '') + '" aria-label="' + Z.DAYN[d] + '">' + Z.DAYS[d] + '</button>'; }).join('') + '</div>';
  };
  U.switchRow = function (id, label, on, sub) {
    return '<div class="row between"><div><div style="font-weight:600">' + esc(label) + '</div>' + (sub ? '<div class="small dim">' + esc(sub) + '</div>' : '') + '</div><button type="button" class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (!!on) + '" aria-label="' + esc(label) + '" data-switch="' + id + '"></button></div>';
  };
  // wire chips / day pickers / switches inside a container
  U.wire = function (root) {
    root.addEventListener('click', function (e) {
      var ch = e.target.closest('.chips[data-chips] .chip');
      if (ch) { var box = ch.parentNode, multi = box.dataset.multi === '1'; if (multi) ch.classList.toggle('on'); else { Z.$$('.chip', box).forEach(function (x) { x.classList.toggle('on', x === ch); }); } return; }
      var dp = e.target.closest('.days[data-days] button'); if (dp) { dp.classList.toggle('on'); return; }
      var sw = e.target.closest('[data-switch]'); if (sw) { var on = sw.classList.toggle('on'); sw.setAttribute('aria-checked', on); sw.dispatchEvent(new CustomEvent('flip', { bubbles: true, detail: on })); }
    });
  };
  U.val = function (root, id) { var el = Z.$('#' + id, root); return el ? el.value.trim() : ''; };
  U.chipVal = function (root, id) { var box = Z.$('[data-chips="' + id + '"]', root); if (!box) return ''; var on = Z.$$('.chip.on', box).map(function (c) { return c.dataset.v; }); return box.dataset.multi === '1' ? on : on[0] || ''; };
  U.dayVal = function (root, id) { return Z.$$('[data-days="' + id + '"] button.on', root).map(function (b) { return +b.dataset.d; }); };
  U.switchVal = function (root, id) { var s = Z.$('[data-switch="' + id + '"]', root); return !!(s && s.classList.contains('on')); };
  U.fail = function (root, id, msg) {
    var f = Z.$('[data-f="' + id + '"]', root); if (!f) return;
    f.classList.remove('err'); void f.offsetWidth; f.classList.add('err'); Z.$('.msg', f).textContent = msg;
    var inp = Z.$('input,select,textarea', f); if (inp) inp.focus();
  };
  U.clearErr = function (root) { Z.$$('.field.err', root).forEach(function (f) { f.classList.remove('err'); }); };
  U.footer = function (o) {
    return '<div class="sh-foot">' + (o.del ? '<button type="button" class="btn danger" data-del aria-label="Delete">' + ic('trash-2') + '</button>' : '') + (o.secondary || '') + '<button type="submit" class="btn primary" style="flex:2">' + esc(o.save || 'Save') + '</button></div>';
  };
  U.parseAmount = function (s) { var n = parseFloat(String(s).replace(/[,\s]/g, '')); return isFinite(n) ? n : NaN; };

  /* ---------- haptic-ish tap feedback for the whole app ---------- */
  document.addEventListener('pointerdown', function (e) { var b = e.target.closest('.btn,.chip,.iconbtn'); if (b && navigator.vibrate && e.pointerType === 'touch') { try { navigator.vibrate(5); } catch (x) { } } }, { passive: true });
})();
