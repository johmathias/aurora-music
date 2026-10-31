/* ZERO OS — business logic: habits, challenge, events, tasks, goals, money.
   Pure functions that read from Z.store. No DOM here. */
(function () {
  'use strict';
  var Z = window.Z, S = Z.store;
  var L = Z.logic = {};

  /* ================= HABITS ================= */
  L.habits = function (includeArchived) {
    return S.all('habits').filter(function (h) { return includeArchived || !h.archived; })
      .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  };
  L.habitScheduled = function (h, date) {
    if (date < (h.startDate || '0000-00-00')) return false;
    return !h.days || !h.days.length || h.days.indexOf(Z.dow(date)) > -1;
  };
  L.habitDone = function (h, date) { return !!S.get('habitLogs', h.id + '_' + date); };
  L.toggleHabit = function (h, date) {
    var id = h.id + '_' + date, was = !!S.get('habitLogs', id);
    if (was) S.del('habitLogs', id); else S.put('habitLogs', { id: id, habitId: h.id, date: date });
    return !was;
  };
  var logIndex = null, logIndexVer = -1, ver = 0;
  S.onChange(function (c) { if (c.habitLogs) ver++; });
  function doneSet() {
    if (logIndex && logIndexVer === ver) return logIndex;
    logIndex = {}; S.all('habitLogs').forEach(function (l) { logIndex[l.id] = 1; }); logIndexVer = ver; return logIndex;
  }
  L.isDone = function (h, date) { return !!doneSet()[h.id + '_' + date]; };
  L.habitStreak = function (h) {
    var t = Z.today(), d = t, streak = 0, guard = 0;
    if (L.habitScheduled(h, t) && !L.isDone(h, t)) d = Z.addDays(t, -1);        // today not finished yet: don't break
    while (guard++ < 800 && d >= (h.startDate || '0000-00-00')) {
      if (L.habitScheduled(h, d)) { if (L.isDone(h, d)) streak++; else break; }
      d = Z.addDays(d, -1);
    }
    return streak;
  };
  L.habitBest = function (h) {
    var logs = S.all('habitLogs').filter(function (l) { return l.habitId === h.id; }).map(function (l) { return l.date; }).sort();
    if (!logs.length) return 0;
    var best = 0, run = 0, d = logs[0], end = Z.today(), guard = 0;
    while (d <= end && guard++ < 4000) {
      if (L.habitScheduled(h, d)) { if (L.isDone(h, d)) { run++; best = Math.max(best, run); } else run = 0; }
      d = Z.addDays(d, 1);
    }
    return best;
  };
  // completion of one habit between a and b (inclusive), only counting days that already happened
  L.habitRate = function (h, a, b) {
    var t = Z.today(), end = b > t ? t : b, start = a < (h.startDate || a) ? h.startDate : a, due = 0, done = 0;
    if (start > end) return { due: 0, done: 0, rate: 0 };
    Z.range(start, end).forEach(function (d) { if (L.habitScheduled(h, d)) { due++; if (L.isDone(h, d)) done++; } });
    return { due: due, done: done, rate: due ? done / due : 0 };
  };
  // all active habits on one day
  L.dayHabits = function (date) {
    var hs = L.habits().filter(function (h) { return L.habitScheduled(h, date); });
    var done = hs.filter(function (h) { return L.isDone(h, date); }).length;
    return { list: hs, total: hs.length, done: done, rate: hs.length ? done / hs.length : 0 };
  };
  L.rangeRate = function (a, b) {
    var due = 0, done = 0; var t = Z.today(); if (b > t) b = t; if (a > b) return { due: 0, done: 0, rate: 0 };
    Z.range(a, b).forEach(function (d) { var r = L.dayHabits(d); due += r.total; done += r.done; });
    return { due: due, done: done, rate: due ? done / due : 0 };
  };
  L.deleteHabit = function (h) {
    S.batch(function () {
      S.all('habitLogs').filter(function (l) { return l.habitId === h.id; }).forEach(function (l) { S.del('habitLogs', l.id); });
      S.del('habits', h.id);
    });
  };

  /* ================= BEHAVIOUR TRACKER ================= */
  L.behaviours = function () { return S.all('behaviours').filter(function (b) { return !b.archived; }).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }); };
  L.behaviourLogs = function (b) { return S.all('behaviourLogs').filter(function (l) { return l.behId === b.id; }); };
  // Gentle stats: current run since last slip, best run, total clean days. A slip never deletes anything.
  L.behaviourStats = function (b) {
    var logs = L.behaviourLogs(b), map = {}; logs.forEach(function (l) { map[l.date] = l; });
    var t = Z.today(), start = b.startDate || t, slips = logs.filter(function (l) { return l.status === 'slip'; }).map(function (l) { return l.date; }).sort();
    var lastSlip = slips.length ? slips[slips.length - 1] : null;
    var runFrom = lastSlip ? Z.addDays(lastSlip, 1) : start; if (runFrom < start) runFrom = start;
    var current = runFrom > t ? 0 : Z.diff(runFrom, t) + 1;
    if (map[t] && map[t].status === 'slip') current = 0;
    // total clean days = every day since start that is not a slip
    var total = 0, best = 0, run = 0;
    if (start <= t) Z.range(start, t).forEach(function (d) { if (map[d] && map[d].status === 'slip') { run = 0; } else { total++; run++; best = Math.max(best, run); } });
    var triggers = {}; logs.forEach(function (l) { (l.triggers || []).forEach(function (x) { triggers[x] = (triggers[x] || 0) + 1; }); });
    return { current: current, best: best, total: total, slips: slips.length, lastSlip: lastSlip, triggers: triggers, map: map, start: start, todayLog: map[t] };
  };
  L.TRIGGERS = ['Boredom', 'Stress', 'Tired', 'Alone', 'Late night', 'Social', 'Scrolling', 'Emotional'];

  /* ================= 100-DAY CHALLENGE ================= */
  L.challenge = function () {
    var c = Z.settings().challenge; if (!c || !c.startDate) return null;
    var t = Z.today(), days = c.days || 100, end = Z.addDays(c.startDate, days - 1);
    var logs = {}; S.all('challengeLogs').forEach(function (l) { logs[l.date] = l; });
    var doneDays = 0, i;
    for (i = 0; i < days; i++) { var d = Z.addDays(c.startDate, i); if (logs[d] && logs[d].done) doneDays++; }
    var dayNo = t < c.startDate ? 0 : Math.min(days, Z.diff(c.startDate, t) + 1);
    var elapsed = t < c.startDate ? 0 : Math.min(days, Z.diff(c.startDate, t) + 1);
    var run = 0, d2 = t > end ? end : t;
    if (!(logs[d2] && logs[d2].done)) d2 = Z.addDays(d2, -1);
    while (d2 >= c.startDate && logs[d2] && logs[d2].done) { run++; d2 = Z.addDays(d2, -1); }
    var best = 0, r = 0; for (i = 0; i < days; i++) { var dd = Z.addDays(c.startDate, i); if (logs[dd] && logs[dd].done) { r++; best = Math.max(best, r); } else r = 0; }
    return {
      name: c.name || '100-day challenge', goal: c.goal || '', startDate: c.startDate, days: days, endDate: end, logs: logs,
      dayNo: dayNo, done: doneDays, remaining: Math.max(0, days - dayNo), pct: Math.round(doneDays / days * 100),
      notStarted: t < c.startDate, finished: t > end, doneToday: !!(logs[t] && logs[t].done), streak: run, best: best,
      missed: Math.max(0, elapsed - doneDays - ((logs[t] && logs[t].done) || t > end ? 0 : 0))
    };
  };
  L.MILESTONES = [{ n: 1, label: 'First day', icon: 'sparkles' }, { n: 7, label: 'One week', icon: 'flame' }, { n: 14, label: 'Two weeks', icon: 'zap' }, { n: 30, label: '30 days', icon: 'medal' },
    { n: 50, label: 'Halfway', icon: 'mountain' }, { n: 75, label: '75 days', icon: 'star' }, { n: 100, label: 'Complete', icon: 'trophy' }];
  L.toggleChallengeDay = function (date) {
    var id = 'ch_' + date, was = S.get('challengeLogs', id);
    if (was && was.done) { S.del('challengeLogs', id); return false; }
    S.put('challengeLogs', { id: id, date: date, done: true }); return true;
  };

  /* ================= EVENTS ================= */
  L.eventOn = function (e, date) {
    if (e.exceptions && e.exceptions.indexOf(date) > -1) return false;
    if (!e.repeat || e.repeat === 'none') return e.date === date;
    if (date < e.date) return false; if (e.until && date > e.until) return false;
    if (e.repeat === 'daily') return true;
    if (e.repeat === 'weekdays') { var w = Z.dow(date); return w > 0 && w < 6; }
    if (e.repeat === 'weekly') return Z.dow(date) === Z.dow(e.date);
    if (e.repeat === 'monthly') return date.slice(8) === e.date.slice(8);
    return false;
  };
  L.eventsOn = function (date) {
    return S.all('events').filter(function (e) { return L.eventOn(e, date); })
      .sort(function (a, b) { return (Z.toMin(a.start) == null ? -1 : Z.toMin(a.start)) - (Z.toMin(b.start) == null ? -1 : Z.toMin(b.start)); });
  };
  L.eventsCount = function (date) { return L.eventsOn(date).length; };
  L.nextEvent = function () {
    var t = Z.today(), now = Z.nowMin(), i, d, list;
    for (i = 0; i < 30; i++) {
      d = Z.addDays(t, i); list = L.eventsOn(d);
      for (var j = 0; j < list.length; j++) {
        var s = Z.toMin(list[j].start), e = Z.toMin(list[j].end);
        if (i > 0 || s == null || (e != null ? e : s) >= now) return { ev: list[j], date: d };
      }
    }
    return null;
  };
  L.cat = function (k) { return Z.EVENT_CATS[k] || Z.EVENT_CATS.custom; };

  /* ================= TASKS & GOALS ================= */
  L.tasks = function () { return S.all('tasks'); };
  L.openTasks = function () { return L.tasks().filter(function (t) { return !t.done; }); };
  L.todayTasks = function () {
    var t = Z.today();
    return L.openTasks().filter(function (x) { return x.due && x.due <= t; })
      .sort(function (a, b) { return (b.priority || 2) - (a.priority || 2) || a.due.localeCompare(b.due); });
  };
  L.taskGroups = function (list) {
    var t = Z.today(), g = { overdue: [], today: [], upcoming: [], someday: [], done: [] };
    list.forEach(function (x) {
      if (x.done) g.done.push(x); else if (!x.due) g.someday.push(x); else if (x.due < t) g.overdue.push(x); else if (x.due === t) g.today.push(x); else g.upcoming.push(x);
    });
    var by = function (a, b) { return (b.priority || 2) - (a.priority || 2) || (a.due || '9').localeCompare(b.due || '9'); };
    ['overdue', 'today', 'upcoming', 'someday'].forEach(function (k) { g[k].sort(by); });
    g.done.sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
    return g;
  };
  L.toggleTask = function (t) { return S.put('tasks', Object.assign({}, t, { done: !t.done, doneAt: !t.done ? Date.now() : null })); };
  L.goalProgress = function (g) {
    var ms = g.milestones || [], tasks = L.tasks().filter(function (t) { return t.goalId === g.id; });
    var total = ms.length + tasks.length, done = ms.filter(function (m) { return m.done; }).length + tasks.filter(function (t) { return t.done; }).length;
    var manual = g.manualPct;
    var pct = total ? done / total : (manual != null ? manual / 100 : 0);
    if (g.status === 'done') pct = 1;
    return { pct: pct, done: done, total: total, tasks: tasks };
  };
  L.goals = function () { return S.all('goals').sort(function (a, b) { return (a.targetDate || '9').localeCompare(b.targetDate || '9'); }); };
  L.activeGoals = function () { return L.goals().filter(function (g) { return g.status !== 'done'; }); };

  /* ================= UNIVERSITY ================= */
  L.courses = function () { return S.all('courses').sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }); };
  L.uniItems = function () { return S.all('uni'); };
  L.EXAM_TYPES = { regular: 'Regular', supplementary: 'Supplementary', special: 'Special' };
  L.upcomingDeadlines = function (limit, days) {
    var t = Z.today(), horizon = Z.addDays(t, days || 60);
    var out = L.uniItems().filter(function (u) { return (u.kind === 'assignment' || u.kind === 'exam') && !u.done && u.date >= t && u.date <= horizon; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
    return limit ? out.slice(0, limit) : out;
  };
  L.studyMinutes = function (a, b) {
    return Z.sum(L.uniItems().filter(function (u) { return u.kind === 'study' && u.done && u.date >= a && u.date <= b; }), function (u) { return u.minutes || 0; });
  };
  L.courseOf = function (id) { return S.get('courses', id); };

  /* ================= MONEY ================= */
  L.accounts = function (includeArchived) { return S.all('accounts').filter(function (a) { return includeArchived || !a.archived; }).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }); };
  L.transactions = function () { return S.all('transactions').sort(function (a, b) { return b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0); }); };
  // Balance = opening + all income − expense, ± transfers. Always recomputed from the records, so edits/deletes stay correct.
  L.balances = function () {
    var bal = {}; L.accounts(true).forEach(function (a) { bal[a.id] = Number(a.opening) || 0; });
    S.all('transactions').forEach(function (t) {
      var amt = Number(t.amount) || 0;
      if (t.type === 'income') { if (t.accountId in bal) bal[t.accountId] += amt; }
      else if (t.type === 'expense') { if (t.accountId in bal) bal[t.accountId] -= amt; }
      else if (t.type === 'transfer') { if (t.accountId in bal) bal[t.accountId] -= amt; if (t.toAccountId in bal) bal[t.toAccountId] += amt; }
    });
    return bal;
  };
  L.totalBalance = function () { var b = L.balances(), t = 0; L.accounts().forEach(function (a) { t += b[a.id] || 0; }); return t; };
  // Income/expense summary for a date range. Transfers are excluded on purpose.
  L.summary = function (a, b, list) {
    var inc = 0, exp = 0, byCat = {};
    (list || S.all('transactions')).forEach(function (t) {
      if (t.date < a || t.date > b) return;
      if (t.type === 'income') inc += Number(t.amount) || 0;
      else if (t.type === 'expense') { exp += Number(t.amount) || 0; byCat[t.category || 'Other'] = (byCat[t.category || 'Other'] || 0) + (Number(t.amount) || 0); }
    });
    return { income: inc, expense: exp, net: inc - exp, byCat: byCat };
  };
  L.monthKeys = function (n) { var m = Z.monthStart(Z.today()), out = []; for (var i = n - 1; i >= 0; i--) out.push(Z.addMonths(m, -i)); return out; };
  L.budgetStatus = function (monthStart) {
    var end = Z.monthEnd(monthStart), sum = L.summary(monthStart, end);
    return S.all('budgets').map(function (b) {
      var spent = b.category ? (sum.byCat[b.category] || 0) : sum.expense, amt = Number(b.amount) || 0;
      return { b: b, spent: spent, amount: amt, left: amt - spent, pct: amt ? spent / amt : 0, over: spent > amt };
    }).sort(function (a, b) { return (a.b.category ? 1 : 0) - (b.b.category ? 1 : 0) || b.pct - a.pct; });
  };
  L.savingsProgress = function (g) {
    var saved = Z.sum(g.contributions || [], function (c) { return Number(c.amount) || 0; });
    return { saved: saved, pct: g.target ? Math.min(1, saved / g.target) : 0, left: Math.max(0, (g.target || 0) - saved) };
  };
  L.accountName = function (id) { var a = S.get('accounts', id); return a ? a.name : 'Deleted account'; };
  L.accIcon = function (type) { var f = Z.ACCOUNT_TYPES.filter(function (x) { return x.v === type; })[0]; return f ? f.icon : 'wallet'; };
  L.accColor = function (a, i) { return a.color || Z.CAT_COLORS[(i || 0) % Z.CAT_COLORS.length]; };

  /* ================= PROGRESS ================= */
  L.weekSummary = function (weekStart) {
    var end = Z.addDays(weekStart, 6), t = Z.today();
    var h = L.rangeRate(weekStart, end);
    var tasksDone = L.tasks().filter(function (x) { return x.done && x.doneAt && Z.ds(new Date(x.doneAt + 3 * 3600e3)) >= weekStart && Z.ds(new Date(x.doneAt + 3 * 3600e3)) <= end; }).length;
    var deadlines = L.uniItems().filter(function (u) { return (u.kind === 'assignment' || u.kind === 'exam') && u.done && u.date >= weekStart && u.date <= end; }).length;
    var chal = 0; for (var i = 0; i < 7; i++) { var l = S.get('challengeLogs', 'ch_' + Z.addDays(weekStart, i)); if (l && l.done) chal++; }
    var jr = S.all('journal').filter(function (j) { return j.date >= weekStart && j.date <= end; }).length;
    return { start: weekStart, end: end, habit: h, tasksDone: tasksDone, deadlines: deadlines, study: L.studyMinutes(weekStart, end), money: L.summary(weekStart, end), chal: chal, journal: jr };
  };
  L.monthSummary = function (monthStart) {
    var end = Z.monthEnd(monthStart);
    var tasksDone = L.tasks().filter(function (x) { return x.done && x.doneAt && Z.ds(new Date(x.doneAt + 3 * 3600e3)) >= monthStart && Z.ds(new Date(x.doneAt + 3 * 3600e3)) <= end; }).length;
    var chal = S.all('challengeLogs').filter(function (l) { return l.done && l.date >= monthStart && l.date <= end; }).length;
    return { start: monthStart, end: end, habit: L.rangeRate(monthStart, end), tasksDone: tasksDone, study: L.studyMinutes(monthStart, end), money: L.summary(monthStart, end), chal: chal,
      deadlines: L.uniItems().filter(function (u) { return (u.kind === 'assignment' || u.kind === 'exam') && u.done && u.date >= monthStart && u.date <= end; }).length,
      journal: S.all('journal').filter(function (j) { return j.date >= monthStart && j.date <= end; }).length };
  };
  L.hasAnyData = function () { return Z.COLS.some(function (c) { return c !== 'settings' && S.all(c).length > 0; }); };

  /* things that need a look: shown on Home and as small badges on the tab bar */
  L.attention = function () {
    var out = [], t = Z.today(), hour = Math.floor(Z.nowMin() / 60), i;
    var over = L.openTasks().filter(function (x) { return x.due && x.due < t; });
    if (over.length) out.push({ key: 'tasks', tab: 'plans', icon: 'triangle-alert', color: '#FF5C6C', count: over.length, title: over.length + (over.length === 1 ? ' task is overdue' : ' tasks are overdue'), sub: over[0].title + (over.length > 1 ? ' and more' : ''), act: 'go', arg: 'plans' });
    var due = Z.reminders ? Z.reminders.dueNow() : [];
    if (due.length) out.push({ key: 'due', tab: 'schedule', icon: 'bell-ring', color: '#3DB8FF', count: due.length, title: due.length + (due.length === 1 ? ' reminder passed today' : ' reminders passed today'), sub: due[0].title, act: 'go', arg: 'schedule' });
    var y = Z.addDays(t, -1), yh = L.dayHabits(y);
    if (yh.total && yh.done < yh.total) out.push({ key: 'yhab', tab: 'habits', icon: 'flame', color: '#FF6B3D', count: yh.total - yh.done, title: (yh.total - yh.done) + ' habit' + (yh.total - yh.done === 1 ? '' : 's') + ' missed yesterday', sub: 'You can still tick them off', act: 'go', arg: 'habits' });
    var th = L.dayHabits(t);
    if (th.total && th.done < th.total && hour >= 18) out.push({ key: 'thab', tab: 'habits', icon: 'flame', color: '#FF6B3D', count: th.total - th.done, title: (th.total - th.done) + ' habit' + (th.total - th.done === 1 ? '' : 's') + ' left tonight', sub: 'Finish the day strong', act: 'go', arg: 'habits' });
    var c = L.challenge();
    if (c && !c.notStarted && !c.finished && !c.doneToday && hour >= 12) out.push({ key: 'chal', tab: 'habits', icon: 'mountain', color: '#FFC93D', count: 1, title: 'Day ' + c.dayNo + ' is not checked in', sub: c.name, act: 'cDay', date: t });
    var dl = L.upcomingDeadlines(5, 2);
    if (dl.length) out.push({ key: 'uni', tab: 'plans', icon: 'graduation-cap', color: '#B565F5', count: dl.length, title: dl[0].title + (Z.diff(t, dl[0].date) === 0 ? ' is today' : Z.diff(t, dl[0].date) === 1 ? ' is tomorrow' : ' in 2 days'), sub: dl.length > 1 ? '+ ' + (dl.length - 1) + ' more soon' : 'University', act: 'go', arg: 'plans' });
    var bs = L.accounts().length ? L.budgetStatus(Z.monthStart(t)) : [];
    for (i = 0; i < bs.length; i++) if (bs[i].over) { out.push({ key: 'bud', tab: 'money', icon: 'wallet', color: '#FF6B8A', count: 1, title: 'Over budget this month', sub: bs[i].b.category || 'Monthly budget', act: 'go', arg: 'money' }); break; }
    return out;
  };
})();
