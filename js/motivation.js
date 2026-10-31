/* ZERO OS — daily encouragement. 100 short, original messages bundled in the app so they work offline
   (nothing is fetched from the internet). One is shown each day; it changes at midnight. */
(function () {
  'use strict';
  var Z = window.Z, U = Z.ui, ic = Z.ic, S = Z.store;
  var M = Z.motivation = {};
  M.list = [
 "An urge is a wave. It rises, peaks, and passes — usually within 15 minutes. Ride it.",
 "You don't have to win forever. You only have to win this hour.",
 "Today you are choosing the person you want to be tomorrow.",
 "A slip is not the end of the story. Get up, learn from it, keep going.",
 "Every day you hold on, the habit loses a little of its grip.",
 "The craving is loud, but it is not in charge of you.",
 "Drink a glass of water, take ten slow breaths, then decide.",
 "Your future self is quietly counting on you right now.",
 "You have survived every hard day so far. Today will be no different.",
 "Strong is not \"never struggling.\" Strong is \"struggling and still choosing well.\"",
 "Move your body for five minutes. Walk, stretch, do push-ups — change the scene.",
 "Boredom is the most common trigger. Give your hands and mind something to do.",
 "Late at night is when it is hardest. Put the phone down and go to sleep — mornings are kinder.",
 "You are not your worst moment. You are what you do next.",
 "Progress is not a straight line. A bad day does not erase the good ones.",
 "Tell one trusted person you are working on yourself. You don't have to carry this alone.",
 "Think of the reason you started. Hold on to it today.",
 "Peace of mind is worth more than a few minutes of relief.",
 "Small wins add up: one clean day, then another, then another.",
 "Be as kind to yourself as you would be to a friend in your position.",
 "Change your place. Stand up, go outside, get some fresh air.",
 "You are building discipline that will help you in your studies, your work and your life.",
 "The urge says \"now.\" You can say \"not today.\"",
 "Every urge you ride out makes the next one weaker.",
 "Focus on today only. Tomorrow will get its own turn.",
 "You are allowed to start again as many times as it takes.",
 "Self-respect is built in the moments nobody sees.",
 "Your mind will make excuses. You don't have to believe them.",
 "Replace, don't just resist: pick a better thing to do with your hands and your time.",
 "Rest, food and water make everything easier. Check the basics first.",
 "Courage is choosing the harder path today for a better life later.",
 "You are more than your habits, and you can change them.",
 "It's okay to feel discomfort. It means you are growing, not failing.",
 "Avoid the triggers you can: the places, the apps, the late-night scrolling.",
 "Pray, breathe, or sit quietly for two minutes. Let the wave pass.",
 "Your goals deserve a clear and focused mind.",
 "Remember how good you feel after you choose well. Choose that feeling.",
 "Nobody is perfect. Consistent beats perfect.",
 "Look at your streak. Be proud of it. Protect it.",
 "You can do hard things — you already have.",
 "Make the next right choice. Just the next one.",
 "When the urge comes, delay it by ten minutes. Then ten more.",
 "Message a friend, call family, or join a group — connection is strong medicine.",
 "Every morning is a clean page. Write something you are proud of.",
 "Freedom is not doing whatever you feel like. It is being able to choose.",
 "Study for twenty minutes. A busy mind has less room for cravings.",
 "You are worth the effort it takes to change.",
 "You don't need to feel motivated. You just need to take the next small step.",
 "Today's discipline is tomorrow's confidence.",
 "Slips teach you your triggers. Learn from them and move on without shame.",
 "The hardest part is the first ten minutes. Get past them.",
 "Look after your sleep, your food and your body. They protect your mind.",
 "You are not weak for needing help. Asking for support is a sign of strength.",
 "Keep your phone out of your bed. Keep your evenings simple.",
 "You've come further than you think. Look back at where you started.",
 "Gratitude shrinks cravings. Name three things you are thankful for right now.",
 "Be patient. Real change is slow, and it is happening.",
 "Write down how you feel instead of acting on it. Words help the wave pass.",
 "This feeling is temporary. Your decision lasts.",
 "You are training your brain to want better things. Keep training.",
 "Clean up your space and your day will feel lighter.",
 "You deserve a life you don't have to hide.",
 "Plan your evening before it starts, so it doesn't plan you.",
 "The person you are becoming is worth the wait.",
 "Start with one thing: make your bed, wash your face, open your books.",
 "Respect your goals enough to protect them.",
 "Your family, your studies and your future all benefit from today's good choice.",
 "You are allowed to take it one minute at a time.",
 "Treat a hard moment as practice — it is making you stronger.",
 "Do not negotiate with the craving. Just walk away from the conversation.",
 "Celebrate small victories. They matter more than you think.",
 "Cold water on your face. Slow breath in. Slow breath out. You've got this.",
 "If today goes wrong, tomorrow still gets a fresh start.",
 "Stay close to people who bring out your best.",
 "You are in the process of becoming someone you will be proud of.",
 "Choose long-term pride over short-term relief.",
 "Keep going. The version of you at day 100 will thank you.",
 "Don't wait for the perfect moment. Begin again right now.",
 "Stress asks for relief. Give it a walk, a talk, or a rest instead.",
 "Every \"no\" to the urge is a \"yes\" to your future.",
 "Your story is still being written, and you hold the pen.",
 "Be proud that you are even trying. Many people never start.",
 "Hold on a little longer. The urge always weakens if you stay with it.",
 "Reward yourself for a good week with something healthy you enjoy.",
 "Slow down. Breathe. You are safe, and you are in control.",
 "Your willpower is like a muscle: it grows when you use it.",
 "Mistakes are information, not identity.",
 "Help someone today. Serving others lifts you out of your own head.",
 "You decide what this moment becomes.",
 "Keep your promises to yourself — that is how trust in yourself is rebuilt.",
 "Fill the gap in your day with something that gives back: study, sport, family, rest.",
 "One calm breath can change the next hour.",
 "Be gentle, be honest, be consistent.",
 "You are not starting from zero. You are starting from experience.",
 "The best time to protect your progress is right now.",
 "Quiet the noise. Remember your reasons.",
 "The urge is asking a question. Answer with your values.",
 "You have a plan, you have people, and you have a reason. Use them.",
 "Imagine telling your future self you stayed strong today. Make that story true.",
 "Discipline is a form of self-love.",
 "A good day is built from many small, ordinary good decisions.",
 "Take a shower, change your clothes, reset your mind.",
 "Right now is the only moment you can actually act in. Use it well.",
 "You are doing better than you think. Keep going.",
 "Rest if you are tired, eat if you are hungry, talk if you are lonely. Then decide.",
 "Today, be the example you wish you had.",
 "Finish today strong. Tomorrow's you will be grateful."
];

  // a different message every day, in a scrambled (not alphabetical) order; step 37 never repeats within the list
  M.index = function (date, offset) {
    var d = Math.floor(new Date((date || Z.today()) + 'T00:00:00Z').getTime() / 864e5);
    return ((d * 37 + (offset || 0)) % M.list.length + M.list.length) % M.list.length;
  };
  M.today = function () { return M.list[M.index()]; };
  M.random = function () { return M.list[Math.floor(Math.random() * M.list.length)]; };

  /* "I'm having an urge" — a calm 10-minute pause: message, breathing guide, countdown, and a count of urges you got through. */
  function beaten() { return Z.meta.get('urgesBeaten', []); }
  M.openUrge = function () {
    var secs = 600, tick = 0, phase = 0, msg = M.random();
    var api = U.sheet({
      title: 'Take a pause',
      body: '<div class="urge"><p class="urge-msg" id="umsg">' + Z.esc(msg) + '</p>' +
        '<div class="breath" id="ubr"><span id="ubt">Breathe in</span></div>' +
        '<div class="urge-time num" id="utm">10:00</div><p class="small dim" style="text-align:center">Just wait it out. The urge usually fades before the timer ends.</p>' +
        '<div class="stack sm" style="margin-top:16px"><button class="btn primary block" id="udone">' + ic('check') + 'I got through it</button>' +
        '<button class="btn block" id="unew">' + ic('refresh-cw') + 'Another message</button>' +
        '<p class="small dim" style="text-align:center;margin-top:6px">Try now: drink water · walk outside · call or message someone you trust.</p></div></div>',
      onClose: function () { clearInterval(tick); },
      onMount: function (root) {
        var tm = Z.$('#utm', root), bt = Z.$('#ubt', root), br = Z.$('#ubr', root);
        function fmt(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
        function breathe() { phase = (phase + 1) % 2; bt.textContent = phase ? 'Breathe out' : 'Breathe in'; br.classList.toggle('in', !phase); }
        setTimeout(function () { br.classList.add('in'); }, 60);
        tick = setInterval(function () { secs--; tm.textContent = fmt(Math.max(0, secs)); if (secs % 4 === 0) breathe(); if (secs <= 0) { clearInterval(tick); tm.textContent = 'Well done'; } }, 1000);
        Z.$('#unew', root).addEventListener('click', function () { var m = M.random(); Z.$('#umsg', root).textContent = m; });
        Z.$('#udone', root).addEventListener('click', function () {
          var l = beaten().slice(); l.push(Z.today()); Z.meta.set('urgesBeaten', l.slice(-500)); api.close();
          U.celebrate('You did it', l.length + (l.length === 1 ? ' urge' : ' urges') + ' ridden out so far.', 'sparkles');
        });
      }
    });
  };
  Z.actions.urge = function () { M.openUrge(); };
  Z.actions.moreMsg = function () { var n = (Z.sessionMsg = (Z.sessionMsg || 0) + 1), el = Z.$('#dmsg'); if (el) { el.textContent = M.list[M.index(null, n)]; } };
})();
