/* ZERO OS — shared forms (used by Home quick actions and by each section) */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc;
  var F = Z.forms = {};

  // generic sheet with a <form>: opts {title, fields, save, del, onSubmit(root, api) → return false to stay open, onDelete(api), onMount}
  F.sheet = function (o) {
    return U.sheet({
      title: o.title,
      body: '<form class="form" novalidate>' + o.fields + U.footer({ save: o.save || 'Save', del: !!o.onDelete }) + '</form>',
      onMount: function (root, api) {
        U.wire(root);
        var form = Z.$('form', root);
        form.addEventListener('submit', function (e) {
          e.preventDefault(); U.clearErr(root);
          var r = o.onSubmit(root, api); if (r !== false) api.close();
        });
        var del = Z.$('[data-del]', root); if (del) del.addEventListener('click', function () { o.onDelete(api); });
        if (o.onMount) o.onMount(root, api);
        var af = Z.$('[data-af]', root); if (af && !o.noFocus) setTimeout(function () { af.focus(); }, 420);
      }
    });
  };
  F.dateChips = function (id) {
    return '<div class="chips" style="margin-top:8px">' + [['Today', 0], ['Tomorrow', 1], ['In a week', 7]].map(function (x) { return '<button type="button" class="chip" data-setdate="' + id + '" data-off="' + x[1] + '">' + x[0] + '</button>'; }).join('') + '</div>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-setdate]'); if (!b) return;
    var inp = document.getElementById(b.dataset.setdate); if (inp) { inp.value = Z.addDays(Z.today(), +b.dataset.off); inp.dispatchEvent(new Event('input')); }
  });

  /* ---------- HABIT ---------- */
  var HABIT_ICONS = ['flame', 'dumbbell', 'book-open', 'droplet', 'brain', 'moon', 'sun', 'coffee', 'heart', 'star', 'zap', 'mountain'];
  var HABIT_COLORS = ['#FF6B3D', '#FFC93D', '#34D399', '#3DB8FF', '#B565F5', '#FF5C8A', '#2DD4BF', '#9A95FF'];
  F.habit = function (h) {
    h = h || {};
    var daily = !h.days || !h.days.length;
    return F.sheet({
      title: h.id ? 'Edit habit' : 'New habit',
      fields:
        U.field('Name', U.input('hname', h.name, { ph: 'e.g. Read 20 minutes', max: 60, autofocus: true }), 'hname') +
        U.field('Colour', U.chipSelect('hcolor', HABIT_COLORS.map(function (c) { return { v: c, label: '', color: c }; }), h.color || HABIT_COLORS[0]), 'hcolor') +
        U.field('Icon', '<div class="chips" data-chips="hicon" data-multi="0">' + HABIT_ICONS.map(function (n) { return '<button type="button" class="chip' + (n === (h.icon || 'flame') ? ' on' : '') + '" data-v="' + n + '" aria-label="' + n + '" style="min-width:44px;padding:0 11px;justify-content:center">' + ic(n) + '</button>'; }).join('') + '</div>', 'hicon') +
        U.field('Repeat', U.chipSelect('hmode', [{ v: 'daily', label: 'Every day' }, { v: 'days', label: 'Selected days' }], daily ? 'daily' : 'days'), 'hmode') +
        '<div class="field ' + (daily ? 'hide' : '') + '" id="hdaysbox" data-f="hdays"><label>Which days?</label>' + U.dayPicker('hdays', h.days || [1, 2, 3, 4, 5]) + '<div class="msg"></div></div>' +
        U.field('Start date', U.input('hstart', h.startDate || Z.today(), { type: 'date' }), 'hstart') +
        U.field('Reminder time (optional)', U.input('hrem', h.reminder || '', { type: 'time' }), 'hrem', 'Needs notifications allowed in Settings'),
      onMount: function (root) {
        var box = Z.$('[data-chips="hmode"]', root);
        box.addEventListener('click', function () { setTimeout(function () { Z.$('#hdaysbox', root).classList.toggle('hide', U.chipVal(root, 'hmode') === 'daily'); }, 0); });
      },
      onSubmit: function (root) {
        var name = U.val(root, 'hname'); if (!name) { U.fail(root, 'hname', 'Give your habit a name.'); return false; }
        var mode = U.chipVal(root, 'hmode'), days = mode === 'daily' ? [] : U.dayVal(root, 'hdays');
        if (mode === 'days' && !days.length) { U.fail(root, 'hdays', 'Pick at least one day.'); return false; }
        var start = U.val(root, 'hstart') || Z.today();
        S.put('habits', Object.assign({}, h, { name: name, color: U.chipVal(root, 'hcolor') || HABIT_COLORS[0], icon: U.chipVal(root, 'hicon') || 'flame', days: days, startDate: start, reminder: U.val(root, 'hrem'), archived: !!h.archived }));
        U.toast(h.id ? 'Habit updated' : 'Habit created');
      },
      onDelete: h.id ? function (api) {
        U.confirm({ title: 'Delete "' + h.name + '"?', text: 'This also removes its history. To keep the history, archive it instead.', ok: 'Delete', danger: true }).then(function (y) { if (y) { L.deleteHabit(h); api.close(); U.toast('Habit deleted'); } });
      } : null
    });
  };

  /* ---------- EVENT ---------- */
  F.event = function (e, defaults) {
    e = e || {}; defaults = defaults || {};
    var cats = Object.keys(Z.EVENT_CATS).map(function (k) { return { v: k, label: Z.EVENT_CATS[k].label, color: Z.EVENT_CATS[k].color }; });
    var rep = e.repeat || 'none';
    return F.sheet({
      title: e.id ? 'Edit event' : 'New event',
      fields:
        U.field('Title', U.input('etitle', e.title, { ph: 'e.g. Networking lecture', max: 80, autofocus: true }), 'etitle') +
        U.field('Type', '<div class="chips scroll" data-chips="ecat" data-multi="0">' + cats.map(function (c) { return '<button type="button" class="chip' + (c.v === (e.cat || defaults.cat || 'personal') ? ' on' : '') + '" data-v="' + c.v + '" style="--c:' + c.color + '"><i class="dot"></i>' + c.label + '</button>'; }).join('') + '</div>', 'ecat') +
        U.field('Date', U.input('edate', e.date || defaults.date || Z.today(), { type: 'date' }) + F.dateChips('edate'), 'edate', 'If it repeats, this is the first day.') +
        '<div class="grid2">' + U.field('Starts', U.input('estart', e.start || defaults.start || '', { type: 'time' }), 'estart') + U.field('Ends', U.input('eend', e.end || '', { type: 'time' }), 'eend') + '</div>' +
        '<div class="xs dim" style="margin-top:-8px">Leave both empty for an all-day item.</div>' +
        U.field('Repeats', U.select('erep', [{ v: 'none', label: 'Only once' }, { v: 'weekly', label: 'Every week — for timetables' }, { v: 'daily', label: 'Every day' }, { v: 'weekdays', label: 'Weekdays (Mon–Fri)' }, { v: 'monthly', label: 'Every month' }], rep), 'erep') +
        '<div id="edaysbox" class="' + (rep === 'weekly' && !e.id ? '' : 'hide') + '">' + U.field('On which days?', U.dayPicker('edays', [Z.dow(e.date || defaults.date || Z.today())]), 'edays', 'Pick every day this happens each week. One event is made for each.') + '</div>' +
        (e.id && rep !== 'none' ? '<div class="xs dim" style="margin-top:-6px">Changes here apply to every week. To change one day only, open that day, delete just that one, and add it again.</div>' : '') +
        '<div id="euntilbox" class="' + (rep === 'none' ? 'hide' : '') + '">' + U.field('Repeat until (optional)', U.input('euntil', e.until || '', { type: 'date' }), 'euntil') + '</div>' +
        U.field('Notes (optional)', U.textarea('enotes', e.notes, 'Room, lecturer, what to bring…', 3), 'enotes') +
        U.switchRow('erem', 'Remind me', !!e.reminder, 'Alert before it starts'),
      onMount: function (root) {
        var rp = Z.$('#erep', root);
        function showRep() { Z.$('#euntilbox', root).classList.toggle('hide', rp.value === 'none'); Z.$('#edaysbox', root).classList.toggle('hide', !(rp.value === 'weekly' && !e.id)); }
        rp.addEventListener('change', showRep);
        // a new class usually repeats weekly: suggest it
        if (!e.id) root.addEventListener('click', function (ev) { var c = ev.target.closest('[data-chips="ecat"] .chip'); if (c && c.dataset.v === 'class' && rp.value === 'none') { rp.value = 'weekly'; showRep(); } });
        if (!e.id && (defaults.cat === 'class') && rp.value === 'none') { rp.value = 'weekly'; showRep(); }
      },
      onSubmit: function (root) {
        var title = U.val(root, 'etitle'), date = U.val(root, 'edate'), st = U.val(root, 'estart'), en = U.val(root, 'eend');
        if (!title) { U.fail(root, 'etitle', 'Add a title.'); return false; }
        if (!date) { U.fail(root, 'edate', 'Choose a date.'); return false; }
        if (en && !st) { U.fail(root, 'estart', 'Add a start time too.'); return false; }
        if (st && en && Z.toMin(en) <= Z.toMin(st)) { U.fail(root, 'eend', 'End time must be after the start.'); return false; }
        var repeat = U.val(root, 'erep'), until = U.val(root, 'euntil');
        if (repeat !== 'none' && until && until < date) { U.fail(root, 'euntil', 'Must be after the first date.'); return false; }
        var base = { title: title, cat: U.chipVal(root, 'ecat') || 'personal', start: st, end: en, repeat: repeat, until: repeat === 'none' ? '' : until, notes: U.val(root, 'enotes'), reminder: U.switchVal(root, 'erem') };
        var days = (!e.id && repeat === 'weekly') ? U.dayVal(root, 'edays') : [];
        if (days.length > 1 || (days.length === 1 && days[0] !== Z.dow(date))) {
          // timetable: one weekly event per chosen weekday, starting on the first matching date
          S.batch(function () { days.forEach(function (wd) { var d0 = date, k = 0; while (Z.dow(d0) !== wd && k++ < 7) d0 = Z.addDays(d0, 1); S.put('events', Object.assign({}, base, { date: d0 })); }); });
          U.toast(days.length + ' weekly events added');
        } else {
          S.put('events', Object.assign({}, e, base, { date: date }));
          U.toast(e.id ? 'Event updated' : 'Event added');
        }
        if (Z.views[Z.current()] && Z.current() === 'schedule' && Z.views.schedule.goto) Z.views.schedule.goto(date);
      },
      onDelete: e.id ? function (api) { F.deleteEvent(e, defaults.date || e.date, api); } : null
    });
  };
  F.deleteEvent = function (e, onDate, api) {
    var rec = e.repeat && e.repeat !== 'none';
    var p = rec ? U.choice({ title: 'Delete "' + e.title + '"', text: 'This is a repeating event.', options: [{ label: 'Only ' + Z.fmt(onDate), value: 'one', danger: true }, { label: 'All events in the series', value: 'all', danger: true }] })
      : U.confirm({ title: 'Delete "' + e.title + '"?', text: 'This cannot be undone.', ok: 'Delete', danger: true }).then(function (y) { return y ? 'all' : null; });
    p.then(function (v) {
      if (!v) return;
      if (v === 'one') S.put('events', Object.assign({}, e, { exceptions: (e.exceptions || []).concat([onDate]) })); else S.del('events', e.id);
      if (api) api.close(); U.toast('Event deleted');
    });
  };

  /* ---------- TASK ---------- */
  F.task = function (t, defaults) {
    t = t || {}; defaults = defaults || {};
    var goals = L.goals().filter(function (g) { return g.status !== 'done' || g.id === t.goalId; });
    return F.sheet({
      title: t.id ? 'Edit task' : 'New task',
      fields:
        U.field('Task', U.input('ttitle', t.title, { ph: 'What needs doing?', max: 120, autofocus: true }), 'ttitle') +
        U.field('Due date (optional)', U.input('tdue', t.id ? t.due || '' : (defaults.due != null ? defaults.due : ''), { type: 'date' }) + F.dateChips('tdue'), 'tdue') +
        U.field('Priority', U.chipSelect('tpri', [{ v: '3', label: 'High', color: Z.PRIORITY[3].color }, { v: '2', label: 'Medium', color: Z.PRIORITY[2].color }, { v: '1', label: 'Low', color: Z.PRIORITY[1].color }], String(t.priority || 2)), 'tpri') +
        U.field('Category', U.chipSelect('tcat', Z.TASK_CATS, t.cat || defaults.cat || 'Personal'), 'tcat') +
        (goals.length ? U.field('Part of a goal (optional)', U.select('tgoal', [{ v: '', label: 'No goal' }].concat(goals.map(function (g) { return { v: g.id, label: g.title }; })), t.goalId || defaults.goalId || ''), 'tgoal') : '') +
        U.field('Description (optional)', U.textarea('tdesc', t.desc, 'Details, links, steps…', 3), 'tdesc') +
        U.switchRow('trem', 'Remind me on the due date', !!t.reminder, 'At 09:00 on the day'),
      onSubmit: function (root) {
        var title = U.val(root, 'ttitle'); if (!title) { U.fail(root, 'ttitle', 'Write what needs doing.'); return false; }
        var due = U.val(root, 'tdue'), rem = U.switchVal(root, 'trem');
        if (rem && !due) { U.fail(root, 'tdue', 'A reminder needs a due date.'); return false; }
        var g = Z.$('#tgoal', root);
        S.put('tasks', Object.assign({}, t, { title: title, due: due, priority: +U.chipVal(root, 'tpri') || 2, cat: U.chipVal(root, 'tcat') || 'Personal', goalId: g ? g.value : (t.goalId || ''), desc: U.val(root, 'tdesc'), reminder: rem, done: !!t.done }));
        U.toast(t.id ? 'Task updated' : 'Task added');
      },
      onDelete: t.id ? function (api) { U.confirm({ title: 'Delete this task?', text: '"' + t.title + '"', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.del('tasks', t.id); api.close(); U.toast('Task deleted'); } }); } : null
    });
  };

  /* ---------- ACCOUNT ---------- */
  F.account = function (a, onDone) {
    a = a || {};
    return F.sheet({
      title: a.id ? 'Edit account' : 'New account',
      fields:
        U.field('Name', U.input('aname', a.name, { ph: 'e.g. M-Pesa', max: 40, autofocus: true }), 'aname') +
        (a.id ? '' : '<div class="chips scroll" style="margin-top:-6px">' + Z.ACCOUNT_PRESETS.map(function (p) { return '<button type="button" class="chip" data-preset="' + esc(p) + '">' + esc(p) + '</button>'; }).join('') + '</div>') +
        U.field('Type', U.chipSelect('atype', Z.ACCOUNT_TYPES.map(function (t) { return { v: t.v, label: t.label }; }), a.type || 'mobile'), 'atype') +
        U.field('Opening balance (TSh)', U.input('aopen', a.opening != null ? a.opening : '', { inputmode: 'decimal', ph: '0' }), 'aopen', 'What is in the account right now. Later transactions adjust it.'),
      onMount: function (root) {
        root.addEventListener('click', function (ev) {
          var p = ev.target.closest('[data-preset]'); if (!p) return; var n = p.dataset.preset; Z.$('#aname', root).value = n;
          var map = { 'Cash': 'cash', 'Savings': 'savings', 'NMB': 'bank', 'CRDB': 'bank' }; var tp = map[n] || 'mobile';
          Z.$$('[data-chips="atype"] .chip', root).forEach(function (c) { c.classList.toggle('on', c.dataset.v === tp); });
        });
      },
      onSubmit: function (root) {
        var name = U.val(root, 'aname'); if (!name) { U.fail(root, 'aname', 'Name the account.'); return false; }
        var openStr = U.val(root, 'aopen'), open = openStr === '' ? 0 : U.parseAmount(openStr);
        if (isNaN(open)) { U.fail(root, 'aopen', 'Enter a number, e.g. 50000.'); return false; }
        var dup = L.accounts(true).some(function (x) { return x.id !== a.id && x.name.toLowerCase() === name.toLowerCase(); });
        if (dup) { U.fail(root, 'aname', 'You already have an account with this name.'); return false; }
        var saved = S.put('accounts', Object.assign({}, a, { name: name, type: U.chipVal(root, 'atype') || 'custom', opening: open }));
        U.toast(a.id ? 'Account updated' : 'Account added'); if (onDone) onDone(saved);
      },
      onDelete: a.id ? function (api) {
        var used = S.all('transactions').filter(function (t) { return t.accountId === a.id || t.toAccountId === a.id; }).length;
        if (used) {
          U.choice({ title: 'This account has ' + used + ' transactions', text: 'Deleting would break your history. Archive it to hide it and keep the records.', options: [{ label: 'Archive account', value: 'arch', primary: true }] }).then(function (v) {
            if (v) { S.put('accounts', Object.assign({}, a, { archived: true })); api.close(); U.toast('Account archived'); }
          });
        } else U.confirm({ title: 'Delete "' + a.name + '"?', text: 'It has no transactions.', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.del('accounts', a.id); api.close(); U.toast('Account deleted'); } });
      } : null
    });
  };

  /* ---------- TRANSACTION ---------- */
  F.tx = function (t, defaults) {
    t = t || {}; defaults = defaults || {};
    var accts = L.accounts();
    if (!accts.length && !t.id) {
      U.toast('Add an account first — e.g. Cash or M-Pesa', 'info');
      return F.account(null, function () { setTimeout(function () { F.tx(null, defaults); }, 500); });
    }
    var type = t.type || defaults.type || 'expense', aopts = accts.map(function (a) { return { v: a.id, label: a.name }; });
    if (t.accountId && !accts.some(function (a) { return a.id === t.accountId; })) aopts.push({ v: t.accountId, label: L.accountName(t.accountId) });
    var toopts = aopts.slice();
    if (t.toAccountId && !toopts.some(function (a) { return a.v === t.toAccountId; })) toopts.push({ v: t.toAccountId, label: L.accountName(t.toAccountId) });
    var lastAcc = Z.meta.get('lastAccount', ''); var accSel = t.accountId || (aopts.some(function (a) { return a.v === lastAcc; }) ? lastAcc : aopts[0].v);
    function catChips(ty, cur) { var list = ty === 'income' ? Z.INC_CATS : Z.EXP_CATS; return U.chipSelect('xcat', list, cur && list.indexOf(cur) > -1 ? cur : list[list.length - 1]); }
    return F.sheet({
      title: t.id ? 'Edit transaction' : 'New transaction',
      fields:
        U.seg('xtype', [{ v: 'expense', label: 'Expense' }, { v: 'income', label: 'Income' }, { v: 'transfer', label: 'Transfer' }], type) +
        U.field('Amount (TSh)', U.input('xamt', t.amount != null ? t.amount : '', { inputmode: 'decimal', ph: '0', autofocus: true, cls: 'amount-input' }), 'xamt') +
        '<div class="grid2" id="xaccs">' + U.field(type === 'income' ? 'To account' : type === 'transfer' ? 'From account' : 'Account', U.select('xacc', aopts, accSel), 'xacc') +
        '<div id="xtobox" class="' + (type === 'transfer' ? '' : 'hide') + '">' + U.field('To account', U.select('xto', toopts, t.toAccountId || (toopts[1] || toopts[0]).v), 'xto') + '</div></div>' +
        '<div id="xcatbox" class="' + (type === 'transfer' ? 'hide' : '') + '">' + U.field('Category', '<div id="xcatwrap">' + catChips(type, t.category) + '</div>', 'xcat') + '</div>' +
        U.field('Date', U.input('xdate', t.date || defaults.date || Z.today(), { type: 'date' }) + F.dateChips('xdate'), 'xdate') +
        U.field('Description (optional)', U.input('xdesc', t.desc, { ph: 'e.g. Lunch, airtime, salary…', max: 100 }), 'xdesc') +
        U.field('Notes (optional)', U.textarea('xnotes', t.notes, '', 2), 'xnotes'),
      onMount: function (root) {
        var kind = type;
        U.bindSeg(root, 'xtype', function (v) {
          kind = v; Z.$('#xtobox', root).classList.toggle('hide', v !== 'transfer'); Z.$('#xcatbox', root).classList.toggle('hide', v === 'transfer');
          Z.$('[data-f="xacc"] > label', root).textContent = v === 'income' ? 'To account' : v === 'transfer' ? 'From account' : 'Account';
          if (v !== 'transfer') Z.$('#xcatwrap', root).innerHTML = catChips(v, null);
        });
        root._kind = function () { return kind; };
      },
      onSubmit: function (root) {
        var kind = root._kind(), amt = U.parseAmount(U.val(root, 'xamt'));
        if (!(amt > 0)) { U.fail(root, 'xamt', 'Enter an amount greater than zero.'); return false; }
        if (amt > 1e12) { U.fail(root, 'xamt', 'That number is too large.'); return false; }
        var date = U.val(root, 'xdate'); if (!date) { U.fail(root, 'xdate', 'Choose a date.'); return false; }
        var acc = U.val(root, 'xacc'), to = kind === 'transfer' ? U.val(root, 'xto') : '';
        if (kind === 'transfer' && (acc === to)) { U.fail(root, 'xto', 'Choose two different accounts.'); return false; }
        Z.meta.set('lastAccount', acc);
        S.put('transactions', Object.assign({}, t, { type: kind, amount: Math.round(amt * 100) / 100, date: date, accountId: acc, toAccountId: to, category: kind === 'transfer' ? '' : (U.chipVal(root, 'xcat') || 'Other'), desc: U.val(root, 'xdesc'), notes: U.val(root, 'xnotes') }));
        U.toast(t.id ? 'Transaction updated' : kind === 'income' ? 'Income recorded' : kind === 'transfer' ? 'Transfer recorded' : 'Expense recorded');
      },
      onDelete: t.id ? function (api) { U.confirm({ title: 'Delete this transaction?', text: 'Balances will update automatically.', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.del('transactions', t.id); api.close(); U.toast('Transaction deleted'); } }); } : null
    });
  };

  /* ---------- quick add (floating button on Home / anywhere) ---------- */
  F.quickAdd = function (anchor) {
    U.menu(anchor, [
      { icon: 'list-checks', label: 'Add task', run: function () { F.task(); } },
      { icon: 'wallet', label: 'Record transaction', run: function () { F.tx(); } },
      { icon: 'calendar-plus', label: 'New event', run: function () { F.event(); } },
      { icon: 'flame', label: 'New habit', run: function () { F.habit(); } },
      { icon: 'notebook-pen', label: 'Write in journal', run: function () { Z.go('journal'); } }
    ]);
  };
  Z.actions.addTask = function () { F.task(); };
  Z.actions.addTx = function () { F.tx(); };
  Z.actions.addEvent = function (el) { F.event(null, { date: el && el.dataset.arg || Z.today() }); };
  Z.actions.addHabit = function () { F.habit(); };
  Z.actions.addAccount = function () { F.account(); };
})();
