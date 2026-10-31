/* ZERO OS — Habits: daily habits, private behaviour tracker, configurable 100-day challenge */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc, F = Z.forms;
  var tab = 'habits', selDate = null, calMonth = null, showArchived = false, showStats = false;
  var HELP = {
    habits: ['Daily habits', 'Things you want to <b>do</b> regularly — like “Pray”, “Exercise” or “Read 20 minutes”. Tap the circle each day you do it. Pick days of the week when you add one.'],
    behaviour: ['Quit tracker', 'Things you want to <b>stop or do less</b>. Add one, then tap <b>Clean today</b> every day you manage it. If you slip, tap <b>Record a slip</b> — no shame: your total stays, only the current run restarts.'],
    challenge: ['100-day challenge', 'One big goal for 100 days. Tap <b>Check in</b> once a day. Missing a day never resets it — every day you complete counts.']
  };
  function helpDone() { return Z.meta.get('helpDone', {}); }
  function helpCard(n) {
    if (helpDone()[tab]) return '';
    var h = HELP[tab];
    return '<div class="helpcard ' + Z.rz(n || 1) + '"><span style="color:var(--acc);margin-top:1px">' + ic('lightbulb') + '</span><div class="grow"><p><b>' + h[0] + '.</b> ' + h[1] + '</p></div><button class="x" data-act="hHelpHide" aria-label="Hide tip">' + ic('x') + '</button></div>';
  }
  var IDEAS = ['Drink water', 'Pray', 'Exercise', 'Read 20 min', 'Study 1 hour', 'Sleep by 10pm'];

  function today() { return Z.today(); }
  function sel() { return selDate || today(); }

  /* ---------- HABITS TAB ---------- */
  function habitRow(h, date, n) {
    var done = L.isDone(h, date), st = L.habitStreak(h), c = h.color || '#FF6B3D';
    return '<div class="item ' + (done ? 'done' : '') + ' rz" style="--n:' + n + '">' +
      '<button class="check ' + (done ? 'on' : '') + '" style="--c:' + c + '" data-act="hToggle" data-id="' + h.id + '" aria-label="' + (done ? 'Mark not done' : 'Mark done') + ': ' + esc(h.name) + '" aria-pressed="' + done + '">' + ic('check') + '</button>' +
      '<button class="grow item-main" data-act="hDetail" data-id="' + h.id + '" style="text-align:left;display:block"><div class="ti">' + esc(h.name) + '</div>' +
      '<div class="su">' + (h.days && h.days.length ? h.days.slice().sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); }).map(function (d) { return Z.DAYN[d].slice(0, 3); }).join(' · ') : 'Every day') + (h.reminder ? ' · ' + h.reminder : '') + '</div></button>' +
      (st > 1 ? '<span class="streak">' + ic('flame') + st + '</span>' : '') +
      '<span class="avatar" style="--c:' + c + ';width:34px;height:34px;border-radius:11px">' + ic(h.icon || 'flame') + '</span></div>';
  }
  function weekStrip(date) {
    var ws = Z.weekStart(date), t = today();
    return '<div class="stripdays">' + Z.range(ws, Z.addDays(ws, 6)).map(function (d) {
      var r = L.dayHabits(d);
      return '<button class="' + (d === date ? 'on ' : '') + (d === t ? 'today ' : '') + (r.total && r.done === r.total ? 'has' : '') + '" data-act="hDate" data-date="' + d + '" aria-label="' + Z.fmtLong(d) + '"><span>' + Z.fmtDow(d).slice(0, 3) + '</span><b>' + Z.d(d).getUTCDate() + '</b><i></i></button>';
    }).join('') + '</div>';
  }
  function habitsTab() {
    var date = sel(), all = L.habits(), t = today();
    if (!all.length && !L.habits(true).length) {
      return helpCard(1) + '<div class="card ' + Z.rz(2) + '">' + U.empty('flame', 'Build your first habit', 'Pick one below to start, or make your own. Choose something you can do even on a bad day.', { act: 'hNew', label: 'Create my own' }) +
        '<div class="pills" style="justify-content:center;margin-top:14px">' + IDEAS.map(function (n) { return '<button class="pill2" data-act="hIdea" data-name="' + esc(n) + '">' + ic('plus') + esc(n) + '</button>'; }).join('') + '</div></div>';
    }
    var day = L.dayHabits(date), week = L.rangeRate(Z.weekStart(t), t), month = L.rangeRate(Z.monthStart(t), t);
    var notToday = all.filter(function (h) { return !L.habitScheduled(h, date); });
    var bestNow = all.reduce(function (m, h) { return Math.max(m, L.habitStreak(h)); }, 0);
    var html = helpCard(0);
    html += '<section class="card hero ' + Z.rz(1) + '"><div class="hero-rings">' +
      U.ring({ size: 112, stroke: 12, value: day.rate, color: '#FF6B3D', mid: '<div class="mid" style="font-size:26px;position:static">' + day.done + '<span class="dim" style="font-size:15px;font-weight:600">/' + day.total + '</span></div>' }) +
      '<div class="grow"><div class="label">' + (date === t ? 'Today' : Z.fmtLong(date)) + '</div><div class="mid" style="margin:6px 0 4px">' +
      (day.total === 0 ? 'Nothing scheduled' : day.done === day.total ? 'All done' : (day.total - day.done) + ' to go') + '</div>' +
      '<div class="small muted">' + (bestNow > 1 ? '<span class="streak" style="display:inline-flex;vertical-align:middle">' + ic('flame') + bestNow + '-day best streak running</span>' : 'Consistency beats intensity.') + '</div></div></div></section>';
    html += '<section class="' + Z.rz(2) + '">' + weekStrip(date) + '</section>';
    html += '<section class="card ' + Z.rz(3) + '"><div class="head"><h3>' + (date === t ? 'Today’s habits' : Z.fmt(date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</h3>' + (date !== t ? '<button class="link" data-act="hDate" data-date="' + t + '">Back to today</button>' : '') + '</div>' +
      (day.list.length ? '<div class="list">' + day.list.map(function (h, i) { return habitRow(h, date, 4 + i); }).join('') + '</div>' : '<p class="muted small">No habits scheduled for this day.</p>') +
      (date > t ? '<p class="xs dim" style="margin-top:10px">This day hasn’t happened yet — you can tick it off when it does.</p>' : '') + '</section>';
    if (notToday.length) html += '<section class="card flat ' + Z.rz(5) + '"><div class="label" style="margin-bottom:8px">Not scheduled on this day</div>' + notToday.map(function (h) { return '<button class="item tap" data-act="hDetail" data-id="' + h.id + '"><span class="avatar" style="--c:' + (h.color || '#FF6B3D') + ';width:34px;height:34px;border-radius:11px">' + ic(h.icon || 'flame') + '</span><div class="grow"><div class="ti" style="font-size:15px;color:var(--ink2)">' + esc(h.name) + '</div></div>' + ic('chevron-right') + '</button>'; }).join('') + '</section>';
    html += '<button class="btn block ' + Z.rz(6) + '" data-act="hStats">' + ic(showStats ? 'chevron-up' : 'chart-column') + (showStats ? 'Hide stats & calendar' : 'Show stats & calendar') + '</button>';
    if (showStats) {
    html += '<div class="grid2 ' + Z.rz(6) + '"><div class="card"><div class="label">This week</div><div class="big" style="margin-top:10px;font-size:34px">' + U.count(week.rate * 100, 'pct') + '</div><div class="small dim" style="margin-top:6px">' + week.done + ' of ' + week.due + ' done</div></div>' +
      '<div class="card"><div class="label">This month</div><div class="big" style="margin-top:10px;font-size:34px">' + U.count(month.rate * 100, 'pct') + '</div><div class="small dim" style="margin-top:6px">' + month.done + ' of ' + month.due + ' done</div></div></div>';
    html += '<section class="card ' + Z.rz(7) + '"><div class="head"><div class="label">' + ic('chart-column') + 'Last 14 days</div></div><div class="chartbox sm"><canvas id="hchart"></canvas></div></section>';
    // calendar
    var cm = calMonth || Z.monthStart(date);
    html += '<section class="card ' + Z.rz(8) + '"><div class="head"><button class="iconbtn sm" data-act="hMonth" data-d="-1" aria-label="Previous month">' + ic('chevron-left') + '</button><h3>' + Z.fmtMonth(cm) + '</h3><button class="iconbtn sm" data-act="hMonth" data-d="1" aria-label="Next month">' + ic('chevron-right') + '</button></div>' +
      '<div id="hcal" class="fade-swap">' + U.monthGrid({
        month: cm, selected: date, cls: 'heat', cell: function (d, inM) {
          var r = L.dayHabits(d), past = d <= today();
          return { style: past && r.total ? '--lv:' + (r.rate * .55).toFixed(2) : '', inner: '<span class="dots">' + (past && r.total && r.done === r.total ? '<i></i>' : '') + '</span>' };
        }
      }) + '</div><div class="legend"><span><i style="--c:var(--acc);opacity:.25"></i>Some</span><span><i style="--c:var(--acc);opacity:.6"></i>Most</span><span>Dot = all habits done</span></div></section>';
    }
    // archived
    var arch = L.habits(true).filter(function (h) { return h.archived; });
    if (arch.length) html += '<section class="card flat ' + Z.rz(9) + '"><button class="row between" style="width:100%" data-act="hArchToggle"><span class="label">Archived (' + arch.length + ')</span>' + ic(showArchived ? 'chevron-up' : 'chevron-down') + '</button><div class="expand ' + (showArchived ? 'open' : '') + '"><div>' +
      arch.map(function (h) { return '<div class="item"><span class="avatar" style="--c:' + (h.color || '#888') + '">' + ic(h.icon || 'flame') + '</span><div class="grow"><div class="ti">' + esc(h.name) + '</div></div><button class="btn sm" data-act="hUnarch" data-id="' + h.id + '">Restore</button></div>'; }).join('') + '</div></div></section>';
    return html;
  }

  /* ---------- BEHAVIOUR TAB ---------- */
  function lastDots(st) {
    var t = today(), out = '';
    for (var i = 6; i >= 0; i--) { var d = Z.addDays(t, -i), l = st.map[d], on = d < st.start ? 'n' : (l && l.status === 'slip' ? 's' : 'c'); out += '<i title="' + Z.fmt(d) + '" style="width:12px;height:12px;border-radius:50%;display:inline-block;background:' + (on === 'c' ? 'var(--good)' : on === 's' ? 'var(--warn)' : 'rgba(255,255,255,.12)') + ';opacity:' + (on === 'c' ? 1 : on === 's' ? .9 : .6) + '"></i>'; }
    return '<span style="display:inline-flex;gap:6px;align-items:center">' + out + '</span>';
  }
  function behaviourTab() {
    var bs = L.behaviours(), html = '';
    html += helpCard(1) + '<button class="urgebtn ' + Z.rz(2) + '" data-act="urge"><span style="color:var(--c-habits)">' + ic('wind') + '</span><span>I’m having an urge<small>A 10-minute pause with breathing and a kind message</small></span></button>';
    if (!bs.length) return html + '<div class="card ' + Z.rz(2) + '">' + U.empty('shield', 'Nothing tracked yet', 'Add one thing you want to stop or do less, like “Late-night scrolling”. Only you can see this.', { act: 'bNew', label: 'Add something to quit' }) + '</div>';
    bs.forEach(function (b, i) {
      var st = L.behaviourStats(b), t = today(), lg = st.todayLog;
      html += '<section class="card ' + Z.rz(2 + i) + '"><div class="head"><h3>' + esc(b.name) + '</h3><button class="iconbtn sm" data-act="bMenu" data-id="' + b.id + '" aria-label="More">' + ic('ellipsis') + '</button></div>' +
        '<div class="row" style="align-items:flex-end;gap:18px"><div><div class="big" style="font-size:52px;color:var(--good)">' + U.count(st.current) + '</div><div class="small muted" style="margin-top:4px">day' + (st.current === 1 ? '' : 's') + ' in the current run</div></div>' +
        '<div class="grow" style="text-align:right"><div class="small dim">Best run <b style="color:var(--ink)">' + st.best + '</b></div><div class="small dim" style="margin-top:3px">Total clean days <b style="color:var(--ink)">' + st.total + '</b></div></div></div>' +
        '<div class="row between" style="margin-top:14px"><span class="xs dim">Last 7 days</span>' + lastDots(st) + '</div>' +
        '<div class="row" style="margin-top:16px;gap:10px">' +
        (lg ? '<div class="grow small ' + (lg.status === 'slip' ? 'warn' : 'good') + '" style="font-weight:620">' + ic(lg.status === 'slip' ? 'heart' : 'circle-check') + ' ' + (lg.status === 'slip' ? 'Slip recorded today — tomorrow is a fresh start' : 'Clean day recorded today') + '</div><button class="btn sm" data-act="bUndo" data-id="' + b.id + '">Undo</button>'
          : '<button class="btn primary grow" data-act="bClean" data-id="' + b.id + '">' + ic('check') + 'Clean today</button><button class="btn" data-act="bSlip" data-id="' + b.id + '">Record a slip</button>') + '</div>' +
        '<button class="link" style="margin-top:12px" data-act="bDetail" data-id="' + b.id + '">History & insights ' + ic('chevron-right') + '</button></section>';
    });
    return html;
  }
  function slipSheet(b, date, existing) {
    date = date || today(); existing = existing || {};
    U.sheet({
      title: existing.status === 'slip' ? 'Edit slip' : 'Record a slip',
      body: '<form class="form"><p class="muted" style="margin-top:-4px">It happens. Noting what led to it helps you spot patterns — nothing is deleted and your total stays.</p>' +
        U.field('What was going on? (optional)', U.chipSelect('btrig', L.TRIGGERS, existing.triggers || [], true), 'btrig') +
        U.field('Note (optional)', U.textarea('bnote', existing.note, 'Anything you want to remember…', 3), 'bnote') + U.footer({ save: 'Save, and keep going' }) + '</form>',
      onMount: function (root, api) {
        U.wire(root);
        Z.$('form', root).addEventListener('submit', function (e) {
          e.preventDefault(); S.put('behaviourLogs', { id: b.id + '_' + date, behId: b.id, date: date, status: 'slip', note: U.val(root, 'bnote'), triggers: U.chipVal(root, 'btrig') });
          api.close(); U.toast('Saved. Tomorrow is a fresh start.', 'info');
        });
      }
    });
  }
  function behaviourDetail(b) {
    var st = L.behaviourStats(b), cm = Z.monthStart(today());
    var trig = Object.keys(st.triggers).sort(function (a, c) { return st.triggers[c] - st.triggers[a]; });
    var api = U.sheet({
      title: b.name,
      body: '<div class="stack"><div class="grid3"><div class="kpi"><div class="label">Current</div><div class="v good">' + st.current + '</div></div><div class="kpi"><div class="label">Best</div><div class="v">' + st.best + '</div></div><div class="kpi"><div class="label">Clean days</div><div class="v">' + st.total + '</div></div></div>' +
        '<div class="row between"><button class="iconbtn sm" data-bcal="-1" aria-label="Previous month">' + ic('chevron-left') + '</button><h3 id="bcm" style="font-size:17px">' + Z.fmtMonth(cm) + '</h3><button class="iconbtn sm" data-bcal="1" aria-label="Next month">' + ic('chevron-right') + '</button></div><div id="bcal"></div>' +
        '<div class="legend"><span><i style="--c:var(--good)"></i>Clean</span><span><i style="--c:var(--warn)"></i>Slip (tap to edit)</span></div>' +
        (trig.length ? '<div><div class="label" style="margin-bottom:8px">Common triggers</div><div class="chips">' + trig.map(function (k) { return '<span class="badge" style="--c:var(--warn)">' + esc(k) + ' · ' + st.triggers[k] + '</span>'; }).join('') + '</div></div>' : '') +
        '<p class="xs dim">' + st.slips + ' slip' + (st.slips === 1 ? '' : 's') + ' recorded since ' + Z.fmt(st.start, { day: 'numeric', month: 'short', year: 'numeric' }) + '. Every clean day you’ve had still counts.</p></div>',
      onMount: function (root) {
        function draw() {
          var s = L.behaviourStats(b);
          Z.$('#bcm', root).textContent = Z.fmtMonth(cm);
          Z.$('#bcal', root).innerHTML = U.monthGrid({ month: cm, selected: '', cell: function (d) {
            var l = s.map[d], inRange = d >= s.start && d <= today();
            var cls = !inRange ? '' : (l && l.status === 'slip' ? 'slipd' : 'cleand');
            return { style: !inRange ? '' : 'background:' + (l && l.status === 'slip' ? 'rgba(255,201,61,.3)' : 'rgba(52,211,153,.2)'), inner: '<span class="dots"></span>' };
          } });
        }
        draw();
        root.addEventListener('click', function (e) {
          var n = e.target.closest('[data-bcal]'); if (n) { cm = Z.addMonths(cm, +n.dataset.bcal); draw(); return; }
          var d = e.target.closest('[data-date]'); if (!d) return; var date = d.dataset.date; if (date < st.start || date > today()) return;
          var l = L.behaviourStats(b).map[date];
          if (l && l.status === 'slip') { api.close(); slipSheet(b, date, l); }
          else U.choice({ title: Z.fmtLong(date), text: l ? 'Clean day recorded.' : 'Nothing recorded yet.', options: [{ label: 'Mark clean', value: 'c', primary: true }, { label: 'Record a slip', value: 's' }] }).then(function (v) {
            if (v === 'c') { S.put('behaviourLogs', { id: b.id + '_' + date, behId: b.id, date: date, status: 'clean', note: '', triggers: [] }); draw(); }
            if (v === 's') { api.close(); slipSheet(b, date, l); }
          });
        });
      }
    });
  }
  function behaviourForm(b) {
    b = b || {};
    F.sheet({
      title: b.id ? 'Edit behaviour' : 'New behaviour',
      fields: U.field('What do you want to stop or reduce?', U.input('bname', b.name, { ph: 'e.g. Late-night scrolling', max: 60, autofocus: true }), 'bname') +
        U.field('Counting from', U.input('bstart', b.startDate || today(), { type: 'date' }), 'bstart', 'Days since this date count as clean unless you record a slip.'),
      onSubmit: function (root) {
        var n = U.val(root, 'bname'); if (!n) { U.fail(root, 'bname', 'Give it a name only you will understand.'); return false; }
        var s = U.val(root, 'bstart') || today(); if (s > today()) { U.fail(root, 'bstart', 'Start date cannot be in the future.'); return false; }
        S.put('behaviours', Object.assign({}, b, { name: n, startDate: s })); U.toast(b.id ? 'Updated' : 'Added');
      },
      onDelete: b.id ? function (api) { U.confirm({ title: 'Delete "' + b.name + '"?', text: 'Its whole history will be removed.', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.batch(function () { L.behaviourLogs(b).forEach(function (l) { S.del('behaviourLogs', l.id); }); S.del('behaviours', b.id); }); api.close(); U.toast('Deleted'); } }); } : null
    });
  }

  /* ---------- CHALLENGE TAB ---------- */
  function challengeTab() {
    var c = L.challenge(), html = helpCard(0);
    if (!c) {
      return html + '<div class="card hero ' + Z.rz(1) + '"><div class="empty"><div class="orb">' + ic('mountain') + '</div><h4>Your 100-day challenge</h4><p>Pick one meaningful goal and show up for it every day. Missed a day? No punishment — just carry on.</p><button class="btn primary" data-act="cSetup">' + ic('play') + 'Start a challenge</button></div></div>';
    }
    var t = today(), status = c.notStarted ? 'Starts ' + Z.fmt(c.startDate) : c.finished ? 'Challenge finished' : 'Day ' + c.dayNo + ' of ' + c.days;
    html += '<section class="card hero ' + Z.rz(1) + '"><div class="head"><div><div class="label">' + esc(c.name) + '</div></div><button class="iconbtn sm" data-act="cMenu" aria-label="More">' + ic('ellipsis') + '</button></div>' +
      '<div class="hero-rings">' + U.ring({ size: 128, stroke: 13, value: c.done / c.days, color: 'var(--acc)', mid: '<div class="mid" style="font-size:30px;position:static">' + U.count(c.pct, 'pct') + '</div>' }) +
      '<div class="grow"><div class="mid">' + status + '</div><div class="small muted" style="margin-top:6px">' + c.done + ' completed · ' + c.remaining + ' to go</div>' +
      (c.goal ? '<div class="small" style="margin-top:8px;color:var(--ink2)">“' + esc(c.goal) + '”</div>' : '') + '</div></div>' +
      (!c.notStarted && !c.finished ? '<div style="margin-top:18px">' + (c.doneToday ? '<div class="row" style="justify-content:center;gap:8px;color:var(--good);font-weight:650">' + ic('circle-check') + 'Checked in today <button class="btn sm ghost" data-act="cDay" data-date="' + t + '">Edit</button></div>' : '<button class="btn primary block" data-act="cDay" data-date="' + t + '">' + ic('check') + 'Check in for today</button>') + '</div>' : '') + '</section>';
    html += '<div class="grid3 ' + Z.rz(2) + '"><div class="kpi"><div class="label">Day</div><div class="v">' + c.dayNo + '</div></div><div class="kpi"><div class="label">Streak</div><div class="v">' + c.streak + '</div></div><div class="kpi"><div class="label">Best</div><div class="v">' + c.best + '</div></div></div>';
    html += '<section class="card ' + Z.rz(3) + '"><div class="head"><div class="label">' + ic('layers') + 'Calendar</div><span class="xs dim">Tap a day to check in or edit</span></div><div class="dots100">' +
      Z.range(c.startDate, c.endDate).map(function (d, i) {
        var on = c.logs[d] && c.logs[d].done, fut = d > t, isT = d === t;
        return '<button class="' + (on ? 'done ' : '') + (isT ? 'today ' : '') + (fut ? 'future ' : '') + (!on && !fut && !isT ? 'miss' : '') + '" style="--d:' + i + '" ' + (fut ? 'disabled' : '') + ' data-act="cDay" data-date="' + d + '" aria-label="Day ' + (i + 1) + ', ' + Z.fmt(d) + (on ? ', completed' : '') + '">' + (c.days <= 100 ? (i + 1) : '') + '</button>';
      }).join('') + '</div></section>';
    html += '<section class="card ' + Z.rz(4) + '"><div class="head"><div class="label">' + ic('trophy') + 'Milestones</div></div><div class="grid3" style="grid-template-columns:repeat(4,1fr)">' +
      L.MILESTONES.filter(function (m) { return m.n <= c.days; }).map(function (m) { var on = c.done >= m.n; return '<div class="ach ' + (on ? 'on' : '') + '">' + ic(m.icon) + '<b>' + m.n + '</b>' + m.label + '</div>'; }).join('') + '</div></section>';
    html += '<p class="xs dim rz" style="--n:5;text-align:center;padding:4px 20px">Missed days don’t reset your challenge — every day you complete counts toward the ' + c.days + '.</p>';
    return html;
  }
  function challengeForm(existing) {
    existing = existing || {};
    F.sheet({
      title: existing.startDate ? 'Edit challenge' : 'New challenge',
      fields: U.field('Name', U.input('cname', existing.name || '100-day challenge', { max: 50, autofocus: true }), 'cname') +
        U.field('Your why (optional)', U.input('cgoal', existing.goal, { ph: 'e.g. Become disciplined and focused', max: 120 }), 'cgoal') +
        '<div class="grid2">' + U.field('Starts', U.input('cstart', existing.startDate || today(), { type: 'date' }), 'cstart') + U.field('Length (days)', U.input('cdays', existing.days || 100, { type: 'number', inputmode: 'numeric', min: 7 }), 'cdays') + '</div>' +
        U.field('Daily reminder (optional)', U.input('crem', Z.settings().challengeReminder || '', { type: 'time' }), 'crem'),
      onSubmit: function (root) {
        var name = U.val(root, 'cname'); if (!name) { U.fail(root, 'cname', 'Name your challenge.'); return false; }
        var days = parseInt(U.val(root, 'cdays'), 10); if (!(days >= 7 && days <= 366)) { U.fail(root, 'cdays', 'Choose between 7 and 366 days.'); return false; }
        var start = U.val(root, 'cstart'); if (!start) { U.fail(root, 'cstart', 'Pick a start date.'); return false; }
        Z.setSettings({ challenge: { name: name, goal: U.val(root, 'cgoal'), startDate: start, days: days }, challengeReminder: U.val(root, 'crem') });
        U.toast(existing.startDate ? 'Challenge updated' : 'Challenge started'); if (!existing.startDate) U.celebrate('Day one', 'Show up, even a little.', 'mountain');
      }
    });
  }
  function daySheet(date) {
    var c = L.challenge(), log = c.logs[date], done = !!(log && log.done), dayNo = Z.diff(c.startDate, date) + 1;
    U.sheet({
      title: 'Day ' + dayNo + ' · ' + Z.fmt(date),
      body: '<form class="form">' + U.field('How did it go? (optional)', U.textarea('cnote', log && log.note, 'A line about today…', 3), 'cnote') +
        '<div class="sh-foot">' + (done ? '<button type="button" class="btn danger" data-undo>Mark not done</button>' : '') + '<button type="submit" class="btn primary" style="flex:2">' + (done ? 'Save note' : 'Mark day complete') + '</button></div></form>',
      onMount: function (root, api) {
        Z.$('form', root).addEventListener('submit', function (e) {
          e.preventDefault(); var before = L.challenge().done;
          S.put('challengeLogs', { id: 'ch_' + date, date: date, done: true, note: U.val(root, 'cnote') });
          api.close(); var after = L.challenge().done;
          var ms = L.MILESTONES.filter(function (m) { return m.n > before && m.n <= after && m.n <= c.days; }).pop();
          if (ms && !done) U.celebrate(ms.label, after + ' days completed', ms.icon); else if (!done) U.celebrate('Day ' + dayNo + ' done', after + ' of ' + c.days + ' complete', 'check'); else U.toast('Saved');
        });
        var u = Z.$('[data-undo]', root); if (u) u.addEventListener('click', function () { S.del('challengeLogs', 'ch_' + date); api.close(); U.toast('Day unmarked', 'info'); });
      }
    });
  }

  /* ---------- habit detail ---------- */
  function habitDetail(h) {
    var t = today(), w = L.habitRate(h, Z.addDays(t, -6), t), m = L.habitRate(h, Z.addDays(t, -29), t), total = S.all('habitLogs').filter(function (l) { return l.habitId === h.id; }).length, cm = Z.monthStart(t);
    var api = U.sheet({
      title: h.name,
      body: '<div class="stack"><div class="grid3"><div class="kpi"><div class="label">Streak</div><div class="v flame">' + L.habitStreak(h) + '</div></div><div class="kpi"><div class="label">Best</div><div class="v">' + L.habitBest(h) + '</div></div><div class="kpi"><div class="label">Total</div><div class="v">' + total + '</div></div></div>' +
        '<div class="grid2"><div class="kpi"><div class="label">Last 7 days</div><div class="v">' + Math.round(w.rate * 100) + '%</div></div><div class="kpi"><div class="label">Last 30 days</div><div class="v">' + Math.round(m.rate * 100) + '%</div></div></div>' +
        '<div class="row between"><button class="iconbtn sm" data-hcal="-1" aria-label="Previous month">' + ic('chevron-left') + '</button><h3 id="hcm" style="font-size:17px">' + Z.fmtMonth(cm) + '</h3><button class="iconbtn sm" data-hcal="1" aria-label="Next month">' + ic('chevron-right') + '</button></div><div id="hdcal"></div>' +
        '<div class="sh-foot"><button class="btn" data-edit>' + ic('pencil') + 'Edit</button><button class="btn" data-arch>' + ic('archive') + (h.archived ? 'Restore' : 'Archive') + '</button></div></div>',
      onMount: function (root) {
        function draw() {
          Z.$('#hcm', root).textContent = Z.fmtMonth(cm);
          Z.$('#hdcal', root).innerHTML = U.monthGrid({ month: cm, selected: '', cell: function (d) {
            var sch = L.habitScheduled(h, d), done = L.isDone(h, d);
            return { style: done ? 'background:' + (h.color || '#FF6B3D') + ';color:#07070A' : sch && d <= today() ? 'background:rgba(255,255,255,.05)' : 'opacity:.4', inner: '<span class="dots"></span>' };
          } });
        }
        draw();
        root.addEventListener('click', function (e) {
          var n = e.target.closest('[data-hcal]'); if (n) { cm = Z.addMonths(cm, +n.dataset.hcal); draw(); return; }
          var d = e.target.closest('[data-date]'); if (d && d.dataset.date <= today() && L.habitScheduled(h, d.dataset.date)) { L.toggleHabit(h, d.dataset.date); draw(); }
          if (e.target.closest('[data-edit]')) { api.close(); F.habit(h); }
          if (e.target.closest('[data-arch]')) { S.put('habits', Object.assign({}, h, { archived: !h.archived })); api.close(); U.toast(h.archived ? 'Habit restored' : 'Habit archived'); }
        });
      }
    });
  }

  /* ---------- actions ---------- */
  var A = Z.actions;
  A.hNew = function () { F.habit(); };
  A.hIdea = function (el) { var n = el.dataset.name; S.put('habits', { name: n, color: '#FF6B3D', icon: 'flame', days: [], startDate: today(), reminder: '', archived: false }); U.toast('Added “' + n + '”'); };
  A.hStats = function () { showStats = !showStats; Z.refresh(); };
  A.hHelpHide = function () { var d = Object.assign({}, helpDone()); d[tab] = 1; Z.meta.set('helpDone', d); Z.refresh(); };
  A.hHelpShow = function () { var d = Object.assign({}, helpDone()); delete d[tab]; Z.meta.set('helpDone', d); Z.refresh(); };
  A.hDate = function (el) { selDate = el.dataset.date; calMonth = Z.monthStart(selDate); Z.refresh(); };
  A.hMonth = function (el) { calMonth = Z.addMonths(calMonth || Z.monthStart(sel()), +el.dataset.d); Z.refresh(); };
  A.hArchToggle = function () { showArchived = !showArchived; Z.refresh(); };
  A.hUnarch = function (el) { var h = S.get('habits', el.dataset.id); if (h) { S.put('habits', Object.assign({}, h, { archived: false })); U.toast('Habit restored'); } };
  A.hDetail = function (el) { var h = S.get('habits', el.dataset.id); if (h) habitDetail(h); };
  A.hToggle = function (el) {
    var h = S.get('habits', el.dataset.id); if (!h) return;
    var date = sel(), now = L.toggleHabit(h, date);
    if (now) {
      el.classList.add('on', 'pulse'); if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { }
      var r = L.dayHabits(date), st = L.habitStreak(h);
      var streakMs = [7, 14, 30, 50, 100].indexOf(st) > -1;
      setTimeout(function () {
        if (streakMs) U.celebrate(st + '-day streak', h.name, 'flame');
        else if (r.total && r.done === r.total && date === today()) U.celebrate('All done for today', r.total + ' habit' + (r.total > 1 ? 's' : '') + ' completed', 'sparkles');
      }, 350);
    }
  };
  A.hGo = function (el) { tab = el.dataset.tab; Z.refresh(); };
  A.bNew = function () { behaviourForm(); };
  A.bMenu = function (el) {
    var b = S.get('behaviours', el.dataset.id); if (!b) return;
    U.menu(el, [{ icon: 'pencil', label: 'Edit', run: function () { behaviourForm(b); } }, { icon: 'archive', label: 'Archive', run: function () { S.put('behaviours', Object.assign({}, b, { archived: true })); U.toast('Archived'); } }]);
  };
  A.bClean = function (el) {
    var b = S.get('behaviours', el.dataset.id); if (!b) return;
    S.put('behaviourLogs', { id: b.id + '_' + today(), behId: b.id, date: today(), status: 'clean', note: '', triggers: [] });
    var st = L.behaviourStats(b); if ([1, 7, 14, 30, 60, 90, 100, 180, 365].indexOf(st.current) > -1) U.celebrate(st.current + ' clean day' + (st.current > 1 ? 's' : ''), 'Keep going, one day at a time.', 'shield-check'); else U.toast('Clean day recorded');
  };
  A.bSlip = function (el) { var b = S.get('behaviours', el.dataset.id); if (b) slipSheet(b, today()); };
  A.bUndo = function (el) { S.del('behaviourLogs', el.dataset.id + '_' + today()); };
  A.bDetail = function (el) { var b = S.get('behaviours', el.dataset.id); if (b) behaviourDetail(b); };
  A.cSetup = function () { challengeForm(); };
  A.cDay = function (el) { if (L.challenge()) daySheet(el.dataset.date); };
  A.cMenu = function (el) {
    var c = Z.settings().challenge;
    U.menu(el, [{ icon: 'pencil', label: 'Edit challenge', run: function () { challengeForm(c); } },
      { icon: 'rotate-ccw', label: 'Start over', danger: true, run: function () { U.confirm({ title: 'Start over?', text: 'This removes the current challenge and all its check-ins.', ok: 'Remove & start over', danger: true }).then(function (y) { if (y) { S.batch(function () { S.all('challengeLogs').forEach(function (l) { S.del('challengeLogs', l.id); }); Z.setSettings({ challenge: null }); }); U.toast('Challenge removed'); } }); } }]);
  };

  function bodyHtml() { return tab === 'habits' ? habitsTab() : tab === 'behaviour' ? behaviourTab() : challengeTab(); }
  function subFor() { return tab === 'habits' ? 'Things to do every day' : tab === 'behaviour' ? 'Things to stop — private to you' : 'One big goal, one day at a time'; }
  function hook(root) {
    var canvas = Z.$('#hchart', root);
    if (canvas) {
      var t = today(), days = Z.range(Z.addDays(t, -13), t), rates = days.map(function (d) { return Math.round(L.dayHabits(d).rate * 100); });
      U.chart(canvas, { type: 'bar', data: { labels: days.map(function (d) { return Z.d(d).getUTCDate(); }), datasets: [{ data: rates, borderRadius: 6, borderSkipped: false, backgroundColor: days.map(function (d) { return d === t ? '#FF6B3D' : 'rgba(255,107,61,.45)'; }) }] },
        options: { plugins: { tooltip: { callbacks: { title: function (i) { return Z.fmt(days[i[0].dataIndex]); }, label: function (c) { return c.raw + '% completed'; } } } }, scales: { y: { max: 100, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false }, ticks: { maxTicksLimit: 3, callback: function (v) { return v + '%'; } } }, x: { grid: { display: false }, border: { display: false } } } } });
    }
    var cal = Z.$('#hcal', root);
    if (cal) cal.addEventListener('click', function (e) { var d = e.target.closest('[data-date]'); if (d) { selDate = d.dataset.date; Z.refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  }

  /* ---------- view ---------- */
  Z.views.habits = {
    title: 'Habits', area: 'habits',
    render: function () {
      var body = bodyHtml();
      return Z.hd({ eyebrow: 'Discipline', title: 'Habits', sub: subFor(), acts: '<button class="iconbtn glass" data-act="hHelpShow" aria-label="Explain this page">' + ic('circle-help') + '</button>' }) +
        '<div class="rz" style="--n:1;margin-bottom:16px">' + U.seg('hseg', [{ v: 'habits', label: 'Daily' }, { v: 'behaviour', label: 'Quit' }, { v: 'challenge', label: '100 days' }], tab) + '</div><div class="cols" id="hbody">' + body + '</div>';
    },
    mount: function (root) {
      hook(root);
      U.bindSeg(root, 'hseg', function (v) {
        tab = v; var body = Z.$('#hbody', root); U.destroyCharts(); Z.entering = true;
        body.innerHTML = bodyHtml(); body.classList.add('entering'); hook(root); U.animate(body);
        var sub = Z.$('.hd .sub', root); if (sub) sub.textContent = subFor();
      });
    },
    fab: function () { if (tab === 'behaviour') behaviourForm(); else if (tab === 'challenge') { if (L.challenge()) { var c = L.challenge(); if (!c.notStarted && !c.finished) daySheet(today()); } else challengeForm(); } else F.habit(); }
  };
  Z.views.habits.goto = function (t) { tab = t; };
})();
