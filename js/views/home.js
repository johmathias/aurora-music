/* ZERO OS — Home: a calm overview. Details live inside each section. */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc, F = Z.forms;

  function clock() {
    var n = Z.nowMin(); return Z.tm(n);
  }
  function card(n, cls, inner, act) { return '<section class="card ' + (cls || '') + ' rz" style="--n:' + n + '"' + (act ? ' data-act="go" data-arg="' + act + '" role="button" tabindex="0"' : '') + '>' + inner + '</section>'; }
  function head(icon, label, link, to) { return '<div class="head"><div class="label">' + ic(icon) + label + '</div>' + (link ? '<button class="link" data-act="go" data-arg="' + to + '">' + link + ic('chevron-right') + '</button>' : '') + '</div>'; }

  function top() {
    return '<div class="row between rz" style="--n:0;padding:4px 2px 10px"><div class="row" style="gap:8px">' + Z.syncPill() + '</div><div class="row" style="gap:8px"><button class="iconbtn glass" data-act="go" data-arg="journal" aria-label="Journal">' + ic('book-open') + '</button><button class="iconbtn glass" data-act="go" data-arg="settings" aria-label="Settings">' + ic('settings') + '</button></div></div>';
  }
  function hero() {
    var st = Z.settings(), t = Z.today(), hb = L.dayHabits(t), tasks = L.todayTasks();
    var tasksDoneToday = L.tasks().filter(function (x) { return x.done && x.doneAt && Z.ds(new Date(x.doneAt + 3 * 3600e3)) === t; }).length;
    var taskTotal = tasks.length + tasksDoneToday, chal = L.challenge(), rings = [];
    rings.push({ value: hb.rate, color: '#FF6B3D' }); rings.push({ value: taskTotal ? tasksDoneToday / taskTotal : 0, color: '#B565F5' });
    rings.push({ value: chal && !chal.notStarted && !chal.finished ? (chal.doneToday ? 1 : 0) : 0, color: '#FFC93D' });
    var name = st.name ? esc(st.name) : 'there';
    return '<section class="card hero rz" style="--n:1;padding:20px 20px 18px"><div class="row" style="gap:16px;align-items:center"><div class="grow"><div class="greet-time">' + Z.greeting() + ',</div><h1 style="font-size:clamp(30px,9vw,38px);font-weight:760;letter-spacing:-.035em;line-height:1.05;margin:2px 0 6px">' + name + '</h1>' +
      '<div class="small dim">' + (st.showTime ? '<span class="num" id="hclock">' + clock() + '</span> · ' : '') + Z.fmt(t, { weekday: 'short', day: 'numeric', month: 'short' }) + '</div></div>' +
      Z.concentricRings(rings, 92) + '</div>' +
      '<div class="row small" style="gap:14px;margin-top:12px;flex-wrap:wrap"><span><b style="color:#FF6B3D">' + hb.done + '/' + hb.total + '</b> <span class="muted">habits</span></span><span><b style="color:#B565F5">' + tasksDoneToday + '/' + taskTotal + '</b> <span class="muted">tasks</span></span>' +
      (chal && !chal.notStarted && !chal.finished ? '<span><b style="color:#FFC93D">' + (chal.doneToday ? 'Done' : 'Day ' + chal.dayNo) + '</b> <span class="muted">challenge</span></span>' : '') + '</div>' +
      '<div class="msgcard" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)"><span class="q">' + ic('quote') + '</span><div class="grow"><div id="dmsg">' + esc(Z.motivation.today()) + '</div></div></div>' +
      '<div class="row" style="gap:8px;margin-top:12px"><button class="btn sm grow" data-act="urge">' + ic('wind') + 'I need a pause</button><button class="btn sm ghost" data-act="moreMsg" aria-label="Another message">' + ic('refresh-cw') + '</button></div></section>';
  }
  function attention() {
    var list = L.attention(); if (!list.length) return '';
    return card(2, '', '<div class="head"><div class="label" style="color:var(--warn)">' + ic('triangle-alert') + 'Needs attention</div><span class="badge" style="--c:var(--warn)">' + list.length + '</span></div><div class="attn">' + list.map(function (a) {
      return '<button data-act="' + a.act + '"' + (a.arg ? ' data-arg="' + a.arg + '"' : '') + (a.date ? ' data-date="' + a.date + '"' : '') + '><span class="ai" style="--c:' + a.color + '">' + ic(a.icon) + '</span><div class="grow" style="min-width:0"><div class="at">' + esc(a.title) + '</div><div class="as">' + esc(a.sub) + '</div></div>' + ic('chevron-right') + '</button>';
    }).join('') + '</div>');
  }
  function moneyCard() {
    var accs = L.accounts();
    if (!accs.length) return card(3, '', head('wallet', 'Money', null) + '<p class="muted small" style="margin-bottom:12px">Add an account like Cash or M-Pesa, then record what comes in and goes out.</p><button class="btn sm primary" data-act="addAccount">' + ic('plus') + 'Add account</button>');
    var t = Z.today(), ms = Z.monthStart(t), me = Z.monthEnd(t), day = L.summary(t, t), sum = L.summary(ms, me), bud = L.budgetStatus(ms).filter(function (b) { return !b.b.category; })[0];
    var recent = L.transactions().slice(0, 3);
    var inner = head('wallet', 'Money', 'Open', 'money') + '<div class="big" style="font-size:32px;margin-bottom:12px" data-act="go" data-arg="money">' + U.count(L.totalBalance(), 'money') + '<span class="small dim" style="font-size:12px;margin-left:8px;font-weight:500">balance</span></div>' +
      '<div class="mstrip"><div><div class="lbl">Spent today</div><div class="val">' + Z.money(day.expense, { compact: true }) + '</div></div><div><div class="lbl">This month</div><div class="val">' + Z.money(sum.expense, { compact: true, bare: true }) + '</div></div><div><div class="lbl">' + (bud ? (bud.over ? 'Over by' : 'Budget left') : 'Earned') + '</div><div class="val ' + (bud ? (bud.over ? 'bad' : '') : 'good') + '">' + (bud ? Z.money(bud.over ? -bud.left : bud.left, { compact: true, bare: true }) : Z.money(sum.income, { compact: true, bare: true })) + '</div></div></div>';
    if (bud) inner += '<div style="margin-top:10px">' + U.bar(Math.min(100, bud.pct * 100), bud.over ? '#FF6B8A' : '#34D399') + '</div>';
    if (recent.length) inner += '<div class="list" style="margin-top:12px">' + recent.map(Z.txRow).join('') + '</div>';
    inner += '<div class="row" style="gap:8px;margin-top:12px"><button class="btn sm primary grow" data-act="hSpend">' + ic('minus') + 'Spend</button><button class="btn sm grow" data-act="hEarn">' + ic('plus') + 'Income</button></div>';
    return card(3, '', inner);
  }
  function scheduleCard() {
    var t = Z.today(), items = L.dayItems(t), now = Z.nowMin();
    var upcoming = items.filter(function (x) { return !x.start || (Z.toMin(x.end) != null ? Z.toMin(x.end) : Z.toMin(x.start) + 30) > now; });
    var inner = head('calendar', 'Today’s schedule', 'Open', 'schedule');
    if (!items.length) return card(4, '', inner + '<p class="muted small">Nothing planned today. <button class="link" data-act="addEvent">Add event</button></p>');
    var show = (upcoming.length ? upcoming : items).slice(0, 3);
    inner += '<div class="tl">' + show.map(function (it) { var s = Z.toMin(it.start), e = Z.toMin(it.end), state = ''; if (s != null) { var end = e != null ? e : s + 30; if (end <= now) state = 'past'; else if (s <= now) state = 'now'; } return Z.itemBox(it, 0, state); }).join('') + '</div>';
    if (upcoming.length > 3) inner += '<button class="link" style="margin-top:8px" data-act="go" data-arg="schedule">+ ' + (upcoming.length - 3) + ' more today</button>';
    if (!upcoming.length) inner += '<div class="small dim" style="margin-top:8px">That’s everything for today.</div>';
    return card(4, '', inner);
  }
  function tasksCard() {
    var all = L.todayTasks(), tasks = all.slice(0, 3), inner = head('target', 'Today’s priorities', 'All', 'plans');
    if (!tasks.length) return card(5, '', inner + '<p class="muted small">' + (L.tasks().length ? 'Nothing due today.' : 'No tasks yet.') + ' <button class="link" data-act="addTask">Add task</button></p>');
    inner += '<div class="list">' + tasks.map(function (t) {
      var p = Z.PRIORITY[t.priority || 2];
      return '<div class="item"><button class="check" style="--c:' + p.color + '" data-act="tToggle" data-id="' + t.id + '" aria-label="Complete ' + esc(t.title) + '">' + ic('check') + '</button><button class="grow" data-act="tEdit" data-id="' + t.id + '" style="text-align:left;display:block;min-width:0"><div class="ti">' + esc(t.title) + '</div><div class="su">' + esc(t.cat || 'Personal') + (t.due < Z.today() ? ' · <span class="bad">' + Z.rel(t.due) + '</span>' : '') + '</div></button></div>';
    }).join('') + '</div>' + (all.length > 3 ? '<button class="link" style="margin-top:6px" data-act="go" data-arg="plans">+ ' + (all.length - 3) + ' more</button>' : '');
    return card(5, '', inner);
  }
  function habitsCard() {
    var t = Z.today(), hb = L.dayHabits(t), c = L.challenge();
    if (!L.habits().length && !c) return card(6, '', head('flame', 'Habits', null) + '<p class="muted small">Small actions, done daily. <button class="link" data-act="addHabit">Create a habit</button></p>');
    var inner = head('flame', 'Habits', 'Open', 'habits');
    if (hb.total) inner += '<div class="pills">' + hb.list.map(function (h) {
      var d = L.isDone(h, t);
      return '<button class="pill2 ' + (d ? 'done' : '') + '" data-act="hHomeToggle" data-id="' + h.id + '" aria-pressed="' + d + '"><span class="check ' + (d ? 'on' : '') + '" style="--c:' + (h.color || '#FF6B3D') + '">' + ic('check') + '</span>' + esc(h.name) + '</button>';
    }).join('') + '</div>'; else if (L.habits().length) inner += '<p class="muted small">No habits scheduled for today.</p>';
    if (c && !c.notStarted && !c.finished) inner += '<div class="row" style="gap:12px;margin-top:' + (hb.total ? 14 : 0) + 'px"><div class="grow"><div style="font-weight:650">' + esc(c.name) + ' · day ' + c.dayNo + '/' + c.days + '</div><div class="bar" style="margin-top:6px"><i style="width:' + c.pct + '%;background:#FFC93D"></i></div></div>' + (c.doneToday ? '<span class="badge good">Done</span>' : '<button class="btn sm primary" data-act="cDay" data-date="' + t + '">Check in</button>') + '</div>';
    return card(6, '', inner);
  }
  function comingCard() {
    var list = L.upcomingDeadlines(2, 30), gs = L.activeGoals().slice(0, 2), parts = '';
    if (!list.length && !gs.length) return '';
    parts += list.map(function (u) {
      var c = L.courseOf(u.courseId), n = Z.diff(Z.today(), u.date), col = u.kind === 'exam' ? '#FF5C6C' : '#FFC93D';
      return '<button class="item tap" data-act="uEdit" data-id="' + u.id + '"><span class="avatar" style="--c:' + col + '">' + ic(u.kind === 'exam' ? 'pen-line' : 'file-text') + '</span><div class="grow"><div class="ti">' + esc(u.title) + '</div><div class="su">' + esc(c ? c.code || c.name : '') + '</div></div><span class="badge" style="--c:' + (n <= 2 ? 'var(--bad)' : n <= 7 ? 'var(--warn)' : 'var(--ink2)') + '">' + (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n + 'd') + '</span></button>';
    }).join('');
    parts += gs.map(function (g) { var p = L.goalProgress(g); return '<div class="item" data-act="go" data-arg="plans"><div class="grow"><div class="row between small" style="margin-bottom:6px"><span style="font-weight:620">' + esc(g.title) + '</span><b>' + Math.round(p.pct * 100) + '%</b></div>' + U.bar(p.pct * 100, '#B565F5') + '</div></div>'; }).join('');
    return card(7, '', head('graduation-cap', 'Coming up', 'Plans', 'plans') + '<div class="list">' + parts + '</div>');
  }
  function moodCard() {
    var j = S.get('journal', 'j_' + Z.today());
    return card(8, '', '<div class="row between" style="margin-bottom:10px"><div class="label" style="display:flex;gap:8px;align-items:center;font-weight:650">' + ic('book-open') + 'How are you feeling?</div><button class="link" data-act="hJournal">' + ((j && (j.text || '').trim()) ? 'Continue' : 'Write') + ic('chevron-right') + '</button></div>' +
      '<div class="row" style="gap:8px;justify-content:space-between">' + Z.MOODS.map(function (m) { return '<button class="iconbtn" style="border:1px solid ' + (j && j.mood === m.v ? m.color : 'var(--line)') + ';background:' + (j && j.mood === m.v ? m.color + '26' : 'var(--card)') + ';color:' + (j && j.mood === m.v ? m.color : 'var(--ink3)') + '" data-act="jQuickMood" data-m="' + m.v + '" aria-label="Mood: ' + m.label + '">' + ic(m.icon) + '</button>'; }).join('') + '</div>');
  }
  function start() {
    return card(2, '', '<div class="head"><div class="label">' + ic('sparkles') + 'Let’s begin</div></div><p class="muted small" style="margin-bottom:12px">Start with one thing. Everything else can wait.</p><div class="grid2"><button class="btn" data-act="addTask">' + ic('list-checks') + 'Task</button><button class="btn" data-act="addHabit">' + ic('flame') + 'Habit</button><button class="btn" data-act="addEvent">' + ic('calendar-plus') + 'Event</button><button class="btn" data-act="addAccount">' + ic('wallet') + 'Account</button></div>');
  }

  Z.actions.hSpend = function () { F.tx(null, { type: 'expense' }); };
  Z.actions.hEarn = function () { F.tx(null, { type: 'income' }); };
  Z.actions.hJournal = function () { Z.openJournal(Z.today()); };
  Z.actions.hHomeToggle = function (el) {
    var h = S.get('habits', el.dataset.id); if (!h) return; var now = L.toggleHabit(h, Z.today());
    if (now) { el.classList.add('on', 'pulse'); var r = L.dayHabits(Z.today()); if (r.total && r.done === r.total) setTimeout(function () { U.celebrate('All habits done', 'A great day so far.', 'sparkles'); }, 350); }
  };

  Z.views.home = {
    title: 'Home', area: 'home',
    render: function () {
      var empty = !L.hasAnyData();
      return top() + hero() + (empty ? start() : attention() + moneyCard() + scheduleCard() + tasksCard() + habitsCard() + comingCard() + moodCard());
    },
    mount: function () { },
    onTick: function () { var c = Z.$('#hclock'); if (c) { c.textContent = clock(); return false; } return true; },
    fab: function (el) { F.quickAdd(el); }
  };
})();
