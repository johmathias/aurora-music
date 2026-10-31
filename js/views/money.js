/* ZERO OS — Money: overview charts, transactions, accounts, budgets, savings, CSV import/export */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store, L = Z.logic, esc = Z.esc, F = Z.forms;
  var mtab = 'overview', period = 'month', custom = null, txType = 'all', txAcc = '', txCat = '', txQ = '', txLimit = 60, budMonth = null, showArchAcc = false;
  var GREEN = '#34D399', RED = '#FF6B8A';

  /* ---------- period ---------- */
  function range() {
    var t = Z.today(), ms = Z.monthStart(t);
    if (period === 'month') return { a: ms, b: Z.monthEnd(ms), label: Z.fmtMonth(ms) };
    if (period === 'last') { var lm = Z.addMonths(ms, -1); return { a: lm, b: Z.monthEnd(lm), label: Z.fmtMonth(lm) }; }
    if (period === '3m') return { a: Z.addMonths(ms, -2), b: Z.monthEnd(ms), label: 'Last 3 months' };
    if (period === 'year') return { a: t.slice(0, 4) + '-01-01', b: t.slice(0, 4) + '-12-31', label: t.slice(0, 4) };
    if (period === 'custom' && custom) return { a: custom.a, b: custom.b, label: Z.fmt(custom.a) + ' – ' + Z.fmt(custom.b) };
    var all = S.all('transactions').map(function (x) { return x.date; }).sort();
    return { a: all[0] || t, b: t > (all[all.length - 1] || t) ? t : all[all.length - 1], label: 'All time' };
  }
  function periodChips() {
    return '<div class="chips scroll">' + [['month', 'This month'], ['last', 'Last month'], ['3m', '3 months'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']].map(function (p) {
      return '<button class="chip ' + (period === p[0] ? 'on' : '') + '" data-act="mPeriod" data-v="' + p[0] + '">' + (p[0] === 'custom' && period === 'custom' && custom ? ic('calendar') + ' ' + range().label : p[1]) + '</button>';
    }).join('') + '</div>';
  }
  function noAccounts() {
    return '<div class="card rz" style="--n:1">' + U.empty('wallet', 'Start with an account', 'Add where your money lives — Cash, M-Pesa, NMB, Airtel Money… then record your first transaction.', { act: 'addAccount', label: 'Add an account' }) + '</div>';
  }

  /* ---------- OVERVIEW ---------- */
  function overview() {
    if (!L.accounts().length) return noAccounts();
    var r = range(), sum = L.summary(r.a, r.b), total = L.totalBalance(), html = '';
    html += '<section class="card hero rz" style="--n:1"><div class="label">Total balance</div><div class="big" style="margin:10px 0 4px">' + U.count(total, 'money') + '</div><div class="small muted">' + L.accounts().length + ' account' + (L.accounts().length > 1 ? 's' : '') + '</div></section>';
    html += '<div class="rz" style="--n:2">' + periodChips() + '</div>';
    html += '<div class="kpis rz" style="--n:3"><div class="kpi"><div class="label"><span class="good">' + ic('arrow-down-left') + '</span>Income</div><div class="v good">' + U.count(sum.income, 'money', 'data-compact="1"') + '</div></div>' +
      '<div class="kpi"><div class="label"><span style="color:' + RED + '">' + ic('arrow-up-right') + '</span>Expenses</div><div class="v">' + U.count(sum.expense, 'money', 'data-compact="1"') + '</div></div>' +
      '<div class="kpi" style="grid-column:1/-1"><div class="label">Net cash flow · ' + esc(r.label) + '</div><div class="v ' + (sum.net >= 0 ? 'good' : 'bad') + '">' + (sum.net >= 0 ? '+' : '') + U.count(sum.net, 'money') + '</div></div></div>';
    if (!S.all('transactions').length) return html + '<div class="card rz" style="--n:4">' + U.empty('receipt', 'No transactions yet', 'Record income and spending to see charts appear here.', { act: 'addTx', label: 'Record a transaction' }) + '</div>';
    html += '<section class="card rz" style="--n:4"><div class="head"><div class="label">' + ic('chart-column') + 'Income vs expenses</div></div><div class="chartbox"><canvas id="c-flow"></canvas></div><div class="legend"><span><i style="--c:' + GREEN + '"></i>Income</span><span><i style="--c:' + RED + '"></i>Expenses</span></div></section>';
    var cats = Object.keys(sum.byCat).sort(function (a, b) { return sum.byCat[b] - sum.byCat[a]; });
    html += '<section class="card rz" style="--n:5"><div class="head"><div class="label">' + ic('chart-pie') + 'Spending by category</div></div>' + (cats.length ? '<div class="row" style="gap:18px;align-items:center"><div class="chartbox sm" style="width:150px;flex:none"><canvas id="c-cat"></canvas></div><div class="grow stack sm">' +
      cats.slice(0, 5).map(function (c) { return '<div class="row between small"><span class="row" style="gap:8px"><i style="width:9px;height:9px;border-radius:3px;background:' + Z.catColor(c) + '"></i>' + esc(c) + '</span><b>' + Z.money(sum.byCat[c], { compact: true, bare: true }) + '</b></div>'; }).join('') + (cats.length > 5 ? '<div class="xs dim">+ ' + (cats.length - 5) + ' more</div>' : '') + '</div></div>' : '<p class="muted small">No expenses in this period.</p>') + '</section>';
    html += '<section class="card rz" style="--n:6"><div class="head"><div class="label">' + ic('trending-up') + 'Monthly spending trend</div></div><div class="chartbox"><canvas id="c-trend"></canvas></div></section>';
    var bs = L.budgetStatus(Z.monthStart(Z.today())).slice(0, 3);
    html += '<section class="card rz" style="--n:7"><div class="head"><div class="label">' + ic('target') + 'Budgets this month</div><button class="link" data-act="mTab" data-v="budgets">Manage</button></div>' +
      (bs.length ? '<div class="stack">' + bs.map(budgetLine).join('') + '</div>' : '<p class="muted small" style="margin-bottom:12px">Set a monthly budget to see how much you have left to spend.</p><button class="btn sm" data-act="budNew">' + ic('plus') + 'Create budget</button>') + '</section>';
    var sv = S.all('savings');
    if (sv.length) html += '<section class="card rz" style="--n:8"><div class="head"><div class="label">' + ic('piggy-bank') + 'Savings</div><button class="link" data-act="mTab" data-v="savings">View</button></div><div class="stack">' + sv.slice(0, 3).map(function (g) { var p = L.savingsProgress(g); return '<div><div class="row between small" style="margin-bottom:6px"><span>' + esc(g.name) + '</span><b>' + Math.round(p.pct * 100) + '%</b></div>' + U.bar(p.pct * 100, GREEN) + '</div>'; }).join('') + '</div></section>';
    return html;
  }
  function budgetLine(s) {
    var c = s.over ? RED : s.pct > .8 ? '#FFC93D' : GREEN;
    return '<div><div class="row between small" style="margin-bottom:6px"><span style="font-weight:600">' + (s.b.category ? esc(s.b.category) : 'Overall') + '</span><span class="' + (s.over ? 'bad' : 'dim') + '">' + Z.money(s.spent, { compact: true, bare: true }) + ' / ' + Z.money(s.amount, { compact: true, bare: true }) + '</span></div>' + U.bar(s.pct * 100, c) + '</div>';
  }

  /* ---------- TRANSACTIONS ---------- */
  function filtered() {
    var r = range(), q = txQ.toLowerCase();
    return L.transactions().filter(function (t) {
      if (t.date < r.a || t.date > r.b) return false;
      if (txType !== 'all' && t.type !== txType) return false;
      if (txAcc && t.accountId !== txAcc && t.toAccountId !== txAcc) return false;
      if (txCat && t.category !== txCat) return false;
      if (q && (t.desc || '').toLowerCase().indexOf(q) < 0 && (t.category || '').toLowerCase().indexOf(q) < 0 && (t.notes || '').toLowerCase().indexOf(q) < 0 && String(t.amount).indexOf(q) < 0) return false;
      return true;
    });
  }
  function txRow(t) {
    var isT = t.type === 'transfer', c = isT ? '#3DB8FF' : t.type === 'income' ? GREEN : Z.catColor(t.category);
    var amt = isT ? Z.money(t.amount, { bare: true }) : (t.type === 'income' ? '+' : '−') + Z.money(t.amount, { bare: true });
    return '<button class="item tap" data-act="xEdit" data-id="' + t.id + '"><span class="avatar" style="--c:' + c + '">' + ic(isT ? 'arrow-left-right' : t.type === 'income' ? 'arrow-down-left' : 'arrow-up-right') + '</span><div class="grow" style="min-width:0"><div class="ti" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.desc || (isT ? 'Transfer' : t.category || 'Transaction')) + '</div><div class="su">' + (isT ? esc(L.accountName(t.accountId)) + ' → ' + esc(L.accountName(t.toAccountId)) : esc(t.category || '') + ' · ' + esc(L.accountName(t.accountId))) + '</div></div><div class="num" style="font-weight:680;color:' + (isT ? 'var(--c-schedule)' : t.type === 'income' ? 'var(--good)' : 'var(--ink)') + '">' + amt + '</div></button>';
  }
  Z.txRow = txRow;
  function txTab() {
    if (!L.accounts().length) return noAccounts();
    var list = filtered(), html = '', accs = L.accounts(true), cats = Z.EXP_CATS.concat(Z.INC_CATS.filter(function (c) { return Z.EXP_CATS.indexOf(c) < 0; }));
    html += '<div class="rz" style="--n:1">' + periodChips() + '</div>';
    html += '<div class="search rz" style="--n:2">' + ic('search') + '<input class="input" id="xq" type="search" placeholder="Search description, category, amount" value="' + esc(txQ) + '" aria-label="Search transactions"></div>';
    html += '<div class="chips scroll rz" style="--n:2">' + [['all', 'All'], ['expense', 'Expenses'], ['income', 'Income'], ['transfer', 'Transfers']].map(function (f) { return '<button class="chip ' + (txType === f[0] ? 'on' : '') + '" data-act="xType" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
    html += '<div class="grid2 rz" style="--n:3">' + U.select('xaccf', [{ v: '', label: 'All accounts' }].concat(accs.map(function (a) { return { v: a.id, label: a.name }; })), txAcc) + U.select('xcatf', [{ v: '', label: 'All categories' }].concat(cats), txCat) + '</div>';
    var inc = Z.sum(list.filter(function (t) { return t.type === 'income'; }), function (t) { return +t.amount; }), exp = Z.sum(list.filter(function (t) { return t.type === 'expense'; }), function (t) { return +t.amount; });
    html += '<div class="row between small dim rz" style="--n:3;padding:0 4px"><span>' + list.length + ' transaction' + (list.length === 1 ? '' : 's') + '</span><span><span class="good">+' + Z.money(inc, { bare: true, compact: true }) + '</span> · −' + Z.money(exp, { bare: true, compact: true }) + '</span></div>';
    if (!list.length) return html + '<div class="card rz" style="--n:4">' + U.empty('receipt', S.all('transactions').length ? 'No matches' : 'No transactions yet', S.all('transactions').length ? 'Try a different period or clear the filters.' : 'Record your first income or expense.', { act: 'addTx', label: 'Record a transaction' }) + '</div>';
    var byDay = {}, order = []; list.slice(0, txLimit).forEach(function (t) { if (!byDay[t.date]) { byDay[t.date] = []; order.push(t.date); } byDay[t.date].push(t); });
    order.forEach(function (d, i) {
      var day = byDay[d], net = Z.sum(day, function (t) { return t.type === 'income' ? +t.amount : t.type === 'expense' ? -t.amount : 0; });
      html += '<section class="card rz" style="--n:' + Math.min(4 + i, 9) + '"><div class="head"><div class="label">' + Z.rel(d) + (Z.diff(Z.today(), d) < -7 ? '' : ' · ' + Z.fmt(d)) + '</div><span class="small ' + (net >= 0 ? 'good' : 'dim') + '">' + Z.money(net, { plus: true, bare: true, compact: true }) + '</span></div><div class="list">' + day.map(txRow).join('') + '</div></section>';
    });
    if (list.length > txLimit) html += '<button class="btn block" data-act="xMore">Show more (' + (list.length - txLimit) + ' left)</button>';
    return html;
  }

  /* ---------- ACCOUNTS ---------- */
  function accountsTab() {
    var accs = L.accounts(), bal = L.balances(), html = '';
    if (!accs.length) return noAccounts();
    html += '<section class="card hero rz" style="--n:1"><div class="label">Net worth across accounts</div><div class="big" style="margin:10px 0 4px">' + U.count(L.totalBalance(), 'money') + '</div></section>';
    html += '<section class="card rz" style="--n:2"><div class="head"><h3>Accounts</h3><button class="link" data-act="addAccount">' + ic('plus') + 'Add</button></div><div class="list">' + accs.map(function (a, i) {
      var b = bal[a.id] || 0, c = L.accColor(a, i);
      return '<button class="item tap" data-act="aOpen" data-id="' + a.id + '"><span class="avatar" style="--c:' + c + '">' + ic(L.accIcon(a.type)) + '</span><div class="grow"><div class="ti">' + esc(a.name) + '</div><div class="su">' + (Z.ACCOUNT_TYPES.filter(function (t) { return t.v === a.type; })[0] || { label: 'Account' }).label + '</div></div><div class="num" style="font-weight:700;color:' + (b < 0 ? 'var(--bad)' : 'var(--ink)') + '">' + Z.money(b) + '</div></button>';
    }).join('') + '</div></section>';
    html += '<section class="card rz" style="--n:3"><div class="head"><div class="label">' + ic('chart-column') + 'Balance by account</div></div><div class="chartbox sm" style="height:' + Math.max(120, accs.length * 44) + 'px"><canvas id="c-acc"></canvas></div></section>';
    var arch = L.accounts(true).filter(function (a) { return a.archived; });
    if (arch.length) html += '<section class="card flat rz" style="--n:4"><button class="row between" style="width:100%" data-act="aArch"><span class="label">Archived (' + arch.length + ')</span>' + ic(showArchAcc ? 'chevron-up' : 'chevron-down') + '</button><div class="expand ' + (showArchAcc ? 'open' : '') + '"><div>' + arch.map(function (a) { return '<div class="item"><div class="grow"><div class="ti">' + esc(a.name) + '</div><div class="su">' + Z.money(bal[a.id] || 0) + '</div></div><button class="btn sm" data-act="aRestore" data-id="' + a.id + '">Restore</button></div>'; }).join('') + '</div></div></section>';
    return html;
  }
  function accountSheet(a) {
    var b = L.balances()[a.id] || 0, txs = L.transactions().filter(function (t) { return t.accountId === a.id || t.toAccountId === a.id; }).slice(0, 12), api;
    api = U.sheet({
      title: a.name,
      body: '<div class="stack"><div class="kpi"><div class="label">Current balance</div><div class="v" style="font-size:30px">' + Z.money(b) + '</div><div class="xs dim" style="margin-top:6px">Opening ' + Z.money(a.opening || 0) + ' + transactions</div></div>' +
        (txs.length ? '<div><div class="label" style="margin-bottom:6px">Recent</div><div class="list">' + txs.map(txRow).join('') + '</div></div>' : '<p class="muted small">No transactions in this account yet.</p>') +
        '<div class="sh-foot"><button class="btn" data-edit>' + ic('pencil') + 'Edit</button><button class="btn" data-arch>' + ic('archive') + 'Archive</button></div></div>',
      onMount: function (root) {
        root.addEventListener('click', function (e) {
          if (e.target.closest('[data-edit]')) { api.close(); F.account(a); }
          else if (e.target.closest('[data-arch]')) { S.put('accounts', Object.assign({}, a, { archived: true })); api.close(); U.toast('Account archived'); }
          else { var x = e.target.closest('[data-act="xEdit"]'); if (x) { api.close(); } }
        });
      }
    });
  }

  /* ---------- BUDGETS ---------- */
  function budgetsTab() {
    if (!L.accounts().length) return noAccounts();
    var ms = budMonth || Z.monthStart(Z.today()), st = L.budgetStatus(ms), html = '';
    html += '<div class="row between rz" style="--n:1"><button class="iconbtn sm glass" data-act="bMonth" data-d="-1" aria-label="Previous month">' + ic('chevron-left') + '</button><h3 style="font-size:19px">' + Z.fmtMonth(ms) + '</h3><button class="iconbtn sm glass" data-act="bMonth" data-d="1" aria-label="Next month">' + ic('chevron-right') + '</button></div>';
    if (!st.length) return html + '<div class="card rz" style="--n:2">' + U.empty('target', 'No budgets yet', 'Set an overall monthly limit, or a limit for a category like Food or Transport.', { act: 'budNew', label: 'Create a budget' }) + '</div>';
    var overall = st.filter(function (s) { return !s.b.category; })[0];
    if (overall) {
      var c = overall.over ? RED : overall.pct > .8 ? '#FFC93D' : GREEN;
      html += '<section class="card hero rz" style="--n:2"><div class="hero-rings">' + U.ring({ size: 110, stroke: 12, value: Math.min(1, overall.pct), color: c, mid: '<div class="mid" style="position:static;font-size:22px">' + Math.round(overall.pct * 100) + '%</div>' }) +
        '<div class="grow"><div class="label">Overall budget</div><div class="mid" style="margin:6px 0 4px">' + (overall.over ? Z.money(-overall.left, { compact: true }) + ' over' : Z.money(overall.left, { compact: true }) + ' left') + '</div><div class="small muted">' + Z.money(overall.spent, { compact: true, bare: true }) + ' of ' + Z.money(overall.amount, { compact: true, bare: true }) + ' spent</div></div></div></section>';
    }
    html += '<section class="card rz" style="--n:3"><div class="head"><div class="label">' + ic('chart-column') + 'Budget progress</div></div><div class="chartbox sm" style="height:' + Math.max(130, st.length * 42) + 'px"><canvas id="c-bud"></canvas></div></section>';
    html += '<section class="card rz" style="--n:4"><div class="head"><h3>Budgets</h3><button class="link" data-act="budNew">' + ic('plus') + 'Add</button></div><div class="list">' + st.map(function (s) {
      var c = s.over ? RED : s.pct > .8 ? '#FFC93D' : GREEN;
      return '<button class="item tap" data-act="bEdit" data-id="' + s.b.id + '" style="flex-direction:column;align-items:stretch;gap:8px"><div class="row between"><span class="ti">' + (s.b.category ? esc(s.b.category) : 'Overall monthly budget') + '</span><span class="small ' + (s.over ? 'bad' : 'dim') + '">' + (s.over ? Z.money(-s.left, { compact: true, bare: true }) + ' over' : Z.money(s.left, { compact: true, bare: true }) + ' left') + '</span></div>' + U.bar(s.pct * 100, c) + '<div class="row between xs dim"><span>' + Z.money(s.spent, { bare: true }) + ' spent</span><span>of ' + Z.money(s.amount, { bare: true }) + '</span></div></button>';
    }).join('') + '</div></section>';
    return html;
  }
  function budgetForm(b) {
    b = b || {};
    F.sheet({
      title: b.id ? 'Edit budget' : 'New budget',
      fields: U.field('Applies to', U.select('bcat', [{ v: '', label: 'Overall monthly spending' }].concat(Z.EXP_CATS.filter(function (c) { return c !== 'Savings'; })), b.category || ''), 'bcat') +
        U.field('Monthly limit (TSh)', U.input('bamt', b.amount != null ? b.amount : '', { inputmode: 'decimal', ph: '300000', autofocus: true, cls: 'amount-input' }), 'bamt', 'Repeats every month. Transfers are never counted as spending.'),
      onSubmit: function (root) {
        var amt = U.parseAmount(U.val(root, 'bamt')); if (!(amt > 0)) { U.fail(root, 'bamt', 'Enter a limit greater than zero.'); return false; }
        var cat = U.val(root, 'bcat'); if (S.all('budgets').some(function (x) { return x.id !== b.id && (x.category || '') === cat; })) { U.fail(root, 'bcat', 'You already have a budget for this.'); return false; }
        S.put('budgets', Object.assign({}, b, { category: cat, amount: amt })); U.toast(b.id ? 'Budget updated' : 'Budget created');
      },
      onDelete: b.id ? function (api) { U.confirm({ title: 'Delete this budget?', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.del('budgets', b.id); api.close(); U.toast('Budget deleted'); } }); } : null
    });
  }

  /* ---------- SAVINGS ---------- */
  function savingsTab() {
    var gs = S.all('savings'), html = '';
    if (!gs.length) return '<div class="card rz" style="--n:1">' + U.empty('piggy-bank', 'Save toward something', 'A phone, rent, a trip, emergency cash — set a target and add contributions as you go.', { act: 'sNew', label: 'Create a savings goal' }) + '</div>';
    html += '<div class="note-honest small dim rz" style="--n:1;padding:0 4px">Savings goals are tracked separately. To move real money, record a transfer to your savings account.</div>';
    gs.forEach(function (g, i) {
      var p = L.savingsProgress(g), days = g.targetDate ? Z.diff(Z.today(), g.targetDate) : null, months = days != null && days > 0 ? Math.max(1, Math.ceil(days / 30)) : null;
      html += '<section class="card rz" style="--n:' + Math.min(i + 2, 8) + '"><div class="row" style="gap:16px">' + U.ring({ size: 88, stroke: 10, value: p.pct, color: GREEN, mid: '<div class="mid" style="position:static;font-size:19px;font-weight:720">' + Math.round(p.pct * 100) + '%</div>' }) +
        '<div class="grow"><h3>' + esc(g.name) + '</h3><div class="mid" style="font-size:20px;margin-top:6px">' + Z.money(p.saved, { compact: true }) + ' <span class="dim" style="font-size:14px;font-weight:600">of ' + Z.money(g.target, { compact: true, bare: true }) + '</span></div>' +
        '<div class="small dim" style="margin-top:4px">' + (p.pct >= 1 ? 'Goal reached' : (months ? 'About ' + Z.money(p.left / months, { compact: true }) + '/month to hit ' + Z.fmt(g.targetDate) : g.targetDate && days <= 0 ? 'Target date passed' : Z.money(p.left, { compact: true }) + ' to go')) + '</div></div></div>' +
        '<div class="row" style="gap:8px;margin-top:14px"><button class="btn primary sm grow" data-act="sAdd" data-id="' + g.id + '">' + ic('plus') + 'Add money</button><button class="btn sm" data-act="svOpen" data-id="' + g.id + '">History</button><button class="iconbtn sm" data-act="sEdit" data-id="' + g.id + '" aria-label="Edit goal">' + ic('pencil') + '</button></div></section>';
    });
    return html;
  }
  function savingForm(g) {
    g = g || {};
    F.sheet({
      title: g.id ? 'Edit savings goal' : 'New savings goal',
      fields: U.field('Goal name', U.input('sname', g.name, { ph: 'e.g. New laptop', max: 60, autofocus: true }), 'sname') + U.field('Target amount (TSh)', U.input('starget', g.target != null ? g.target : '', { inputmode: 'decimal', ph: '1500000' }), 'starget') +
        U.field('Target date (optional)', U.input('sdate', g.targetDate || '', { type: 'date' }), 'sdate'),
      onSubmit: function (root) {
        var n = U.val(root, 'sname'); if (!n) { U.fail(root, 'sname', 'Name your goal.'); return false; }
        var t = U.parseAmount(U.val(root, 'starget')); if (!(t > 0)) { U.fail(root, 'starget', 'Enter a target greater than zero.'); return false; }
        S.put('savings', Object.assign({}, g, { name: n, target: t, targetDate: U.val(root, 'sdate'), contributions: g.contributions || [] })); U.toast(g.id ? 'Goal updated' : 'Goal created');
      },
      onDelete: g.id ? function (api) { U.confirm({ title: 'Delete "' + g.name + '"?', text: 'Its contribution history will be removed.', ok: 'Delete', danger: true }).then(function (y) { if (y) { S.del('savings', g.id); api.close(); U.toast('Goal deleted'); } }); } : null
    });
  }
  function contributeForm(g) {
    F.sheet({
      title: 'Add to ' + g.name,
      fields: U.field('Amount (TSh)', U.input('camt', '', { inputmode: 'decimal', ph: '0', autofocus: true, cls: 'amount-input' }), 'camt') + U.field('Date', U.input('cdate', Z.today(), { type: 'date' }), 'cdate') + U.field('Note (optional)', U.input('cnote', '', { max: 80 }), 'cnote'),
      save: 'Add contribution',
      onSubmit: function (root) {
        var a = U.parseAmount(U.val(root, 'camt')); if (!(a > 0)) { U.fail(root, 'camt', 'Enter an amount greater than zero.'); return false; }
        var before = L.savingsProgress(g).pct, fresh = S.get('savings', g.id) || g;
        var np = S.put('savings', Object.assign({}, fresh, { contributions: (fresh.contributions || []).concat([{ id: Z.uid(), date: U.val(root, 'cdate') || Z.today(), amount: a, note: U.val(root, 'cnote') }]) }));
        var after = L.savingsProgress(np).pct; if (before < 1 && after >= 1) setTimeout(function () { U.celebrate('Goal reached', g.name, 'piggy-bank'); }, 300); else U.toast('Added ' + Z.money(a));
      }
    });
  }
  function savingHistory(g) {
    var api = U.sheet({
      title: g.name, body: '<div class="list">' + ((g.contributions || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (c) {
        return '<div class="item"><div class="grow"><div class="ti">' + Z.money(c.amount) + '</div><div class="su">' + Z.fmt(c.date, { day: 'numeric', month: 'short', year: 'numeric' }) + (c.note ? ' · ' + esc(c.note) : '') + '</div></div><button class="iconbtn sm" data-rm="' + c.id + '" aria-label="Remove contribution">' + ic('trash-2') + '</button></div>';
      }).join('') || '<p class="muted small">No contributions yet.</p>') + '</div>',
      onMount: function (root) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (!b) return; var fresh = S.get('savings', g.id); S.put('savings', Object.assign({}, fresh, { contributions: fresh.contributions.filter(function (c) { return c.id !== b.dataset.rm; }) })); api.close(); U.toast('Removed'); }); }
    });
  }

  /* ---------- CSV IMPORT ---------- */
  function guessCol(headers, names) { for (var i = 0; i < headers.length; i++) { var h = headers[i].toLowerCase(); for (var j = 0; j < names.length; j++) if (h.indexOf(names[j]) > -1) return i; } return -1; }
  function parseDate(s) {
    s = String(s || '').trim(); var m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) { var y = m[3].length === 2 ? '20' + m[3] : m[3], d = +m[1], mo = +m[2]; if (mo > 12 && d <= 12) { var x = d; d = mo; mo = x; } if (mo < 1 || mo > 12 || d < 1 || d > 31) return ''; return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2); }
    var dt = new Date(s); if (!isNaN(dt)) return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
    return '';
  }
  function parseAmt(s) {
    s = String(s == null ? '' : s).trim(); if (!s) return NaN; var neg = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^-/.test(s) || /^−/.test(s);
    var n = parseFloat(s.replace(/[^\d.]/g, '')); return isFinite(n) ? (neg ? -n : n) : NaN;
  }
  function importCSV() {
    var accts = L.accounts(); if (!accts.length) { U.toast('Add an account first', 'info'); return F.account(); }
    var rows = [], headers = [], map = {}, api;
    api = U.sheet({
      title: 'Import CSV',
      body: '<div id="imp"></div>',
      onMount: function (root) { step1(); }
    });
    var root = function () { return Z.$('#imp', api.el); };
    function step1() {
      root().innerHTML = '<div class="stack"><p class="muted">Choose a CSV exported from your bank or mobile money statement. You’ll map the columns and preview everything before anything is saved.</p>' +
        '<label class="btn primary block" style="cursor:pointer">' + ic('file-up') + 'Choose CSV file<input type="file" id="impf" accept=".csv,text/csv,text/plain" class="sr"></label>' +
        '<div class="field"><label for="impt">…or paste CSV text</label><textarea class="textarea" id="impt" rows="4" placeholder="Date,Description,Amount"></textarea></div><button class="btn block" id="impgo">Continue</button><div class="msg bad small" id="imperr"></div></div>';
      Z.$('#impf', api.el).addEventListener('change', function () { var f = this.files[0]; if (!f) return; if (f.size > 5e6) return err('That file is too large (max 5 MB).'); var r = new FileReader(); r.onload = function () { load(String(r.result)); }; r.onerror = function () { err('Could not read the file.'); }; r.readAsText(f); });
      Z.$('#impgo', api.el).addEventListener('click', function () { load(Z.$('#impt', api.el).value); });
    }
    function err(m) { var e = Z.$('#imperr', api.el); if (e) e.textContent = m; }
    function load(text) {
      var all = Z.parseCSV(text || ''); if (all.length < 2) return err('No rows found. The file needs a header row and at least one transaction.');
      if (all.length > 5001) return err('Too many rows (max 5,000 per import).');
      headers = all[0].map(function (h) { return h.trim(); }); rows = all.slice(1);
      map = { date: guessCol(headers, ['date', 'tarehe', 'time']), amount: guessCol(headers, ['amount', 'kiasi', 'value']), desc: guessCol(headers, ['desc', 'detail', 'narr', 'reference', 'particular', 'memo', 'maelezo']), type: guessCol(headers, ['type', 'aina']), cat: guessCol(headers, ['categ']), debit: guessCol(headers, ['debit', 'withdraw', 'paid out', 'money out']), credit: guessCol(headers, ['credit', 'deposit', 'paid in', 'money in']) };
      step2();
    }
    function colSel(id, val, none) { return U.select(id, [{ v: -1, label: none || '— none —' }].concat(headers.map(function (h, i) { return { v: i, label: h || 'Column ' + (i + 1) }; })), val); }
    function step2() {
      root().innerHTML = '<div class="stack"><div class="small muted">' + rows.length + ' rows found. Check the column mapping:</div>' +
        '<div class="grid2">' + U.field('Date column', colSel('mdate', map.date), 'mdate') + U.field('Amount column', colSel('mamt', map.amount), 'mamt') + '</div>' +
        '<div class="grid2">' + U.field('Description', colSel('mdesc', map.desc), 'mdesc') + U.field('Category (optional)', colSel('mcat', map.cat), 'mcat') + '</div>' +
        '<div class="grid2">' + U.field('Type column (optional)', colSel('mtype', map.type), 'mtype') + U.field('Import into account', U.select('macc', accts.map(function (a) { return { v: a.id, label: a.name }; }), Z.meta.get('lastAccount', accts[0].id)), 'macc') + '</div>' +
        '<div class="grid2">' + U.field('Debit column (optional)', colSel('mdeb', map.debit), 'mdeb') + U.field('Credit column (optional)', colSel('mcre', map.credit), 'mcre') + '</div>' +
        '<div class="xs dim">Negative amounts, or a type containing "debit / expense / withdraw", are expenses. Dates like 05/10/2026 are read as day/month/year.</div>' +
        '<button class="btn primary block" id="impprev">Preview</button><div class="msg bad small" id="imperr"></div></div>';
      Z.$('#impprev', api.el).addEventListener('click', function () {
        var g = function (id) { return parseInt(Z.$('#' + id, api.el).value, 10); };
        map = { date: g('mdate'), amount: g('mamt'), desc: g('mdesc'), cat: g('mcat'), type: g('mtype'), debit: g('mdeb'), credit: g('mcre') }; var acc = Z.$('#macc', api.el).value;
        if (map.date < 0) return err('Choose the date column.'); if (map.amount < 0 && map.debit < 0 && map.credit < 0) return err('Choose the amount column (or debit/credit columns).');
        step3(acc);
      });
    }
    function step3(acc) {
      var existing = {}; S.all('transactions').forEach(function (t) { existing[key(t.date, t.type, t.amount, t.accountId, t.desc)] = 1; });
      function key(d, ty, a, ac, ds) { return [d, ty, Math.round(a * 100), ac, String(ds || '').toLowerCase().replace(/\s+/g, ' ').trim()].join('|'); }
      var good = [], dup = 0, bad = [], seen = {};
      rows.forEach(function (r, i) {
        var date = parseDate(r[map.date]); if (!date) return bad.push([i + 2, 'Date not understood: "' + (r[map.date] || '') + '"']);
        var amt, type;
        if (map.debit >= 0 || map.credit >= 0) { var d = map.debit >= 0 ? parseAmt(r[map.debit]) : NaN, c = map.credit >= 0 ? parseAmt(r[map.credit]) : NaN; if (isFinite(c) && Math.abs(c) > 0) { amt = Math.abs(c); type = 'income'; } else if (isFinite(d) && Math.abs(d) > 0) { amt = Math.abs(d); type = 'expense'; } }
        if (amt == null) { var raw = parseAmt(r[map.amount]); if (!isFinite(raw) || raw === 0) return bad.push([i + 2, 'Amount not understood: "' + (r[map.amount] || '') + '"']); amt = Math.abs(raw); type = raw < 0 ? 'expense' : 'income'; if (map.type >= 0) { var tv = String(r[map.type] || '').toLowerCase(); if (/debit|expense|withdraw|out|paid|sent|purchase|payment/.test(tv)) type = 'expense'; else if (/credit|income|deposit|in\b|received|salary/.test(tv)) type = 'income'; } }
        if (amt > 1e12) return bad.push([i + 2, 'Amount too large']);
        var desc = map.desc >= 0 ? String(r[map.desc] || '').trim().slice(0, 100) : '', cat = map.cat >= 0 ? String(r[map.cat] || '').trim() : '';
        var list = type === 'income' ? Z.INC_CATS : Z.EXP_CATS; if (list.indexOf(cat) < 0) cat = 'Other';
        var k = key(date, type, amt, acc, desc); if (existing[k] || seen[k]) { dup++; return; } seen[k] = 1;
        good.push({ date: date, type: type, amount: amt, desc: desc, category: cat, accountId: acc, toAccountId: '', notes: 'Imported from CSV' });
      });
      var inc = good.filter(function (g) { return g.type === 'income'; }).length;
      root().innerHTML = '<div class="stack"><div class="grid3"><div class="kpi"><div class="label">Ready</div><div class="v good">' + good.length + '</div></div><div class="kpi"><div class="label">Duplicates</div><div class="v warn">' + dup + '</div></div><div class="kpi"><div class="label">Invalid</div><div class="v bad">' + bad.length + '</div></div></div>' +
        '<div class="small muted">' + inc + ' income · ' + (good.length - inc) + ' expenses. Duplicates (same date, amount, account and description) are skipped.</div>' +
        (good.length ? '<div class="list">' + good.slice(0, 6).map(function (g) { return '<div class="item" style="min-height:48px"><div class="grow"><div class="ti" style="font-size:15px">' + esc(g.desc || g.category) + '</div><div class="su">' + Z.fmt(g.date) + ' · ' + g.category + '</div></div><b class="num ' + (g.type === 'income' ? 'good' : '') + '">' + (g.type === 'income' ? '+' : '−') + Z.money(g.amount, { bare: true }) + '</b></div>'; }).join('') + (good.length > 6 ? '<div class="xs dim" style="padding:8px 0">…and ' + (good.length - 6) + ' more</div>' : '') + '</div>' : '') +
        (bad.length ? '<details><summary class="small bad" style="cursor:pointer">Show invalid rows</summary><div class="xs dim" style="padding-top:6px">' + bad.slice(0, 15).map(function (b) { return 'Row ' + b[0] + ': ' + esc(b[1]); }).join('<br>') + '</div></details>' : '') +
        '<div class="sh-foot"><button class="btn" id="impback">Back</button><button class="btn primary" style="flex:2" id="impsave" ' + (good.length ? '' : 'disabled') + '>Import ' + good.length + '</button></div></div>';
      Z.$('#impback', api.el).addEventListener('click', step2);
      Z.$('#impsave', api.el).addEventListener('click', function () { S.batch(function () { good.forEach(function (g) { S.put('transactions', g); }); }); api.close(); U.celebrate('Imported', good.length + ' transactions added', 'file-up'); });
    }
  }
  function exportCSV() {
    var rows = L.transactions().slice().reverse();
    if (!rows.length) return U.toast('No transactions to export', 'info');
    Z.download('zero-os-transactions-' + Z.today() + '.csv', '\uFEFF' + Z.toCSV(rows, ['date', 'type', 'amount', ['account', function (t) { return L.accountName(t.accountId); }], ['to_account', function (t) { return t.toAccountId ? L.accountName(t.toAccountId) : ''; }], 'category', ['description', function (t) { return t.desc; }], 'notes']), 'text/csv');
    U.toast('CSV exported');
  }
  Z.exportTransactionsCSV = exportCSV;

  /* ---------- charts ---------- */
  function buckets(r) {
    var span = Z.diff(r.a, r.b), out = [], i;
    if (span <= 45) { var ws = Z.weekStart(r.a); for (var d = ws; d <= r.b; d = Z.addDays(d, 7)) out.push({ a: d < r.a ? r.a : d, b: Z.addDays(d, 6) > r.b ? r.b : Z.addDays(d, 6), label: Z.fmt(d < r.a ? r.a : d) }); }
    else { var m = Z.monthStart(r.a); while (m <= r.b) { out.push({ a: m < r.a ? r.a : m, b: Z.monthEnd(m) > r.b ? r.b : Z.monthEnd(m), label: Z.fmt(m, { month: 'short', year: span > 366 ? '2-digit' : undefined }) }); m = Z.addMonths(m, 1); } }
    return out.slice(-24);
  }
  function drawOverview(root) {
    var r = range(), sum = L.summary(r.a, r.b), tx = S.all('transactions'), fmtK = function (v) { return v >= 1e6 ? (v / 1e6) + 'M' : v >= 1e3 ? (v / 1e3) + 'K' : v; };
    var c = Z.$('#c-flow', root);
    if (c) { var bk = buckets(r), sums = bk.map(function (b) { return L.summary(b.a, b.b, tx); });
      U.chart(c, { type: 'bar', data: { labels: bk.map(function (b) { return b.label; }), datasets: [{ label: 'Income', data: sums.map(function (s) { return s.income; }), backgroundColor: GREEN, borderRadius: 6, borderSkipped: false, maxBarThickness: 22 }, { label: 'Expenses', data: sums.map(function (s) { return s.expense; }), backgroundColor: RED, borderRadius: 6, borderSkipped: false, maxBarThickness: 22 }] },
        options: { plugins: { tooltip: { callbacks: { label: function (x) { return x.dataset.label + ': ' + Z.money(x.raw); } } } }, scales: { x: { grid: { display: false }, border: { display: false } }, y: { grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false }, beginAtZero: true, ticks: { maxTicksLimit: 4, callback: fmtK } } } } }); }
    var cc = Z.$('#c-cat', root);
    if (cc) { var cats = Object.keys(sum.byCat).sort(function (a, b) { return sum.byCat[b] - sum.byCat[a]; });
      U.chart(cc, { type: 'doughnut', data: { labels: cats, datasets: [{ data: cats.map(function (k) { return sum.byCat[k]; }), backgroundColor: cats.map(Z.catColor), borderWidth: 0, hoverOffset: 6 }] }, options: { cutout: '68%', plugins: { tooltip: { callbacks: { label: function (x) { return x.label + ': ' + Z.money(x.raw); } } } } } }); }
    var ct = Z.$('#c-trend', root);
    if (ct) { var ms = L.monthKeys(6), sm = ms.map(function (m) { return L.summary(m, Z.monthEnd(m), tx); });
      U.chart(ct, { type: 'line', data: { labels: ms.map(function (m) { return Z.fmt(m, { month: 'short' }); }), datasets: [{ label: 'Spending', data: sm.map(function (s) { return s.expense; }), borderColor: RED, backgroundColor: U.gradient(ct, RED, 220), fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: RED, pointBorderWidth: 0, borderWidth: 3 }, { label: 'Income', data: sm.map(function (s) { return s.income; }), borderColor: GREEN, borderDash: [5, 5], tension: .4, pointRadius: 0, borderWidth: 2 }] },
        options: { plugins: { tooltip: { callbacks: { label: function (x) { return x.dataset.label + ': ' + Z.money(x.raw); } } } }, scales: { x: { grid: { display: false }, border: { display: false } }, y: { grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false }, beginAtZero: true, ticks: { maxTicksLimit: 4, callback: fmtK } } } } }); }
    var ca = Z.$('#c-acc', root);
    if (ca) { var accs = L.accounts(), bal = L.balances();
      U.chart(ca, { type: 'bar', data: { labels: accs.map(function (a) { return a.name; }), datasets: [{ data: accs.map(function (a) { return bal[a.id] || 0; }), backgroundColor: accs.map(function (a, i) { return (bal[a.id] || 0) < 0 ? RED : L.accColor(a, i); }), borderRadius: 8, borderSkipped: false, maxBarThickness: 26 }] },
        options: { indexAxis: 'y', plugins: { tooltip: { callbacks: { label: function (x) { return Z.money(x.raw); } } } }, scales: { x: { grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false }, ticks: { maxTicksLimit: 4, callback: fmtK } }, y: { grid: { display: false }, border: { display: false } } } } }); }
    var cb = Z.$('#c-bud', root);
    if (cb) { var st = L.budgetStatus(budMonth || Z.monthStart(Z.today()));
      U.chart(cb, { type: 'bar', data: { labels: st.map(function (s) { return s.b.category || 'Overall'; }), datasets: [{ label: 'Spent %', data: st.map(function (s) { return Math.round(s.pct * 100); }), backgroundColor: st.map(function (s) { return s.over ? RED : s.pct > .8 ? '#FFC93D' : GREEN; }), borderRadius: 8, borderSkipped: false, maxBarThickness: 22 }] },
        options: { indexAxis: 'y', plugins: { tooltip: { callbacks: { label: function (x) { var s = st[x.dataIndex]; return Z.money(s.spent) + ' of ' + Z.money(s.amount) + ' (' + x.raw + '%)'; } } } }, scales: { x: { grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false }, beginAtZero: true, suggestedMax: 100, ticks: { maxTicksLimit: 5, callback: function (v) { return v + '%'; } } }, y: { grid: { display: false }, border: { display: false } } } } }); }
  }

  /* ---------- actions ---------- */
  var A = Z.actions;
  A.mTab = function (el) { mtab = el.dataset.v; Z.refresh(true); };
  A.mPeriod = function (el) {
    var v = el.dataset.v;
    if (v === 'custom') {
      var cur = range();
      return F.sheet({ title: 'Custom range', fields: '<div class="grid2">' + U.field('From', U.input('pa', cur.a, { type: 'date' }), 'pa') + U.field('To', U.input('pb', cur.b, { type: 'date' }), 'pb') + '</div>', save: 'Apply', noFocus: true,
        onSubmit: function (root) { var a = U.val(root, 'pa'), b = U.val(root, 'pb'); if (!a) { U.fail(root, 'pa', 'Choose a start date.'); return false; } if (!b) { U.fail(root, 'pb', 'Choose an end date.'); return false; } if (b < a) { U.fail(root, 'pb', 'End must be after start.'); return false; } custom = { a: a, b: b }; period = 'custom'; txLimit = 60; Z.refresh(); } });
    }
    period = v; txLimit = 60; Z.refresh();
  };
  A.xType = function (el) { txType = el.dataset.v; txLimit = 60; Z.refresh(); };
  A.xMore = function () { txLimit += 60; Z.refresh(); };
  A.xEdit = function (el) { var t = S.get('transactions', el.dataset.id); if (t) F.tx(t); };
  A.aOpen = function (el) { var a = S.get('accounts', el.dataset.id); if (a) accountSheet(a); };
  A.aArch = function () { showArchAcc = !showArchAcc; Z.refresh(); };
  A.aRestore = function (el) { var a = S.get('accounts', el.dataset.id); if (a) { S.put('accounts', Object.assign({}, a, { archived: false })); U.toast('Account restored'); } };
  A.budNew = function () { budgetForm(); };
  A.bEdit = function (el) { var b = S.get('budgets', el.dataset.id); if (b) budgetForm(b); };
  A.bMonth = function (el) { budMonth = Z.addMonths(budMonth || Z.monthStart(Z.today()), +el.dataset.d); Z.refresh(); };
  A.sNew = function () { savingForm(); };
  A.sEdit = function (el) { var g = S.get('savings', el.dataset.id); if (g) savingForm(g); };
  A.sAdd = function (el) { var g = S.get('savings', el.dataset.id); if (g) contributeForm(g); };
  A.svOpen = function (el) { var g = S.get('savings', el.dataset.id); if (g) savingHistory(g); };
  A.mMenu = function (el) {
    U.menu(el, [{ icon: 'file-up', label: 'Import CSV', run: importCSV }, { icon: 'download', label: 'Export transactions (CSV)', run: exportCSV }, { icon: 'landmark', label: 'Add account', run: function () { F.account(); } }]);
  };

  Z.views.money = {
    title: 'Money', area: 'money',
    render: function () {
      var tabs = [['overview', 'Overview'], ['transactions', 'Transactions'], ['accounts', 'Accounts'], ['budgets', 'Budgets'], ['savings', 'Savings']];
      var body = mtab === 'overview' ? overview() : mtab === 'transactions' ? txTab() : mtab === 'accounts' ? accountsTab() : mtab === 'budgets' ? budgetsTab() : savingsTab();
      return Z.hd({ eyebrow: 'Finance', title: 'Money', sub: 'In TSh · transfers are never counted as spending', acts: '<button class="iconbtn glass" data-act="mMenu" aria-label="More options">' + ic('ellipsis') + '</button>' }) +
        '<div class="pilltabs rz" style="--n:1;margin-bottom:14px" role="tablist">' + tabs.map(function (t) { return '<button role="tab" class="' + (mtab === t[0] ? 'on' : '') + '" data-act="mTab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="cols">' + body + '</div>';
    },
    mount: function (root) {
      drawOverview(root);
      var q = Z.$('#xq', root); if (q) q.addEventListener('input', function () { txQ = q.value; clearTimeout(q._t); q._t = setTimeout(function () { var pos = q.selectionStart; Z.refresh(); var n = Z.$('#xq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }, 220); });
      var a = Z.$('#xaccf', root), c = Z.$('#xcatf', root);
      if (a) a.addEventListener('change', function () { txAcc = a.value; Z.refresh(); }); if (c) c.addEventListener('change', function () { txCat = c.value; Z.refresh(); });
    },
    onChange: function () { return true; },
    fab: function () { if (mtab === 'accounts') F.account(); else if (mtab === 'budgets') budgetForm(); else if (mtab === 'savings') savingForm(); else F.tx(); },
    goto: function (t) { mtab = t; }
  };
})();
