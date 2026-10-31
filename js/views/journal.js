/* ZERO OS — Journal: calm writing space with autosave, mood, search and calendar browsing */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc;
  var mode = 'list', q = '', cm = null;

  function entries() { return S.all('journal').sort(function (a, b) { return b.date.localeCompare(a.date); }); }
  function jstreak() {
    var map = {}; S.all('journal').forEach(function (j) { if ((j.text || '').trim()) map[j.date] = 1; });
    var d = Z.today(), n = 0; if (!map[d]) d = Z.addDays(d, -1); while (map[d]) { n++; d = Z.addDays(d, -1); } return n;
  }
  function firstLine(t) { var l = (t || '').trim().split('\n')[0]; return l.length > 70 ? l.slice(0, 70) + '…' : l; }
  function moodIcon(v, size) { var m = Z.moodOf(v); return m ? '<span style="color:' + m.color + '">' + ic(m.icon) + '</span>' : ''; }

  function listBody() {
    var list = entries(), term = q.trim().toLowerCase();
    if (term) list = list.filter(function (j) { return (j.text || '').toLowerCase().indexOf(term) > -1; });
    if (!list.length) return '<div class="card rz" style="--n:3">' + (term ? U.empty('search', 'No matches', 'Nothing in your journal mentions “' + term + '”.') : U.empty('book-open', 'Your journal is empty', 'Write a few lines about your day. It’s private, saved automatically and only for you.', { act: 'jOpen', arg: Z.today(), label: 'Write today’s entry', icon: 'pen-line' })) + '</div>';
    var html = '', curMonth = '', n = 3;
    list.forEach(function (j) {
      var m = j.date.slice(0, 7);
      if (m !== curMonth) { if (curMonth) html += '</div></section>'; curMonth = m; html += '<section class="card rz" style="--n:' + Math.min(n++, 8) + '"><div class="head"><div class="label">' + Z.fmtMonth(m + '-01') + '</div></div><div class="list">'; }
      html += '<button class="item tap" data-act="jOpen" data-arg="' + j.date + '" style="align-items:flex-start"><div style="width:44px;text-align:center;flex:none"><div class="mid" style="font-size:24px">' + Z.d(j.date).getUTCDate() + '</div><div class="xs dim" style="text-transform:uppercase;letter-spacing:.05em">' + Z.fmtDow(j.date) + '</div></div><div class="grow" style="min-width:0"><div class="ti" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (esc(firstLine(j.text)) || '<span class="dim">Mood only</span>') + '</div><div class="su" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:normal">' + esc((j.text || '').trim().slice(firstLine(j.text).length).trim().slice(0, 160)) + '</div></div>' + moodIcon(j.mood) + '</button>';
    });
    return html + '</div></section>';
  }
  function calBody() {
    var month = cm || Z.monthStart(Z.today()), map = {}; S.all('journal').forEach(function (j) { map[j.date] = j; });
    return '<div class="card rz" style="--n:3"><div class="head"><button class="iconbtn sm" data-act="jMonth" data-d="-1" aria-label="Previous month">' + ic('chevron-left') + '</button><h3>' + Z.fmtMonth(month) + '</h3><button class="iconbtn sm" data-act="jMonth" data-d="1" aria-label="Next month">' + ic('chevron-right') + '</button></div><div id="jcal">' +
      U.monthGrid({ month: month, selected: '', cell: function (d) { var j = map[d], m = j && Z.moodOf(j.mood); return { style: j ? 'background:' + (m ? m.color + '33' : 'rgba(255,255,255,.1)') : '', inner: '<span class="dots">' + (j ? '<i style="--c:' + (m ? m.color : 'var(--acc)') + '"></i>' : '') + '</span>' }; } }) + '</div><div class="legend"><span>Tap any day to read or write</span></div></div>';
  }
  function body() {
    var td = S.get('journal', 'j_' + Z.today()), done = td && (td.text || '').trim();
    var html = '<section class="card hero rz" style="--n:1"><div class="label">' + (done ? 'Today’s entry' : 'Today') + '</div>' +
      (done ? '<div style="margin:10px 0 14px;font-family:ui-serif,Georgia,serif;font-size:18px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + esc(td.text) + '</div>' : '<div class="mid" style="margin:10px 0 4px">How was today?</div><div class="small muted" style="margin-bottom:14px">A few honest lines is enough.</div>') +
      '<div class="row"><button class="btn primary" data-act="jOpen" data-arg="' + Z.today() + '">' + ic(done ? 'pencil' : 'pen-line') + (done ? 'Continue writing' : 'Write') + '</button>' + (jstreak() > 1 ? '<span class="streak" style="margin-left:auto">' + ic('flame') + jstreak() + ' days</span>' : '') + '</div></section>';
    html += '<div class="rz" style="--n:2">' + U.seg('jseg', [{ v: 'list', label: 'Entries' }, { v: 'cal', label: 'Calendar' }], mode) + '</div>';
    if (mode === 'list') html += '<div class="search rz" style="--n:2">' + ic('search') + '<input class="input" id="jq" type="search" placeholder="Search your entries" value="' + esc(q) + '" aria-label="Search journal"></div>';
    return html + '<div id="jlist" class="cols">' + (mode === 'list' ? listBody() : calBody()) + '</div>';
  }

  /* ---------- editor (full-screen, calm) ---------- */
  var editor = null;
  function openEditor(date) {
    if (editor) closeEditor(true);
    var el = document.createElement('div'); el.className = 'backdrop show'; el.style.cssText = 'align-items:stretch;background:rgba(7,7,10,.82)';
    el.innerHTML = '<div class="jed glass" role="dialog" aria-modal="true" aria-label="Journal entry" style="width:100%;max-width:720px;margin:0 auto;display:flex;flex-direction:column;border-radius:0;height:100%;max-height:none;padding-top:calc(var(--safe-t) + 10px);animation:viewIn .5s var(--ease) both;background:linear-gradient(180deg,rgba(24,24,32,.97),rgba(12,12,16,.98))">' +
      '<div class="row between" style="padding:6px 16px 10px;gap:8px"><button class="btn sm" id="jdone">' + ic('check') + 'Done</button><span class="saved" id="jsaved"></span><div class="row" style="gap:4px"><button class="iconbtn sm" id="jdel" aria-label="Delete entry">' + ic('trash-2') + '</button></div></div>' +
      '<div style="padding:0 22px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;padding-bottom:calc(var(--safe-b) + 24px)"><div class="row between" style="margin-bottom:12px"><div><div class="eyebrow label" style="color:var(--acc)" id="jdow"></div><h2 id="jdate" style="font-size:28px;font-weight:740;letter-spacing:-.03em"></h2></div><label class="btn sm" style="cursor:pointer;position:relative">' + ic('calendar') + '<span>Change date</span><input type="date" id="jpick" max="' + Z.today() + '" style="position:absolute;inset:0;opacity:0;width:100%;cursor:pointer"></label></div>' +
      '<div class="moods" id="jmoods" style="margin-bottom:14px">' + Z.MOODS.map(function (m) { return '<button type="button" data-m="' + m.v + '" style="--c:' + m.color + '" aria-label="' + m.label + '">' + ic(m.icon) + m.label + '</button>'; }).join('') + '</div>' +
      '<textarea class="paper" id="jtext" placeholder="Write freely. This is just for you…" aria-label="Journal text" spellcheck="true"></textarea></div></div>';
    document.body.appendChild(el); document.body.classList.add('noscroll');
    var ta = Z.$('#jtext', el), saved = Z.$('#jsaved', el), timer = 0, cur = date, mood = 0, dirty = false;
    editor = { el: el, flush: flush, date: function () { return cur; } };
    function load(d) {
      cur = d; var j = S.get('journal', 'j_' + d); ta.value = j ? j.text || '' : ''; mood = j ? j.mood || 0 : 0; dirty = false;
      Z.$('#jdow', el).textContent = Z.fmt(d, { weekday: 'long' }); Z.$('#jdate', el).textContent = Z.fmt(d, { day: 'numeric', month: 'long', year: 'numeric' }); Z.$('#jpick', el).value = d;
      Z.$$('#jmoods button', el).forEach(function (b) { b.classList.toggle('on', +b.dataset.m === mood); }); saved.textContent = j ? 'Saved' : ''; saved.className = 'saved' + (j ? ' ok' : '');
      Z.$('#jdel', el).style.visibility = j ? 'visible' : 'hidden';
    }
    function flush() {
      clearTimeout(timer); if (!dirty) return; dirty = false; var text = ta.value;
      if (!text.trim() && !mood) { S.del('journal', 'j_' + cur); saved.textContent = ''; return; }
      S.put('journal', { id: 'j_' + cur, date: cur, text: text, mood: mood }); saved.innerHTML = ic('circle-check') + ' Saved'; saved.className = 'saved ok'; Z.$('#jdel', el).style.visibility = 'visible';
    }
    function mark() { dirty = true; saved.textContent = 'Saving…'; saved.className = 'saved'; clearTimeout(timer); timer = setTimeout(flush, 700); }
    ta.addEventListener('input', mark); ta.addEventListener('blur', flush);
    Z.$('#jmoods', el).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; mood = mood === +b.dataset.m ? 0 : +b.dataset.m; Z.$$('#jmoods button', el).forEach(function (x) { x.classList.toggle('on', +x.dataset.m === mood); }); mark(); });
    Z.$('#jpick', el).addEventListener('change', function () { if (this.value) { flush(); load(this.value); } });
    Z.$('#jdone', el).addEventListener('click', function () { closeEditor(); });
    Z.$('#jdel', el).addEventListener('click', function () { U.confirm({ title: 'Delete this entry?', text: Z.fmtLong(cur) + ' — this cannot be undone.', ok: 'Delete', danger: true }).then(function (y) { if (y) { dirty = false; S.del('journal', 'j_' + cur); closeEditor(true); U.toast('Entry deleted'); } }); });
    document.addEventListener('visibilitychange', onHide); function onHide() { if (document.visibilityState === 'hidden') flush(); } editor.off = function () { document.removeEventListener('visibilitychange', onHide); };
    load(date); if (!ta.value) setTimeout(function () { ta.focus(); }, 380);
  }
  function closeEditor(skipFlush) {
    if (!editor) return; var e = editor; editor = null; if (!skipFlush) e.flush(); e.off(); e.el.classList.remove('show');
    if (!document.querySelector('.backdrop.show')) document.body.classList.remove('noscroll'); setTimeout(function () { e.el.remove(); }, 400);
    if (Z.current() === 'journal') setTimeout(function () { Z.refresh(); }, 60);
  }
  Z.openJournal = openEditor;
  window.addEventListener('hashchange', function () { if (editor) closeEditor(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && editor && !document.querySelector('.backdrop.dialog-wrap')) closeEditor(); });

  var A = Z.actions;
  A.jOpen = function (el) { openEditor(el.dataset.arg || Z.today()); };
  A.jMonth = function (el) { cm = Z.addMonths(cm || Z.monthStart(Z.today()), +el.dataset.d); var l = Z.$('#jlist'); Z.entering = false; l.className = 'cols ' + (+el.dataset.d > 0 ? 'slide-l' : 'slide-r'); l.innerHTML = calBody(); hookCal(); };
  function hookCal() { var c = Z.$('#jcal'); if (c) c.addEventListener('click', function (e) { var d = e.target.closest('[data-date]'); if (d && d.dataset.date <= Z.today()) openEditor(d.dataset.date); }); }
  A.jQuickMood = function (el) {
    var v = +el.dataset.m, id = 'j_' + Z.today(), j = S.get('journal', id) || { id: id, date: Z.today(), text: '' };
    S.put('journal', Object.assign({}, j, { mood: j.mood === v ? 0 : v })); U.toast(j.mood === v ? 'Mood cleared' : 'Mood saved: ' + Z.moodOf(v).label);
  };

  Z.views.journal = {
    title: 'Journal', area: 'journal',
    render: function () { return Z.hd({ eyebrow: 'Reflect', title: 'Journal', sub: S.all('journal').length + ' entr' + (S.all('journal').length === 1 ? 'y' : 'ies') + ' · private to you', acts: '<button class="iconbtn glass" data-act="go" data-arg="home" aria-label="Home">' + ic('house') + '</button>' }) + '<div class="cols">' + body() + '</div>'; },
    mount: function (root) {
      hookCal();
      U.bindSeg(root, 'jseg', function (v) { mode = v; Z.refresh(true); });
      var inp = Z.$('#jq', root); if (inp) inp.addEventListener('input', function () { q = inp.value; clearTimeout(inp._t); inp._t = setTimeout(function () { Z.entering = false; var l = Z.$('#jlist'); l.innerHTML = listBody(); }, 160); });
    },
    onChange: function () { if (editor) return false; return true; },
    fab: function () { openEditor(Z.today()); }, fabIcon: 'pen-line'
  };
})();
