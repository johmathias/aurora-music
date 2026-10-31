/* ZERO OS — Plans: tasks, goals and the university planner */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc, F = Z.forms;
  var tab = 'tasks', tFilter = 'open', tCat = '', tPri = '', uKind = 'all', showDoneGoals = false, openGoals = {}, showDoneUni = false;

  var KINDS = { assignment: { label: 'Assignment', icon: 'file-text', color: '#FFC93D' }, exam: { label: 'Exam', icon: 'pen-line', color: '#FF5C6C' }, study: { label: 'Study session', icon: 'book-open', color: '#B565F5' }, revision: { label: 'Revision topic', icon: 'rotate-ccw', color: '#3DB8FF' } };
  var COURSE_COLORS = ['#B565F5', '#3DB8FF', '#34D399', '#FFC93D', '#FF6B3D', '#FF5C8A', '#2DD4BF', '#9A95FF'];

  /* ---------- TASKS ---------- */
  function dueBadge(t) {
    if (!t.due) return '';
    var n = Z.diff(Z.today(), t.due), c = t.done ? 'var(--ink3)' : n < 0 ? 'var(--bad)' : n === 0 ? 'var(--warn)' : 'var(--ink2)';
    return '<span style="color:' + c + '">' + Z.rel(t.due) + '</span>';
  }
  function taskRow(t, n) {
    var p = Z.PRIORITY[t.priority || 2], g = t.goalId ? S.get('goals', t.goalId) : null;
    return '<div class="item ' + (t.done ? 'done' : '') + ' rz" style="--n:' + Math.min(n, 12) + '"><button class="check ' + (t.done ? 'on' : '') + '" style="--c:' + p.color + '" data-act="tToggle" data-id="' + t.id + '" aria-pressed="' + !!t.done + '" aria-label="' + (t.done ? 'Mark as not done' : 'Mark as done') + ': ' + esc(t.title) + '">' + ic('check') + '</button>' +
      '<button class="grow" data-act="tEdit" data-id="' + t.id + '" style="text-align:left;display:block;min-width:0"><div class="ti">' + esc(t.title) + '</div><div class="su">' + [esc(t.cat || 'Personal'), dueBadge(t), g ? ic('target') + ' ' + esc(g.title) : '', t.reminder ? ic('bell') : ''].filter(Boolean).join(' · ') + '</div></button>' +
      (t.priority === 3 && !t.done ? '<span class="badge" style="--c:' + p.color + '">High</span>' : '') + '</div>';
  }
  function tasksTab() {
    var all = L.tasks(), html = '';
    var filtered = all.filter(function (t) { return (!tCat || t.cat === tCat) && (!tPri || String(t.priority || 2) === tPri); });
    var g = L.taskGroups(filtered), open = L.openTasks(), over = open.filter(function (t) { return t.due && t.due < Z.today(); }).length;
    var weekDone = all.filter(function (t) { return t.done && t.doneAt && t.doneAt > Date.now() - 7 * 864e5; }).length;
    html += '<section class="card hero rz" style="--n:1"><div class="hero-rings">' + U.ring({ size: 96, stroke: 11, value: all.length ? (all.length - open.length) / all.length : 0, color: '#B565F5', mid: '<div class="mid" style="position:static;font-size:22px">' + Z.pct(all.length - open.length, all.length) + '<span class="dim" style="font-size:13px">%</span></div>' }) +
      '<div class="grow"><div class="mid">' + open.length + ' open</div><div class="small muted" style="margin-top:6px">' + (over ? '<span class="bad">' + over + ' overdue</span> · ' : '') + weekDone + ' done this week</div></div></div></section>';
    var counts = { open: open.length, overdue: over, today: g.today.length, upcoming: g.upcoming.length, done: all.filter(function (t) { return t.done; }).length };
    html += '<div class="chips scroll rz" style="--n:2">' + [['open', 'Open'], ['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['done', 'Done']].map(function (f) { return '<button class="chip ' + (tFilter === f[0] ? 'on' : '') + '" data-act="tFilter" data-v="' + f[0] + '">' + f[1] + (counts[f[0]] ? ' <span style="opacity:.7">' + counts[f[0]] + '</span>' : '') + '</button>'; }).join('') + '</div>';
    html += '<div class="grid2 rz" style="--n:3">' + U.select('tcatf', [{ v: '', label: 'All categories' }].concat(Z.TASK_CATS), tCat) + U.select('tprif', [{ v: '', label: 'Any priority' }, { v: '3', label: 'High' }, { v: '2', label: 'Medium' }, { v: '1', label: 'Low' }], tPri) + '</div>';
    if (!all.length) return html + '<div class="card rz" style="--n:4">' + U.empty('list-checks', 'No tasks yet', 'Capture what’s on your mind. Give it a due date and it will show up on Home.', { act: 'addTask', label: 'Add your first task' }) + '</div>';
    var sections = [];
    if (tFilter === 'open') sections = [['Overdue', g.overdue, 'var(--bad)'], ['Today', g.today], ['Upcoming', g.upcoming], ['No due date', g.someday]];
    else if (tFilter === 'overdue') sections = [['Overdue', g.overdue, 'var(--bad)']]; else if (tFilter === 'today') sections = [['Today', g.today]];
    else if (tFilter === 'upcoming') sections = [['Upcoming', g.upcoming]]; else sections = [['Completed', g.done]];
    var shown = 0, n = 4;
    sections.forEach(function (s) {
      if (!s[1].length) return; shown++;
      html += '<section class="card rz" style="--n:' + Math.min(n++, 8) + '"><div class="head"><div class="label" style="' + (s[2] ? 'color:' + s[2] : '') + '">' + s[0] + ' · ' + s[1].length + '</div>' + (s[0] === 'Completed' ? '<button class="link" data-act="tClear">Clear completed</button>' : '') + '</div><div class="list">' + s[1].map(function (t, i) { return taskRow(t, i); }).join('') + '</div></section>';
    });
    if (!shown) html += '<div class="card rz" style="--n:4">' + U.empty(tFilter === 'done' ? 'circle-check' : 'sparkles', tFilter === 'done' ? 'Nothing completed yet' : 'All clear', tFilter === 'open' && !over ? 'No open tasks match. Enjoy it, or add the next thing.' : 'No tasks match this filter.', tFilter === 'done' ? null : { act: 'addTask', label: 'Add task' }) + '</div>';
    return html;
  }

  /* ---------- GOALS ---------- */
  function goalCard(g, n) {
    var p = L.goalProgress(g), pct = Math.round(p.pct * 100), done = g.status === 'done', open = !!openGoals[g.id];
    var days = g.targetDate ? Z.diff(Z.today(), g.targetDate) : null;
    var ms = g.milestones || [];
    return '<section class="card rz" style="--n:' + Math.min(n, 8) + '"><div class="row between" style="align-items:flex-start;gap:12px"><button class="grow" data-act="gToggle" data-id="' + g.id + '" style="text-align:left" aria-expanded="' + open + '"><div class="row" style="gap:8px;margin-bottom:6px"><span class="badge" style="--c:' + (g.type === 'long' ? '#B565F5' : '#3DB8FF') + '">' + (g.type === 'long' ? 'Long-term' : 'Short-term') + '</span>' +
      (days != null && !done ? '<span class="badge" style="--c:' + (days < 0 ? 'var(--bad)' : days < 14 ? 'var(--warn)' : 'var(--ink2)') + '">' + (days < 0 ? Math.abs(days) + 'd overdue' : days === 0 ? 'Due today' : days + 'd left') + '</span>' : '') + (done ? '<span class="badge" style="--c:var(--good)">Completed</span>' : '') + '</div><h3>' + esc(g.title) + '</h3>' + (g.desc ? '<div class="small muted" style="margin-top:4px">' + esc(g.desc) + '</div>' : '') + '</button>' +
      U.ring({ size: 62, stroke: 8, value: p.pct, color: done ? 'var(--good)' : '#B565F5', mid: '<div class="mid" style="position:static;font-size:14px;font-weight:720">' + pct + '%</div>' }) + '</div>' +
      '<div class="expand ' + (open ? 'open' : '') + '"><div><div style="padding-top:14px">' +
      (ms.length ? '<div class="label" style="margin-bottom:4px">Milestones</div><div class="list">' + ms.map(function (m) { return '<div class="item" style="min-height:48px"><button class="check ' + (m.done ? 'on' : '') + '" style="--c:#B565F5;width:26px;height:26px" data-act="gMs" data-id="' + g.id + '" data-m="' + m.id + '" aria-label="Toggle milestone ' + esc(m.t) + '">' + ic('check') + '</button><div class="grow ti" style="' + (m.done ? 'opacity:.5;text-decoration:line-through' : '') + '">' + esc(m.t) + '</div></div>'; }).join('') + '</div>' : '') +
      (p.tasks.length ? '<div class="label" style="margin:12px 0 4px">Tasks</div><div class="list">' + p.tasks.map(function (t) { return taskRow(t, 0).replace(' rz" style="--n:0"', '"'); }).join('') + '</div>' : '') +
      (!ms.length && !p.tasks.length ? '<p class="small muted">Break this goal down: add milestones when you edit it, or create tasks that belong to it.</p>' : '') +
      '<div class="row wrap" style="margin-top:14px;gap:8px"><button class="btn sm" data-act="gTask" data-id="' + g.id + '">' + ic('plus') + 'Task</button><button class="btn sm" data-act="gEdit" data-id="' + g.id + '">' + ic('pencil') + 'Edit</button><button class="btn sm ' + (done ? '' : 'primary') + '" data-act="gDone" data-id="' + g.id + '">' + ic(done ? 'rotate-ccw' : 'flag') + (done ? 'Reopen' : 'Mark complete') + '</button></div></div></div></div>' +
      '<div style="margin-top:12px">' + U.bar(pct, done ? 'var(--good)' : '#B565F5') + '<div class="row between xs dim" style="margin-top:6px"><span>' + (p.total ? p.done + ' of ' + p.total + ' steps' : 'No steps yet') + '</span><span>' + (g.targetDate ? 'Target ' + Z.fmt(g.targetDate, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No target date') + '</span></div></div></section>';
  }
  function goalsTab() {
    var gs = L.goals(), active = gs.filter(function (g) { return g.status !== 'done'; }), done = gs.filter(function (g) { return g.status === 'done'; });
    if (!gs.length) return '<div class="card rz" style="--n:1">' + U.empty('target', 'What are you working toward?', 'Set a short-term or long-term goal, add milestones and link tasks to see real progress.', { act: 'gNew', label: 'Create a goal' }) + '</div>';
    var n = 1, html = active.map(function (g) { return goalCard(g, n++); }).join('');
    if (done.length) html += '<section class="card flat rz" style="--n:8"><button class="row between" style="width:100%" data-act="gShowDone"><span class="label">Completed goals (' + done.length + ')</span>' + ic(showDoneGoals ? 'chevron-up' : 'chevron-down') + '</button><div class="expand ' + (showDoneGoals ? 'open' : '') + '"><div><div class="cols" style="padding-top:12px">' + done.map(function (g) { return goalCard(g, 0).replace(' rz" style="--n:0"', '"'); }).join('') + '</div></div></div></section>';
    return html;
  }
  function goalForm(g) {
    g = g || {};
    F.sheet({
      title: g.id ? 'Edit goal' : 'New goal',
      fields: U.field('Goal', U.input('gtitle', g.title, { ph: 'e.g. Graduate with a strong GPA', max: 100, autofocus: true }), 'gtitle') +
        U.field('Type', U.chipSelect('gtype', [{ v: 'short', label: 'Short-term' }, { v: 'long', label: 'Long-term' }], g.type || 'short'), 'gtype') +
        U.field('Target date (optional)', U.input('gdate', g.targetDate || '', { type: 'date' }), 'gdate') +
        U.field('Why it matters (optional)', U.textarea('gdesc', g.desc, '', 2), 'gdesc') +
        U.field('Milestones — one per line (optional)', U.textarea('gms', (g.milestones || []).map(function (m) { return m.t; }).join('\n'), 'Finish semester 1\nSubmit final project\n…', 4), 'gms', 'Progress is calculated from milestones and linked tasks.'),
      onSubmit: function (root) {
        var title = U.val(root, 'gtitle'); if (!title) { U.fail(root, 'gtitle', 'Name your goal.'); return false; }
        var old = {}; (g.milestones || []).forEach(function (m) { old[m.t] = m; });
        var ms = U.val(root, 'gms').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 30).map(function (t) { return old[t] || { id: Z.uid(), t: t, done: false }; });
        S.put('goals', Object.assign({}, g, { title: title, type: U.chipVal(root, 'gtype') || 'short', targetDate: U.val(root, 'gdate'), desc: U.val(root, 'gdesc'), milestones: ms, status: g.status || 'active' }));
        U.toast(g.id ? 'Goal updated' : 'Goal created');
      },
      onDelete: g.id ? function (api) { U.confirm({ title: 'Delete this goal?', text: 'Tasks linked to it are kept.', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.batch(function () { L.tasks().filter(function (t) { return t.goalId === g.id; }).forEach(function (t) { S.put('tasks', Object.assign({}, t, { goalId: '' })); }); S.del('goals', g.id); }); api.close(); U.toast('Goal deleted'); } }); } : null
    });
  }

  /* ---------- UNIVERSITY ---------- */
  function daysBadge(d) {
    var n = Z.diff(Z.today(), d), c = n <= 2 ? 'var(--bad)' : n <= 7 ? 'var(--warn)' : 'var(--ink2)';
    return '<span class="badge" style="--c:' + c + '">' + (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 0 ? Math.abs(n) + 'd ago' : n + ' days') + '</span>';
  }
  function uniRow(u, showCourse) {
    var k = KINDS[u.kind], c = L.courseOf(u.courseId);
    return '<div class="item ' + (u.done ? 'done' : '') + '"><button class="check ' + (u.done ? 'on' : '') + '" style="--c:' + k.color + '" data-act="uToggle" data-id="' + u.id + '" aria-pressed="' + !!u.done + '" aria-label="Toggle ' + esc(u.title) + '">' + ic('check') + '</button>' +
      '<button class="grow" data-act="uEdit" data-id="' + u.id + '" style="text-align:left;display:block;min-width:0"><div class="ti">' + esc(u.title) + (u.kind === 'exam' && u.examType && u.examType !== 'regular' ? ' <span class="badge" style="--c:#FF9F0A;vertical-align:middle">' + L.EXAM_TYPES[u.examType] + '</span>' : '') + '</div><div class="su">' + [showCourse && c ? esc(c.code || c.name) : '', k.label, u.date ? Z.fmt(u.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (u.start ? ' · ' + u.start : '') : '', u.kind === 'study' && u.minutes ? u.minutes + ' min' : ''].filter(Boolean).join(' · ') + '</div></button>' +
      (u.date && !u.done && u.kind !== 'study' ? daysBadge(u.date) : '') + '</div>';
  }
  function uniTab() {
    var courses = L.courses(), items = L.uniItems(), t = Z.today(), html = '';
    if (!courses.length) return '<div class="card rz" style="--n:1">' + U.empty('graduation-cap', 'Set up your semester', 'Add your courses, then track assignments, exams, study sessions and revision in one place.', { act: 'cNew', label: 'Add a course', icon: 'plus' }) + '</div>';
    var dl = L.upcomingDeadlines(1, 365)[0];
    html += '<section class="card hero rz" style="--n:1"><div class="label">Next deadline</div>' + (dl ? '<div class="mid" style="margin:10px 0 4px">' + esc(dl.title) + '</div><div class="small muted">' + esc((L.courseOf(dl.courseId) || {}).name || '') + ' · ' + Z.fmtLong(dl.date) + '</div><div style="margin-top:12px">' + daysBadge(dl.date) + '</div>' : '<div class="mid" style="margin:10px 0 4px">Nothing due</div><div class="small muted">No assignments or exams ahead. Add them as you hear about them.</div>') + '</section>';
    var ws = Z.weekStart(t), mins = L.studyMinutes(ws, Z.addDays(ws, 6)), target = (Number(Z.settings().studyTargetHours) || 10) * 60;
    html += '<section class="card rz" style="--n:2"><div class="head"><div class="label">' + ic('book-open') + 'Study this week</div><button class="link" data-act="uNew" data-kind="study">Log session</button></div><div class="row between" style="margin-bottom:10px"><div class="mid">' + U.count(Math.round(mins / 6) / 10, 'num', 'data-dec="1"') + '<span class="dim" style="font-size:15px"> / ' + (target / 60) + ' h</span></div><span class="small dim">' + Math.round(mins / target * 100) + '%</span></div>' + U.bar(mins / target * 100, '#B565F5') + '</section>';
    html += '<section class="card rz" style="--n:3"><div class="head"><h3>Courses</h3><button class="link" data-act="cNew">' + ic('plus') + 'Add</button></div><div class="list">' + courses.map(function (c) {
      var its = items.filter(function (u) { return u.courseId === c.id; }), done = its.filter(function (u) { return u.done; }).length, rev = its.filter(function (u) { return u.kind === 'revision'; });
      return '<button class="item tap" data-act="cOpen" data-id="' + c.id + '"><span class="avatar" style="--c:' + c.color + '">' + ic('book') + '</span><div class="grow"><div class="ti">' + esc(c.name) + '</div><div class="su">' + (c.code ? esc(c.code) + ' · ' : '') + its.length + ' item' + (its.length === 1 ? '' : 's') + (rev.length ? ' · revision ' + rev.filter(function (r) { return r.done; }).length + '/' + rev.length : '') + '</div>' + (its.length ? '<div style="margin-top:8px">' + U.bar(Z.pct(done, its.length), c.color) + '</div>' : '') + '</div>' + ic('chevron-right') + '</button>';
    }).join('') + '</div></section>';
    var kinds = [['all', 'All'], ['assignment', 'Assignments'], ['exam', 'Exams'], ['study', 'Study'], ['revision', 'Revision']];
    var list = items.filter(function (u) { return uKind === 'all' || u.kind === uKind; });
    var up = list.filter(function (u) { return !u.done && (u.kind === 'revision' || !u.date || u.date >= t); }).sort(function (a, b) { return (a.date || '9').localeCompare(b.date || '9'); });
    var over = list.filter(function (u) { return !u.done && u.kind !== 'revision' && u.date && u.date < t; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var dn = list.filter(function (u) { return u.done; }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    html += '<div class="chips scroll rz" style="--n:4">' + kinds.map(function (k) { return '<button class="chip ' + (uKind === k[0] ? 'on' : '') + '" data-act="uKind" data-v="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>';
    if (over.length) html += '<section class="card rz" style="--n:5"><div class="head"><div class="label bad">Overdue · ' + over.length + '</div></div><div class="list">' + over.map(function (u) { return uniRow(u, true); }).join('') + '</div></section>';
    html += '<section class="card rz" style="--n:6"><div class="head"><div class="label">Upcoming · ' + up.length + '</div><button class="link" data-act="uNew">' + ic('plus') + 'Add item</button></div>' + (up.length ? '<div class="list">' + up.map(function (u) { return uniRow(u, true); }).join('') + '</div>' : '<p class="muted small">Nothing upcoming in this category.</p>') + '</section>';
    if (dn.length) html += '<section class="card flat rz" style="--n:7"><button class="row between" style="width:100%" data-act="uShowDone"><span class="label">Completed (' + dn.length + ')</span>' + ic(showDoneUni ? 'chevron-up' : 'chevron-down') + '</button><div class="expand ' + (showDoneUni ? 'open' : '') + '"><div><div class="list" style="padding-top:8px">' + dn.slice(0, 30).map(function (u) { return uniRow(u, true); }).join('') + '</div></div></div></section>';
    return html;
  }
  function courseForm(c, onDone) {
    c = c || {};
    F.sheet({
      title: c.id ? 'Edit course' : 'New course',
      fields: U.field('Course name', U.input('cname', c.name, { ph: 'e.g. Human Computer Interface Design', max: 80, autofocus: true }), 'cname') +
        '<div class="grid2">' + U.field('Code', U.input('ccode', c.code, { ph: 'CSU07425', max: 20 }), 'ccode') + U.field('Lecturer', U.input('clect', c.lecturer, { max: 60 }), 'clect') + '</div>' +
        U.field('Colour', U.chipSelect('ccolor', COURSE_COLORS.map(function (x) { return { v: x, label: '', color: x }; }), c.color || COURSE_COLORS[L.courses().length % COURSE_COLORS.length]), 'ccolor'),
      onSubmit: function (root) {
        var n = U.val(root, 'cname'); if (!n) { U.fail(root, 'cname', 'Give the course a name.'); return false; }
        var saved = S.put('courses', Object.assign({}, c, { name: n, code: U.val(root, 'ccode'), lecturer: U.val(root, 'clect'), color: U.chipVal(root, 'ccolor') || COURSE_COLORS[0] }));
        U.toast(c.id ? 'Course updated' : 'Course added'); if (onDone) onDone(saved);
      },
      onDelete: c.id ? function (api) { U.confirm({ title: 'Delete "' + c.name + '"?', text: 'All its assignments, exams, study sessions and revision topics will be removed.', ok: 'Delete everything', danger: true }).then(function (y) { if (y) { S.batch(function () { L.uniItems().filter(function (u) { return u.courseId === c.id; }).forEach(function (u) { S.del('uni', u.id); }); S.del('courses', c.id); }); api.close(); U.toast('Course deleted'); } }); } : null
    });
  }
  F.uni = function (u, defaults) {
    u = u || {}; defaults = defaults || {};
    var courses = L.courses();
    if (!courses.length) { U.toast('Add a course first', 'info'); return courseForm(null, function () { setTimeout(function () { F.uni(u, defaults); }, 500); }); }
    var kind = u.kind || defaults.kind || 'assignment';
    F.sheet({
      title: u.id ? 'Edit ' + KINDS[kind].label.toLowerCase() : 'New academic item',
      fields: U.field('Type', U.chipSelect('ukind', Object.keys(KINDS).map(function (k) { return { v: k, label: KINDS[k].label, color: KINDS[k].color }; }), kind), 'ukind') +
        U.field('Course', U.select('ucourse', courses.map(function (c) { return { v: c.id, label: (c.code ? c.code + ' · ' : '') + c.name }; }), u.courseId || defaults.courseId || courses[0].id), 'ucourse') +
        U.field('Title', U.input('utitle', u.title, { ph: 'e.g. Group assignment 2', max: 100, autofocus: true }), 'utitle') +
        '<div id="ubox-date">' + U.field('Date', U.input('udate', u.date || defaults.date || '', { type: 'date' }) + F.dateChips('udate'), 'udate') + '<div class="grid2" style="margin-top:14px">' + U.field('Time (optional)', U.input('ustart', u.start || '', { type: 'time' }), 'ustart') + '<div id="ubox-min">' + U.field('Length (min)', U.input('umin', u.minutes || 60, { type: 'number', inputmode: 'numeric', min: 5 }), 'umin') + '</div></div></div>' +
        '<div id="ubox-exam" class="' + (kind === 'exam' ? '' : 'hide') + '">' + U.field('Exam type', U.chipSelect('uetype', [{ v: 'regular', label: 'Regular' }, { v: 'supplementary', label: 'Supplementary' }, { v: 'special', label: 'Special' }], u.examType || 'regular'), 'uetype') + '</div>' +
        U.field('Notes / venue (optional)', U.textarea('unotes', u.notes, '', 2), 'unotes') + U.switchRow('urem', 'Remind me', !!u.reminder, 'Exams: 1 hour before. Others: that morning'),
      onMount: function (root) {
        function adj() {
          var k = U.chipVal(root, 'ukind'); Z.$('#ubox-exam', root).classList.toggle('hide', k !== 'exam'); Z.$('#ubox-min', root).classList.toggle('hide', k !== 'study');
          Z.$('#ubox-date', root).classList.toggle('hide', false); Z.$('[data-f="udate"] > label', root).textContent = k === 'revision' ? 'Revise by (optional)' : k === 'assignment' ? 'Due date' : 'Date';
        }
        Z.$('[data-chips="ukind"]', root).addEventListener('click', function () { setTimeout(adj, 0); }); adj();
      },
      onSubmit: function (root) {
        var k = U.chipVal(root, 'ukind') || 'assignment', title = U.val(root, 'utitle'), date = U.val(root, 'udate');
        if (!title) { U.fail(root, 'utitle', 'Add a title.'); return false; }
        if (k !== 'revision' && !date) { U.fail(root, 'udate', 'Choose a date.'); return false; }
        var mins = parseInt(U.val(root, 'umin'), 10); if (k === 'study' && !(mins > 0 && mins <= 1440)) { U.fail(root, 'umin', 'Enter minutes (1–1440).'); return false; }
        S.put('uni', Object.assign({}, u, { kind: k, courseId: U.val(root, 'ucourse'), title: title, date: date, start: U.val(root, 'ustart'), minutes: k === 'study' ? mins : 0, examType: k === 'exam' ? U.chipVal(root, 'uetype') || 'regular' : '', notes: U.val(root, 'unotes'), reminder: U.switchVal(root, 'urem'), done: !!u.done }));
        U.toast(u.id ? 'Updated' : 'Added');
      },
      onDelete: u.id ? function (api) { U.confirm({ title: 'Delete this item?', text: '"' + u.title + '"', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.del('uni', u.id); api.close(); U.toast('Deleted'); } }); } : null
    });
  };
  function courseSheet(c) {
    var items = L.uniItems().filter(function (u) { return u.courseId === c.id; }), api;
    var groups = ['exam', 'assignment', 'study', 'revision'], rev = items.filter(function (u) { return u.kind === 'revision'; });
    api = U.sheet({
      title: c.name,
      body: '<div class="stack">' + (c.code || c.lecturer ? '<div class="small muted">' + [c.code, c.lecturer].filter(Boolean).map(esc).join(' · ') + '</div>' : '') +
        (rev.length ? '<div class="kpi"><div class="label">Revision progress</div><div class="v">' + rev.filter(function (r) { return r.done; }).length + ' / ' + rev.length + ' topics</div><div style="margin-top:10px">' + U.bar(Z.pct(rev.filter(function (r) { return r.done; }).length, rev.length), c.color) + '</div></div>' : '') +
        groups.map(function (g) {
          var list = items.filter(function (u) { return u.kind === g; }).sort(function (a, b) { return (a.date || '9').localeCompare(b.date || '9'); });
          return '<div><div class="row between"><div class="label" style="color:' + KINDS[g].color + '">' + KINDS[g].label + 's</div><button class="link" data-add="' + g + '">' + ic('plus') + 'Add</button></div>' + (list.length ? '<div class="list" data-list>' + list.map(function (u) { return uniRow(u, false); }).join('') + '</div>' : '<div class="small dim" style="padding:8px 0">None yet</div>') + '</div>';
        }).join('') + '<div class="sh-foot"><button class="btn" data-edit>' + ic('pencil') + 'Edit course</button></div></div>',
      onMount: function (root) {
        root.addEventListener('click', function (e) {
          var a = e.target.closest('[data-add]'); if (a) { api.close(); F.uni(null, { kind: a.dataset.add, courseId: c.id }); }
          if (e.target.closest('[data-edit]')) { api.close(); courseForm(c); }
          var ed = e.target.closest('[data-act="uEdit"]'); if (ed) { api.close(); var u = S.get('uni', ed.dataset.id); if (u) F.uni(u); e.stopPropagation(); }
        }, true);
      }
    });
  }

  /* ---------- actions ---------- */
  var A = Z.actions;
  A.tToggle = function (el) {
    var t = S.get('tasks', el.dataset.id); if (!t) return;
    var wasDone = t.done; el.classList.toggle('on'); if (!wasDone) el.classList.add('pulse'); if (!wasDone && navigator.vibrate) try { navigator.vibrate(12); } catch (e) { }
    setTimeout(function () {
      L.toggleTask(t);
      if (!wasDone) { var left = L.todayTasks().length; if (t.due && t.due <= Z.today() && left === 0) U.celebrate('Today’s tasks done', 'Nothing left due. Nicely done.', 'sparkles'); else U.toast('Task completed'); }
    }, wasDone ? 0 : 260);
  };
  A.tEdit = function (el) { var t = S.get('tasks', el.dataset.id); if (t) F.task(t); };
  A.tFilter = function (el) { tFilter = el.dataset.v; paintTasks(); };
  A.tClear = function () { U.confirm({ title: 'Clear completed tasks?', text: 'They will be deleted permanently.', ok: 'Clear', danger: true }).then(function (y) { if (y) { S.delMany('tasks', L.tasks().filter(function (t) { return t.done; }).map(function (t) { return t.id; })); U.toast('Cleared'); } }); };
  A.gNew = function () { goalForm(); };
  A.gEdit = function (el) { var g = S.get('goals', el.dataset.id); if (g) goalForm(g); };
  A.gToggle = function (el) { openGoals[el.dataset.id] = !openGoals[el.dataset.id]; var exp = el.closest('.card').querySelector('.expand'); if (exp) exp.classList.toggle('open', openGoals[el.dataset.id]); el.setAttribute('aria-expanded', !!openGoals[el.dataset.id]); };
  A.gMs = function (el) { var g = S.get('goals', el.dataset.id); if (!g) return; var ms = (g.milestones || []).map(function (m) { return m.id === el.dataset.m ? Object.assign({}, m, { done: !m.done }) : m; }); var allDone = ms.length && ms.every(function (m) { return m.done; }); S.put('goals', Object.assign({}, g, { milestones: ms })); if (allDone && g.status !== 'done') U.toast('All milestones done — mark the goal complete?', 'info'); };
  A.gTask = function (el) { F.task(null, { goalId: el.dataset.id }); };
  A.gDone = function (el) { var g = S.get('goals', el.dataset.id); if (!g) return; var nowDone = g.status !== 'done'; S.put('goals', Object.assign({}, g, { status: nowDone ? 'done' : 'active' })); if (nowDone) U.celebrate('Goal achieved', g.title, 'trophy'); };
  A.gShowDone = function () { showDoneGoals = !showDoneGoals; Z.refresh(); };
  A.cNew = function () { courseForm(); };
  A.cOpen = function (el) { var c = S.get('courses', el.dataset.id); if (c) courseSheet(c); };
  A.uNew = function (el) { F.uni(null, { kind: el && el.dataset && el.dataset.kind }); };
  A.uEdit = function (el) { var u = S.get('uni', el.dataset.id); if (u) F.uni(u); };
  A.uToggle = function (el) { var u = S.get('uni', el.dataset.id); if (!u) return; el.classList.toggle('on'); el.classList.add('pulse'); var it = el.closest('.item'); if (it) it.classList.toggle('done'); S.put('uni', Object.assign({}, u, { done: !u.done })); if (!u.done) U.toast(u.kind === 'study' ? 'Study session logged' : 'Marked done'); };
  A.uKind = function (el) { uKind = el.dataset.v; Z.refresh(); };
  A.uShowDone = function () { showDoneUni = !showDoneUni; Z.refresh(); };

  function body() { return tab === 'tasks' ? tasksTab() : tab === 'goals' ? goalsTab() : uniTab(); }
  function paintTasks() { Z.refresh(); }
  function hook(root) {
    var c = Z.$('#tcatf', root), p = Z.$('#tprif', root);
    if (c) c.addEventListener('change', function () { tCat = c.value; Z.refresh(); }); if (p) p.addEventListener('change', function () { tPri = p.value; Z.refresh(); });
  }

  Z.views.plans = {
    title: 'Plans', area: 'plans',
    render: function () {
      return Z.hd({ eyebrow: 'Direction', title: 'Plans', sub: tab === 'tasks' ? 'What needs doing.' : tab === 'goals' ? 'Where you’re headed.' : 'Everything academic, in one place.' }) +
        '<div class="rz" style="--n:1;margin-bottom:16px">' + U.seg('pseg', [{ v: 'tasks', label: 'Tasks' }, { v: 'goals', label: 'Goals' }, { v: 'uni', label: 'University' }], tab) + '</div><div class="cols" id="pbody">' + body() + '</div>';
    },
    mount: function (root) {
      hook(root);
      U.bindSeg(root, 'pseg', function (v) {
        tab = v; Z.entering = true; var b = Z.$('#pbody', root); b.innerHTML = body(); b.classList.add('entering'); hook(root); U.animate(b);
        var s = Z.$('.hd .sub', root); if (s) s.textContent = tab === 'tasks' ? 'What needs doing.' : tab === 'goals' ? 'Where you’re headed.' : 'Everything academic, in one place.';
      });
    },
    fab: function () { if (tab === 'goals') goalForm(); else if (tab === 'uni') F.uni(); else F.task(); },
    goto: function (t) { tab = t; }
  };
})();
