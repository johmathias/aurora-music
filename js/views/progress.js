/* ZERO OS — Progress: weekly and monthly overview built only from your real data */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc;
  var mode = 'week', anchor = null;
  var TC = { habit: '#FF6B3D', study: '#B565F5', task: '#3DB8FF' };

  function tsDate(ts) { return Z.ds(new Date(ts + 3 * 3600e3)); }
  function period() {
    var t = Z.today(), a = anchor || (mode === 'week' ? Z.weekStart(t) : Z.monthStart(t));
    if (mode === 'week') a = Z.weekStart(a); else a = Z.monthStart(a);
    var b = mode === 'week' ? Z.addDays(a, 6) : Z.monthEnd(a), pa = mode === 'week' ? Z.addDays(a, -7) : Z.addMonths(a, -1), pb = mode === 'week' ? Z.addDays(a, -1) : Z.monthEnd(pa);
    return { a: a, b: b, pa: pa, pb: pb, label: mode === 'week' ? Z.fmt(a) + ' – ' + Z.fmt(b) : Z.fmtMonth(a), isCurrent: t >= a && t <= b };
  }
  function tasksDoneIn(a, b) { return L.tasks().filter(function (x) { if (!x.done || !x.doneAt) return false; var d = tsDate(x.doneAt); return d >= a && d <= b; }).length; }
  function tasksOpenDue(a, b) { return L.openTasks().filter(function (x) { return x.due && x.due >= a && x.due <= b; }).length; }
  function delta(cur, prev, suffix) {
    if (prev === 0 && cur === 0) return ''; var d = Math.round(cur - prev); if (d === 0) return '<span class="badge">same as before</span>';
    return '<span class="badge" style="--c:' + (d > 0 ? 'var(--good)' : 'var(--warn)') + '">' + ic(d > 0 ? 'trending-up' : 'trending-down') + (d > 0 ? '+' : '') + d + (suffix || '') + '</span>';
  }
  // Apple-Fitness-style concentric rings
  function rings(list, size) {
    var s = size, st = Math.max(7, Math.round(s / 8)), gap = Math.max(3, Math.round(s / 24)), svg = '';
    list.forEach(function (r, i) {
      var rad = (s - st) / 2 - i * (st + gap), c = 2 * Math.PI * rad;
      svg += '<circle class="tr" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + rad + '" stroke-width="' + st + '" style="stroke:' + r.color + '22;fill:none"/><circle class="pg" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + rad + '" stroke-width="' + st + '" stroke="' + r.color + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" data-v="' + Z.clamp(r.value, 0, 1) + '" data-c="' + c + '" style="--rc:' + r.color + ';transition-delay:' + i * 150 + 'ms"/>';
    });
    return '<div class="ring" style="width:' + s + 'px;height:' + s + 'px"><svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">' + svg + '</svg></div>';
  }
  Z.concentricRings = rings;

  function body() {
    var p = period(), t = Z.today();
    var hr = L.rangeRate(p.a, p.b), hp = L.rangeRate(p.pa, p.pb), studyMin = L.studyMinutes(p.a, p.b), target = (Number(Z.settings().studyTargetHours) || 10) * 60 * (mode === 'week' ? 1 : 4.3);
    var done = tasksDoneIn(p.a, p.b), open = tasksOpenDue(p.a, p.b), taskPct = done + open ? done / (done + open) : 0, dl = L.uniItems().filter(function (u) { return (u.kind === 'assignment' || u.kind === 'exam') && u.done && u.date >= p.a && u.date <= p.b; }).length;
    var money = L.summary(p.a, p.b), moneyPrev = L.summary(p.pa, p.pb), jr = S.all('journal').filter(function (j) { return j.date >= p.a && j.date <= p.b && (j.text || j.mood); }).length;
    var chal = L.challenge(), chalIn = chal ? Z.range(p.a, p.b > t ? t : p.b).filter(function (d) { return chal.logs[d] && chal.logs[d].done; }).length : 0;
    var any = hr.due || done || studyMin || dl || money.income || money.expense || jr || chalIn;
    var html = '';
    html += '<div class="row between rz" style="--n:1"><button class="iconbtn sm glass" data-act="pStep" data-d="-1" aria-label="Previous">' + ic('chevron-left') + '</button><div style="text-align:center"><h3 style="font-size:19px">' + p.label + '</h3>' + (p.isCurrent ? '<div class="xs dim">Current ' + mode + '</div>' : '<button class="link" data-act="pNow" style="font-size:12px">Back to current</button>') + '</div><button class="iconbtn sm glass" data-act="pStep" data-d="1" aria-label="Next" ' + (p.isCurrent ? 'disabled style="opacity:.35"' : '') + '>' + ic('chevron-right') + '</button></div>';
    if (!any && !L.hasAnyData()) return html + '<div class="card rz" style="--n:2">' + U.empty('activity', 'Your progress will appear here', 'Complete a habit, finish a task, log a study session or record spending — then come back to see how you’re doing.', { act: 'go', arg: 'habits', label: 'Start with a habit', icon: 'flame' }) + '</div>';
    html += '<section class="card hero rz" style="--n:2"><div class="hero-rings">' + rings([{ value: hr.rate, color: TC.habit }, { value: studyMin / target, color: TC.study }, { value: taskPct, color: TC.task }], 140) +
      '<div class="grow stack sm"><div><div class="label" style="color:' + TC.habit + '">Habits</div><div class="mid" style="font-size:22px">' + Math.round(hr.rate * 100) + '%</div></div><div><div class="label" style="color:' + TC.study + '">Study</div><div class="mid" style="font-size:22px">' + (studyMin / 60).toFixed(1) + '<span class="dim" style="font-size:13px"> h</span></div></div><div><div class="label" style="color:' + TC.task + '">Tasks</div><div class="mid" style="font-size:22px">' + done + '<span class="dim" style="font-size:13px"> done</span></div></div></div></div></section>';
    html += '<div class="kpis rz" style="--n:3"><div class="kpi"><div class="label">Habit completion</div><div class="v">' + hr.done + '<span class="dim" style="font-size:14px"> / ' + hr.due + '</span></div><div style="margin-top:8px">' + delta(hr.rate * 100, hp.rate * 100, '%') + '</div></div>' +
      '<div class="kpi"><div class="label">Deadlines met</div><div class="v">' + dl + '</div></div>' +
      '<div class="kpi"><div class="label">Challenge days</div><div class="v">' + (chal ? chalIn : '—') + '</div></div><div class="kpi"><div class="label">Journal entries</div><div class="v">' + jr + '</div></div></div>';
    // summary text from real numbers
    var lines = [];
    if (hr.due) lines.push('You completed <b>' + Math.round(hr.rate * 100) + '%</b> of your habits (' + hr.done + ' of ' + hr.due + ').');
    if (done) lines.push('You finished <b>' + done + '</b> task' + (done > 1 ? 's' : '') + (open ? ', with ' + open + ' still open for this period' : '') + '.');
    if (studyMin) lines.push('You studied <b>' + (studyMin / 60).toFixed(1) + ' hours</b>.');
    if (money.income || money.expense) lines.push('Cash flow was <b class="' + (money.net >= 0 ? 'good' : 'bad') + '">' + Z.money(money.net, { plus: true }) + '</b> (' + Z.money(money.income, { compact: true, bare: true }) + ' in, ' + Z.money(money.expense, { compact: true, bare: true }) + ' out).');
    if (chalIn) lines.push('You checked in <b>' + chalIn + '</b> day' + (chalIn > 1 ? 's' : '') + ' on your challenge.');
    if (lines.length) html += '<section class="card rz" style="--n:4"><div class="head"><div class="label">' + ic('sparkles') + (mode === 'week' ? 'Week' : 'Month') + ' in review</div></div><div class="stack sm">' + lines.map(function (l) { return '<div style="color:var(--ink2);line-height:1.45">' + l + '</div>'; }).join('') + '</div></section>';
    html += '<section class="card rz" style="--n:5"><div class="head"><div class="label">' + ic('flame') + 'Habit trend</div></div><div class="chartbox"><canvas id="pc-habit"></canvas></div></section>';
    html += '<div class="grid2 rz" style="--n:6"><section class="card"><div class="head"><div class="label">Tasks done</div></div><div class="chartbox sm"><canvas id="pc-task"></canvas></div></section><section class="card"><div class="head"><div class="label">Study time</div></div><div class="chartbox sm"><canvas id="pc-study"></canvas></div></section></div>';
    if (money.income || money.expense || moneyPrev.expense) html += '<section class="card rz" style="--n:7"><div class="head"><div class="label">' + ic('wallet') + 'Money</div></div><div class="grid2"><div><div class="small dim">Spent</div><div class="mid">' + U.count(money.expense, 'money', 'data-compact="1"') + '</div><div style="margin-top:6px">' + delta(money.expense / 1000, moneyPrev.expense / 1000, 'K') + '</div></div><div><div class="small dim">Earned</div><div class="mid good">' + U.count(money.income, 'money', 'data-compact="1"') + '</div></div></div></section>';
    if (chal) html += '<section class="card rz" style="--n:8"><div class="row" style="gap:16px">' + U.ring({ size: 84, stroke: 10, value: chal.done / chal.days, color: '#FF6B3D', mid: '<div class="mid" style="position:static;font-size:17px;font-weight:720">' + chal.pct + '%</div>' }) + '<div class="grow"><div class="label">' + esc(chal.name) + '</div><div class="mid" style="font-size:20px;margin:6px 0 2px">' + chal.done + ' of ' + chal.days + ' days</div><div class="small dim">Best streak ' + chal.best + ' · ' + chal.remaining + ' days remaining</div></div></div></section>';
    var gs = L.activeGoals();
    if (gs.length) html += '<section class="card rz" style="--n:9"><div class="head"><div class="label">' + ic('target') + 'Goals</div><button class="link" data-act="go" data-arg="plans">Plans</button></div><div class="stack">' + gs.slice(0, 4).map(function (g) { var pg = L.goalProgress(g); return '<div><div class="row between small" style="margin-bottom:6px"><span style="font-weight:600">' + esc(g.title) + '</span><b>' + Math.round(pg.pct * 100) + '%</b></div>' + U.bar(pg.pct * 100, '#B565F5') + '</div>'; }).join('') + '</div></section>';
    html += achievements();
    return html;
  }
  function achievements() {
    var chal = L.challenge(), hs = L.habits(), best = hs.reduce(function (m, h) { return Math.max(m, L.habitBest(h)); }, 0), tDone = L.tasks().filter(function (t) { return t.done; }).length, jn = S.all('journal').length, sv = S.all('savings').filter(function (g) { return L.savingsProgress(g).pct >= 1; }).length;
    var list = [{ ok: best >= 7, icon: 'flame', t: '7-day habit streak' }, { ok: best >= 30, icon: 'zap', t: '30-day streak' }, { ok: tDone >= 10, icon: 'list-checks', t: '10 tasks done' }, { ok: tDone >= 50, icon: 'medal', t: '50 tasks done' },
      { ok: !!chal && chal.done >= 7, icon: 'mountain', t: 'Challenge week' }, { ok: !!chal && chal.done >= 50, icon: 'trophy', t: 'Challenge halfway' }, { ok: jn >= 7, icon: 'book-open', t: '7 journal entries' }, { ok: sv > 0, icon: 'piggy-bank', t: 'Savings goal met' }];
    return '<section class="card rz" style="--n:9"><div class="head"><div class="label">' + ic('award') + 'Achievements · ' + list.filter(function (x) { return x.ok; }).length + '/' + list.length + '</div></div><div class="grid3" style="grid-template-columns:repeat(4,1fr)">' + list.map(function (a) { return '<div class="ach ' + (a.ok ? 'on' : '') + '">' + ic(a.icon) + '<span style="font-size:11px;line-height:1.2">' + a.t + '</span></div>'; }).join('') + '</div></section>';
  }
  function draw(root) {
    var p = period(), end = p.b > Z.today() ? Z.today() : p.b, days = p.a <= end ? Z.range(p.a, p.b) : [], lab = days.map(function (d) { return mode === 'week' ? Z.fmtDow(d).slice(0, 2) : Z.d(d).getUTCDate(); });
    var h = Z.$('#pc-habit', root);
    if (h) { var data = days.map(function (d) { return d > Z.today() ? null : Math.round(L.dayHabits(d).rate * 100); });
      U.chart(h, { type: 'line', data: { labels: lab, datasets: [{ data: data, borderColor: TC.habit, backgroundColor: U.gradient(h, TC.habit, 220), fill: true, tension: .35, pointRadius: mode === 'week' ? 4 : 0, pointBackgroundColor: TC.habit, borderWidth: 3, spanGaps: false }] }, options: { plugins: { tooltip: { callbacks: { title: function (i) { return Z.fmt(days[i[0].dataIndex]); }, label: function (c) { return c.raw + '% of habits'; } } } }, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false }, ticks: { maxTicksLimit: 3, callback: function (v) { return v + '%'; } } }, x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 8 } } } } }); }
    var tk = Z.$('#pc-task', root);
    if (tk) { var byDay = {}; L.tasks().forEach(function (x) { if (x.done && x.doneAt) { var d = tsDate(x.doneAt); byDay[d] = (byDay[d] || 0) + 1; } });
      U.chart(tk, { type: 'bar', data: { labels: lab, datasets: [{ data: days.map(function (d) { return byDay[d] || 0; }), backgroundColor: TC.task, borderRadius: 5, borderSkipped: false }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 3 }, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false } }, x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6 } } } } }); }
    var st = Z.$('#pc-study', root);
    if (st) { var sd = {}; L.uniItems().forEach(function (u) { if (u.kind === 'study' && u.done) sd[u.date] = (sd[u.date] || 0) + (u.minutes || 0); });
      U.chart(st, { type: 'bar', data: { labels: lab, datasets: [{ data: days.map(function (d) { return Math.round((sd[d] || 0) / 6) / 10; }), backgroundColor: TC.study, borderRadius: 5, borderSkipped: false }] }, options: { plugins: { tooltip: { callbacks: { label: function (c) { return c.raw + ' h'; } } } }, scales: { y: { beginAtZero: true, ticks: { maxTicksLimit: 3 }, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false } }, x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6 } } } } }); }
  }

  var A = Z.actions;
  A.pStep = function (el) { var p = period(), n = +el.dataset.d; if (n > 0 && p.isCurrent) return; anchor = mode === 'week' ? Z.addDays(p.a, 7 * n) : Z.addMonths(p.a, n); Z.refresh(); };
  A.pNow = function () { anchor = null; Z.refresh(); };

  Z.views.progress = {
    title: 'Progress', area: 'progress',
    render: function () {
      return Z.hd({ eyebrow: 'Overview', title: 'Progress', sub: 'Real numbers, no pressure.' }) + '<div class="rz" style="--n:1;margin-bottom:16px">' + U.seg('prseg', [{ v: 'week', label: 'Weekly' }, { v: 'month', label: 'Monthly' }], mode) + '</div><div class="cols">' + body() + '</div>';
    },
    mount: function (root) { draw(root); U.bindSeg(root, 'prseg', function (v) { mode = v; anchor = null; Z.refresh(true); }); }
  };
})();
