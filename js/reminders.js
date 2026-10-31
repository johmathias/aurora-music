/* ZERO OS — reminders.
   Honest limits on iPhone: a web app cannot wake itself up in the background without a push server.
   So ZERO OS does two things:
   1. While the app is open (or in the background for a short while), it fires real notifications at the right time
      if you allowed them (iPhone: only after "Add to Home Screen", iOS 16.4+).
   2. Every time you open the app, a "Due now" card on Home shows reminders you may have missed, so nothing slips by.
   For guaranteed alerts when the app is closed, use the calendar export (.ics) in Settings to add events to Apple Calendar. */
(function () {
  'use strict';
  var Z = window.Z, S = Z.store;
  var R = Z.reminders = {};
  var timer = 0;

  R.supported = function () { return 'Notification' in window; };
  R.permission = function () { return R.supported() ? Notification.permission : 'unsupported'; };
  R.isStandalone = function () { return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); };
  R.isIOS = function () { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); };
  R.ask = function () {
    if (!R.supported()) return Promise.resolve('unsupported');
    try { return Promise.resolve(Notification.requestPermission()); } catch (e) { return Promise.resolve('denied'); }
  };

  // build the list of reminders for one date: {key, at(minutes), title, body}
  R.forDate = function (date) {
    var out = [], lead = Number(Z.settings().reminderLead) || 0;
    Z.logic.eventsOn(date).forEach(function (e) {
      if (!e.reminder || Z.toMin(e.start) == null) return;
      out.push({ key: 'ev:' + e.id + ':' + date, at: Z.toMin(e.start) - lead, title: e.title, body: 'Starts ' + e.start + (lead ? ' (in ' + lead + ' min)' : ''), kind: 'event' });
    });
    S.all('tasks').forEach(function (t) {
      if (t.done || !t.reminder || t.due !== date) return;
      out.push({ key: 'tk:' + t.id + ':' + date, at: Z.toMin(t.reminderTime || '09:00'), title: t.title, body: 'Task due today', kind: 'task' });
    });
    Z.logic.uniItems().forEach(function (u) {
      if (u.done || u.date !== date || !u.reminder) return;
      out.push({ key: 'un:' + u.id, at: Z.toMin(u.start || '08:00') - (u.kind === 'exam' ? 60 : 0), title: (u.kind === 'exam' ? 'Exam: ' : u.kind === 'assignment' ? 'Due today: ' : 'Study: ') + u.title, body: 'University', kind: 'uni' });
    });
    Z.logic.habits().forEach(function (h) {
      if (!h.reminder || !Z.logic.habitScheduled(h, date) || Z.logic.isDone(h, date)) return;
      out.push({ key: 'hb:' + h.id + ':' + date, at: Z.toMin(h.reminder), title: h.name, body: 'Time for your habit', kind: 'habit' });
    });
    var c = Z.logic.challenge();
    var cs = Z.settings().challengeReminder;
    if (c && !c.finished && !c.notStarted && cs && date === Z.today() && !c.doneToday) out.push({ key: 'ch:' + date, at: Z.toMin(cs), title: c.name, body: 'Day ' + c.dayNo + ' check-in', kind: 'challenge' });
    return out;
  };

  var fired = {};
  try { fired = JSON.parse(localStorage.getItem('zero.fired') || '{}'); } catch (e) { }
  function saveFired() { try { var k = Object.keys(fired); if (k.length > 300) k.slice(0, k.length - 300).forEach(function (x) { delete fired[x]; }); localStorage.setItem('zero.fired', JSON.stringify(fired)); } catch (e) { } }

  R.dueNow = function () {         // reminders whose time has passed today and that are still open (shown on Home)
    var now = Z.nowMin();
    return R.forDate(Z.today()).filter(function (r) { return r.at <= now && r.at >= now - 180; }).sort(function (a, b) { return a.at - b.at; });
  };
  R.notify = function (r) {
    if (R.permission() !== 'granted') return;
    var opts = { body: r.body, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', tag: r.key };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(r.title, opts); }).catch(function () { new Notification(r.title, opts); });
      else new Notification(r.title, opts);
    } catch (e) { }
  };
  function tick() {
    var now = Z.nowMin(), today = Z.today();
    R.forDate(today).forEach(function (r) {
      if (fired[r.key] || r.at > now || r.at < now - 20) return;      // only recent ones; older ones show in "Due now"
      fired[r.key] = Date.now(); R.notify(r); Z.ui.toast(r.title, 'info');
    });
    saveFired();
    document.dispatchEvent(new CustomEvent('zero:tick'));
  }
  R.start = function () { clearInterval(timer); timer = setInterval(tick, 30000); setTimeout(tick, 2500); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') tick(); }); };
  R.test = function () { R.notify({ key: 'test:' + Date.now(), title: 'ZERO OS', body: 'Reminders are working.' }); };

  // .ics export so events can live in Apple Calendar with real alarms
  R.ics = function () {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ZERO OS//EN', 'CALSCALE:GREGORIAN'];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    function dt(d, t) { return d.replace(/-/g, '') + 'T' + (t || '09:00').replace(':', '') + '00'; }
    var esc = function (s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    S.all('events').forEach(function (e) {
      var l = ['BEGIN:VEVENT', 'UID:' + e.id + '@zero-os', 'DTSTAMP:' + stamp];
      if (e.start) { l.push('DTSTART;TZID=Africa/Dar_es_Salaam:' + dt(e.date, e.start)); l.push('DTEND;TZID=Africa/Dar_es_Salaam:' + dt(e.date, e.end || e.start)); }
      else { l.push('DTSTART;VALUE=DATE:' + e.date.replace(/-/g, '')); }
      l.push('SUMMARY:' + esc(e.title)); if (e.notes) l.push('DESCRIPTION:' + esc(e.notes));
      if (e.repeat && e.repeat !== 'none') {
        var r = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' }[e.repeat];
        if (r) l.push('RRULE:' + r + (e.until ? ';UNTIL=' + e.until.replace(/-/g, '') + 'T235959' : ''));
      }
      if (e.reminder) { l.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), 'TRIGGER:-PT' + (Number(Z.settings().reminderLead) || 10) + 'M', 'END:VALARM'); }
      l.push('END:VEVENT'); lines = lines.concat(l);
    });
    lines.push('END:VCALENDAR'); return lines.join('\r\n');
  };
})();
