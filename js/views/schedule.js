/* ZERO OS — Schedule: day, week, month and agenda views */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc, F = Z.forms;
  var mode = 'day', selDate = null, month = null;

  /* everything that happens on a date: calendar events + university assignments, exams and study sessions */
  L.dayItems = function (date) {
    var out = L.eventsOn(date).map(function (e) { return { src: 'event', ref: e, title: e.title, cat: e.cat || 'custom', start: e.start, end: e.end, notes: e.notes, date: date }; });
    L.uniItems().forEach(function (u) {
      if (u.date !== date || u.kind === 'revision') return;
      var c = L.courseOf(u.courseId);
      out.push({ src: 'uni', ref: u, title: (c ? c.code || c.name : '') + (c ? ' · ' : '') + u.title, cat: u.kind, start: u.start, end: u.end, notes: u.notes, done: u.done, date: date });
    });
    return out.sort(function (a, b) { var x = Z.toMin(a.start), y = Z.toMin(b.start); return (x == null ? -1 : x) - (y == null ? -1 : y); });
  };
  function sel() { return selDate || Z.today(); }

  function itemBox(it, i, state) {
    var cat = L.cat(it.cat), time = it.start ? it.start + (it.end ? '–' + it.end : '') : 'All day';
    return '<button class="ev ' + (state || '') + '" data-act="sOpen" data-src="' + it.src + '" data-id="' + it.ref.id + '" data-date="' + it.date + '" style="--c:' + cat.color + '">' +
      '<span class="tm">' + (it.start || '<span style="font-size:11px">ALL DAY</span>') + '</span><span class="bx"><span class="row between" style="gap:8px"><b style="font-weight:650;' + (it.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(it.title) + '</b>' + (it.done ? ic('circle-check') : (it.ref.reminder ? '<span class="dim">' + ic('bell') + '</span>' : '')) + '</span>' +
      '<span class="small muted" style="display:flex;gap:6px;align-items:center;margin-top:3px">' + ic(cat.icon) + cat.label + ' · ' + time + (it.ref.repeat && it.ref.repeat !== 'none' ? ' · ' + ic('repeat') : '') + '</span>' + (it.notes ? '<span class="small dim" style="display:block;margin-top:4px">' + esc(it.notes.slice(0, 90)) + '</span>' : '') + '</span></button>';
  }
  Z.itemBox = itemBox;

  function timeline(items, date) {
    var isToday = date === Z.today(), now = Z.nowMin(), html = '<div class="tl">', placed = false;
    items.forEach(function (it, i) {
      var s = Z.toMin(it.start), e = Z.toMin(it.end), state = '';
      if (isToday && s != null) {
        var endM = e != null ? e : s + 30;
        if (endM <= now) state = 'past'; else if (s <= now) state = 'now';
        if (!placed && s > now) { html += '<div class="nowline">' + Z.tm(now) + '</div>'; placed = true; }
      }
      html += itemBox(it, i, state);
    });
    if (isToday && !placed && items.some(function (x) { return x.start; })) html += '<div class="nowline">' + Z.tm(now) + '</div>';
    return html + '</div>';
  }

  function dayBody() {
    var date = sel(), t = Z.today(), items = L.dayItems(date), html = '';
    if (date === t) {
      var nx = L.nextEvent(), hasToday = items.length;
      var upcoming = items.filter(function (x) { return !x.start || (Z.toMin(x.end) != null ? Z.toMin(x.end) : Z.toMin(x.start) + 30) > Z.nowMin(); });
      html += '<div class="card hero rz" style="--n:1;padding:18px"><div class="label">' + (upcoming.length ? 'Next up' : 'Today') + '</div><div class="mid" style="margin-top:8px">' +
        (upcoming.length ? esc(upcoming[0].title) : hasToday ? 'All done for today' : 'A clear day') + '</div><div class="small muted" style="margin-top:6px">' +
        (upcoming.length ? (upcoming[0].start ? 'at ' + upcoming[0].start + (Z.toMin(upcoming[0].start) > Z.nowMin() ? ' · in ' + durText(Z.toMin(upcoming[0].start) - Z.nowMin()) : ' · happening now') : 'All day') + (upcoming.length > 1 ? ' · then ' + (upcoming.length - 1) + ' more' : '') : hasToday ? 'Nothing else scheduled — enjoy the rest.' : 'Nothing planned. Add something, or enjoy the space.') + '</div></div>';
    }
    if (!items.length) html += '<div class="card rz" style="--n:2">' + U.empty('calendar', 'Nothing on ' + (date === t ? 'today' : Z.fmt(date, { weekday: 'long' })), 'Add a class, a study session or a personal plan.', { act: 'addEvent', arg: date, label: 'Add event', icon: 'calendar-plus' }) + '</div>';
    else html += '<div class="card rz" style="--n:2"><div class="head"><h3>' + (date === t ? 'Today' : Z.fmt(date, { weekday: 'long' })) + '</h3><span class="badge">' + items.length + ' item' + (items.length > 1 ? 's' : '') + '</span></div>' + timeline(items, date) + '</div>';
    return html;
  }
  function durText(m) { return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : ''); }

  function weekBody() {
    var ws = Z.weekStart(sel()), t = Z.today();
    return '<div class="weekgrid">' + Z.range(ws, Z.addDays(ws, 6)).map(function (d, i) {
      var items = L.dayItems(d);
      return '<div class="weekcol rz ' + (d === t ? 'today' : '') + '" style="--n:' + (i + 1) + '"><button class="row between" style="width:100%" data-act="sPick" data-date="' + d + '"><span style="font-weight:700;font-size:17px">' + Z.fmt(d, { weekday: 'long' }) + ' <span class="dim" style="font-weight:600;font-size:14px">' + Z.d(d).getUTCDate() + '</span></span>' + (d === t ? '<span class="badge solid" style="--c:var(--acc)">Today</span>' : '') + '</button>' +
        (items.length ? items.map(function (it) { var cat = L.cat(it.cat); return '<button class="pillev" data-act="sOpen" data-src="' + it.src + '" data-id="' + it.ref.id + '" data-date="' + d + '" style="--c:' + cat.color + '"><span class="grow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.title) + '</span><small>' + (it.start || 'All day') + '</small></button>'; }).join('') : '<div class="small dim" style="margin-top:8px">Free</div>') + '</div>';
    }).join('') + '</div>';
  }

  function monthBody() {
    var cm = month || Z.monthStart(sel()), date = sel(), items = L.dayItems(date);
    return '<div class="card rz" style="--n:1"><div id="mgrid">' + U.monthGrid({
      month: cm, selected: date, cell: function (d) {
        var its = L.dayItems(d), cats = []; its.forEach(function (x) { if (cats.indexOf(x.cat) < 0) cats.push(x.cat); });
        return { inner: '<span class="dots">' + cats.slice(0, 3).map(function (c) { return '<i style="--c:' + L.cat(c).color + '"></i>'; }).join('') + '</span>' };
      }
    }) + '</div></div><div class="card rz" style="--n:2"><div class="head"><h3>' + Z.fmtLong(date) + '</h3><button class="iconbtn sm" data-act="addEvent" data-arg="' + date + '" aria-label="Add event">' + ic('plus') + '</button></div>' +
      (items.length ? timeline(items, date) : '<p class="muted small">Nothing scheduled.</p>') + '</div>';
  }

  function agendaBody() {
    var t = Z.today(), html = '', any = false;
    for (var i = 0; i < 21; i++) {
      var d = Z.addDays(t, i), items = L.dayItems(d); if (!items.length) continue; any = true;
      html += '<div class="card rz" style="--n:' + Math.min(i, 8) + '"><div class="head"><h3>' + Z.rel(d) + '</h3><span class="small dim">' + Z.fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }) + '</span></div>' + timeline(items, d).replace('class="tl"', 'class="tl"') + '</div>';
    }
    return any ? '<div class="cols">' + html + '</div>' : '<div class="card">' + U.empty('calendar-days', 'Nothing coming up', 'The next three weeks are clear. Add classes, deadlines or plans.', { act: 'addEvent', label: 'Add event', icon: 'calendar-plus' }) + '</div>';
  }

  function nav() {
    var date = sel(), label;
    if (mode === 'day') label = date === Z.today() ? 'Today' : Z.fmt(date, { weekday: 'long', day: 'numeric', month: 'short' });
    else if (mode === 'week') { var ws = Z.weekStart(date); label = Z.fmt(ws) + ' – ' + Z.fmt(Z.addDays(ws, 6)); }
    else if (mode === 'month') label = Z.fmtMonth(month || Z.monthStart(date)); else label = 'Next 3 weeks';
    var strip = '';
    if (mode === 'day') {
      var ws2 = Z.weekStart(date), t = Z.today();
      strip = '<div class="stripdays rz" style="--n:1;margin-top:12px">' + Z.range(ws2, Z.addDays(ws2, 6)).map(function (d) {
        return '<button class="' + (d === date ? 'on ' : '') + (d === t ? 'today ' : '') + (L.dayItems(d).length ? 'has' : '') + '" data-act="sPick" data-date="' + d + '" aria-label="' + Z.fmtLong(d) + '"><span>' + Z.fmtDow(d).slice(0, 3) + '</span><b>' + Z.d(d).getUTCDate() + '</b><i></i></button>';
      }).join('') + '</div>';
    }
    return '<div class="row between rz" style="--n:1;margin-top:14px"><h2 id="slabel" style="font-size:20px;font-weight:700;letter-spacing:-.025em">' + esc(label) + '</h2>' +
      (mode !== 'agenda' ? '<div class="row" style="gap:6px"><button class="btn sm" data-act="sToday">Today</button><button class="iconbtn sm glass" data-act="sStep" data-d="-1" aria-label="Previous">' + ic('chevron-left') + '</button><button class="iconbtn sm glass" data-act="sStep" data-d="1" aria-label="Next">' + ic('chevron-right') + '</button></div>' : '') + '</div>' + strip;
  }
  function body() { return mode === 'day' ? dayBody() : mode === 'week' ? weekBody() : mode === 'month' ? monthBody() : agendaBody(); }

  function paint(dir) {
    var host = Z.$('#sbodywrap'); if (!host) return Z.refresh();
    U.closeMenu(); Z.entering = false;
    Z.$('#snav').innerHTML = nav();
    var b = Z.$('#sbody'); b.className = 'cols ' + (dir > 0 ? 'slide-l' : dir < 0 ? 'slide-r' : 'fade-swap'); b.innerHTML = body();
    var sb = Z.$('#sbody'); sb.classList.remove('entering'); hook(); document.title = 'Schedule · ZERO OS';
  }
  function hook() {
    var g = Z.$('#mgrid'); if (g) g.addEventListener('click', function (e) { var d = e.target.closest('[data-date]'); if (d) { var dir = d.dataset.date > sel() ? 1 : -1; selDate = d.dataset.date; if (d.classList.contains('out')) month = Z.monthStart(selDate); paint(dir); } });
  }

  var A = Z.actions;
  A.sPick = function (el) { var d = el.dataset.date, dir = d > sel() ? 1 : -1; selDate = d; if (mode === 'week') { mode = 'day'; Z.refresh(true); return; } paint(dir); };
  A.sToday = function () { var dir = Z.today() > sel() ? 1 : -1; selDate = Z.today(); month = Z.monthStart(selDate); paint(dir); };
  A.sStep = function (el) {
    var n = +el.dataset.d;
    if (mode === 'day') selDate = Z.addDays(sel(), n); else if (mode === 'week') selDate = Z.addDays(sel(), 7 * n);
    else { month = Z.addMonths(month || Z.monthStart(sel()), n); selDate = month; }
    paint(n);
  };
  A.sOpen = function (el) {
    var id = el.dataset.id, date = el.dataset.date;
    if (el.dataset.src === 'uni') { var u = S.get('uni', id); if (u && F.uni) F.uni(u); return; }
    var e = S.get('events', id); if (e) F.event(e, { date: date });
  };
  Z.itemOpen = A.sOpen;

  Z.views.schedule = {
    title: 'Schedule', area: 'schedule',
    render: function () {
      return Z.hd({ eyebrow: 'Time', title: 'Schedule', sub: Z.fmtLong(Z.today()) }) +
        '<div class="rz" style="--n:1">' + U.seg('sseg', [{ v: 'day', label: 'Day' }, { v: 'week', label: 'Week' }, { v: 'month', label: 'Month' }, { v: 'agenda', label: 'Agenda' }], mode) + '</div>' +
        '<div id="snav">' + nav() + '</div><div id="sbodywrap" style="margin-top:14px"><div id="sbody" class="cols">' + body() + '</div></div>';
    },
    mount: function (root) {
      hook();
      U.bindSeg(root, 'sseg', function (v) { mode = v; if (v === 'month') month = Z.monthStart(sel()); paint(0); });
    },
    fab: function () { F.event(null, { date: sel() }); },
    goto: function (d) { selDate = d; month = Z.monthStart(d); }
  };
})();
