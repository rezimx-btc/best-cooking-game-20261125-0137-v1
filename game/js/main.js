// main.js — game state, loop, input, day flow, screenshot staging, debug API.
// One job: run the game. Rules live in orders.js / stations.js, pixels in
// render.js, DOM in hud.js, sound in audio.js.
(function () {
  'use strict';

  var DAY_CFG = {
    1: { quota: 4, maxTickets: 2, spawnEvery: 14, length: 150, maxWalkouts: 2 },
    2: { quota: 5, maxTickets: 3, spawnEvery: 11, length: 150, maxWalkouts: 3 },
    3: { quota: 6, maxTickets: 3, spawnEvery: 9,  length: 150, maxWalkouts: 3 }
  };
  var SPEED = 260;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  var state = null;

  function freshState(day) {
    var cfg = DAY_CFG[day];
    return {
      phase: 'playing',
      day: day,
      dayTimeLeft: cfg.length,
      quota: cfg.quota,
      maxTickets: cfg.maxTickets,
      spawnEvery: cfg.spawnEvery,
      maxWalkouts: cfg.maxWalkouts,
      served: 0,
      walkouts: 0,
      score: state ? state.score : 0,
      combo: 1,
      bestCombo: 1,
      tips: state ? state.tips : 0,
      burns: 0,
      bellLeft: 1,
      tickets: [],
      activeTicketId: null,
      carrying: null,
      stations: window.KitchenStations.freshStationStates(),
      player: { x: 440, y: 280, vx: 0, vy: 0 },
      keys: {},
      floaters: [],
      caption: '',
      captionAt: 0,
      elapsed: 0,
      spawnTimer: 0,
      spawned: 0,
      frozen: false,
      dayStartScore: state ? state.score : 0,
      dayStartTips: state ? state.tips : 0
    };
  }

  function startDay(day) {
    var keepScore = state ? state.score : 0;
    var keepTips = state ? state.tips : 0;
    state = freshState(day);
    state.score = keepScore;
    state.tips = keepTips;
    state.dayStartScore = keepScore;
    state.dayStartTips = keepTips;
    spawnTicket();
    state.caption = 'Day ' + day + ' — serve ' + state.quota + ' orders before closing! Take a ticket!';
    window.KitchenHud.hideOverlay();
    window.KitchenHud.update(state);
  }

  function spawnTicket() {
    var t = window.KitchenOrders.makeTicket(state.day, Math.random);
    state.tickets.push(t);
    state.spawned++;
    state.spawnTimer = state.spawnEvery;
    return t;
  }

  function dayWon() {
    state.phase = state.day === 3 ? 'gameWon' : 'dayWon';
    if (state.day === 3) {
      window.KitchenAudio.win();
      window.KitchenHud.showOverlay('YOU DID IT — 3 DAYS SURVIVED!',
        'The kitchen is yours. Every regular fed, every pan survived, and the rush bell still rings.',
        'FINAL SCORE: ' + state.score + '<br>SERVED: ' + state.served + ' orders &nbsp;·&nbsp; TIPS: +' + state.tips + '<br>BEST COMBO: ×' + state.bestCombo + ' &nbsp;·&nbsp; BURNT PANS: ' + state.burns,
        'PLAY AGAIN');
    } else {
      window.KitchenAudio.win();
      window.KitchenHud.showOverlay('DAY ' + state.day + ' COMPLETE!',
        'Closing time — the regulars are full and the kitchen survived. Tomorrow is busier: a second stove unlocks on Day 2.',
        'SCORE: ' + state.score + ' &nbsp;·&nbsp; SERVED: ' + state.served + '/' + state.quota + '<br>TIPS: +' + state.tips + ' &nbsp;·&nbsp; BEST COMBO: ×' + state.bestCombo,
        'START DAY ' + (state.day + 1));
    }
  }

  function dayLost(reason) {
    state.phase = 'dayLost';
    window.KitchenAudio.lose();
    window.KitchenHud.showOverlay('DAY ' + state.day + ' FAILED',
      reason,
      'SCORE: ' + state.score + ' &nbsp;·&nbsp; SERVED: ' + state.served + '/' + state.quota + '<br>WALKOUTS: ' + state.walkouts,
      'RETRY DAY ' + state.day);
  }

  function update(dt) {
    if (!state || state.phase !== 'playing' || state.frozen) return;
    state.elapsed += dt;
    state.dayTimeLeft -= dt;

    // spawn new customers
    state.spawnTimer -= dt;
    var waiting = state.tickets.filter(function (t) { return t.state === 'waiting' || t.state === 'prepping'; }).length;
    if (state.spawnTimer <= 0 && waiting < state.maxTickets && state.spawned < state.quota + state.maxWalkouts + 1) {
      spawnTicket();
      var last = state.tickets[state.tickets.length - 1];
      state.caption = last.customer + ' walked in — wants a ' + last.dish + '!';
    }

    // patience + walkouts
    for (var i = 0; i < state.tickets.length; i++) {
      var t = state.tickets[i];
      if (t.state === 'waiting' || t.state === 'prepping') {
        t.patience -= dt;
        if (t.patience <= 0) {
          t.patience = 0;
          t.state = 'gone';
          state.walkouts++;
          state.combo = 1;
          window.KitchenAudio.walkout();
          if (state.activeTicketId === t.id) { state.activeTicketId = null; state.carrying = null; }
          state.caption = t.customer + ' walked out! Too slow — the ' + t.dish + ' is off the board.';
          if (state.walkouts >= state.maxWalkouts) {
            dayLost('Too many customers walked out hungry. The regulars talk — and the kitchen went quiet.');
            return;
          }
        }
      }
    }

    // player movement
    var p = state.player;
    var dx = 0, dy = 0;
    if (state.keys['arrowleft'] || state.keys['a']) dx -= 1;
    if (state.keys['arrowright'] || state.keys['d']) dx += 1;
    if (state.keys['arrowup'] || state.keys['w']) dy -= 1;
    if (state.keys['arrowdown'] || state.keys['s']) dy += 1;
    if (dx !== 0 || dy !== 0) {
      var len = Math.hypot(dx, dy);
      p.x = Math.max(24, Math.min(856, p.x + dx / len * SPEED * dt));
      p.y = Math.max(100, Math.min(458, p.y + dy / len * SPEED * dt));
    }

    window.KitchenStations.updateStations(state, dt);

    // floaters
    for (var f = state.floaters.length - 1; f >= 0; f--) {
      state.floaters[f].ttl -= dt;
      if (state.floaters[f].ttl <= 0) state.floaters.splice(f, 1);
    }

    // day end
    if (state.served >= state.quota) { dayWon(); return; }
    if (state.dayTimeLeft <= 0) {
      if (state.served >= state.quota) dayWon();
      else dayLost('Closing time — only ' + state.served + ' of ' + state.quota + ' orders served. The regulars went hungry.');
    }
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!state) return;
    var now = ts / 1000;
    if (loop.last === undefined) loop.last = now;
    var dt = Math.min(0.05, now - loop.last);
    loop.last = now;
    update(dt);
    window.KitchenRender.draw(ctx, state);
    window.KitchenHud.update(state);
  }

  // ---- input ----
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (!state) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    state.keys[k] = true;
    window.KitchenAudio.unlock();
    if (state.phase !== 'playing') return;
    if (k === 'e') {
      var near = window.KitchenStations.nearestStation(state);
      window.KitchenStations.interact(state, near);
    }
    if (k === 'b') window.KitchenStations.ringBell(state);
    if (k === 'r') startDay(state.day);
    if (k === 'm') window.KitchenHud.update(state);
  });
  window.addEventListener('keyup', function (e) {
    if (state) state.keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener('click', function (e) {
    if (!state || state.phase !== 'playing') return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (canvas.width / rect.width);
    var y = (e.clientY - rect.top) * (canvas.height / rect.height);
    var stations = window.KitchenStations.STATIONS;
    var hit = null;
    for (var i = 0; i < stations.length; i++) {
      var s = stations[i];
      if (x >= s.x - 6 && x <= s.x + s.w + 6 && y >= s.y - 6 && y <= s.y + s.h + 6) { hit = s; break; }
    }
    if (!hit) return;
    if (hit.id === 'stove2' && state.day < 2) { state.caption = 'Stove 2 unlocks on Day 2!'; return; }
    var near = window.KitchenStations.nearestStation(state);
    if (near && near.id === hit.id) window.KitchenStations.interact(state, hit);
    else state.caption = 'Walk closer to the ' + hit.name + ' first!';
  });

  document.getElementById('ticketRail').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.ticket') : null;
    if (!el || !state || state.phase !== 'playing') return;
    var id = parseInt(el.getAttribute('data-ticket'), 10);
    var t = null;
    for (var i = 0; i < state.tickets.length; i++) if (state.tickets[i].id === id) t = state.tickets[i];
    if (!t || t.state !== 'waiting') return;
    if (state.activeTicketId) { state.caption = 'Finish the current dish first — one ticket at a time!'; return; }
    window.KitchenStations.takeTicket(state, t);
  });

  document.getElementById('muteBtn').addEventListener('click', function () {
    window.KitchenAudio.toggleMute();
    window.KitchenHud.update(state);
  });

  document.getElementById('overlayBtn').addEventListener('click', function () {
    if (!state) { startDay(1); return; }
    if (state.phase === 'dayWon') startDay(state.day + 1);
    else if (state.phase === 'dayLost') {
      state.score = state.dayStartScore;
      state.tips = state.dayStartTips;
      startDay(state.day);
    } else if (state.phase === 'gameWon' || state.phase === 'menu') {
      state.score = 0; state.tips = 0;
      startDay(1);
    }
  });

  // ---- screenshot staging (?shot=cover|cooking|rush|serve) ----
  // Stages a real mid-game state and freezes timers so the capture is stable.
  // Staging only sets state — it never changes gameplay rules.
  function stageShot(name) {
    startDay(name === 'rush' ? 2 : 1);
    state.frozen = true;
    var S = window.KitchenStations;
    function ticketFor(customer, recipeKey, patienceFrac, st) {
      var t = window.KitchenOrders.makeTicket(state.day, Math.random);
      t.customer = customer;
      t.recipeKey = recipeKey;
      var rec = window.KitchenOrders.RECIPES[recipeKey];
      t.dish = rec.name; t.base = rec.base;
      t.components = rec.components.map(function (c) {
        return { raw: c.raw, done: c.done, station: c.station, task: c.task, state: 'todo' };
      });
      t.patience = Math.round(t.patienceMax * patienceFrac);
      t.state = st || 'waiting';
      state.tickets.push(t);
      return t;
    }
    if (name === 'cover') {
      var m = ticketFor('Bram', 'burger', 0.75, 'prepping');
      state.activeTicketId = m.id;
      ticketFor('Mira', 'ramen', 0.6, 'waiting');
      state.player = { x: 235, y: 130, vx: 0, vy: 0 };
      var b = state.stations.board;
      b.mode = 'chopping'; b.item = { raw: 'Lettuce', done: 'Chopped Lettuce', station: 'board', task: 2.2 }; b.progress = 1.3;
      var st = state.stations.stove;
      st.mode = 'cooking'; st.item = { raw: 'Patty', done: 'Fried Patty', station: 'stove', task: 4 }; st.progress = 2.4;
      state.score = 120; state.combo = 2;
      state.caption = 'Bram\u2019s burger is on the stove \u2014 chop the lettuce while it fries!';
    } else if (name === 'cooking') {
      var r = ticketFor('Mira', 'ramen', 0.55, 'prepping');
      state.activeTicketId = r.id;
      ticketFor('Sari', 'salad', 0.8, 'waiting');
      state.player = { x: 685, y: 130, vx: 0, vy: 0 };
      state.carrying = { kind: 'raw', raw: 'Egg', done: 'Chopped Egg', station: 'board', task: 2.2 };
      var pot = state.stations.pot;
      pot.mode = 'cooking'; pot.item = { raw: 'Noodle', done: 'Boiled Noodle', station: 'pot', task: 4 }; pot.progress = 1.6;
      state.score = 250; state.combo = 2;
      state.caption = 'Noodles boiling, egg in hand \u2014 chop it at the board, then plate it all!';
    } else if (name === 'rush') {
      ticketFor('Mira', 'ramen', 0.12, 'waiting');
      ticketFor('Sari', 'salad', 0.28, 'waiting');
      var s = ticketFor('Bram', 'burger', 0.45, 'prepping');
      state.activeTicketId = s.id;
      state.player = { x: 385, y: 130, vx: 0, vy: 0 };
      var stb = state.stations.stove;
      stb.mode = 'burnt'; stb.item = { raw: 'Patty', done: 'Fried Patty', station: 'stove', task: 4 };
      var pot2 = state.stations.pot;
      pot2.mode = 'done'; pot2.item = { raw: 'Noodle', done: 'Boiled Noodle', station: 'pot', task: 4 }; pot2.burnLeft = 2;
      state.dayTimeLeft = 12;
      state.score = 480; state.combo = 3; state.served = 3;
      state.caption = 'The pan is smoking! Mira is about to walk out — bin the burnt patty!';
    } else if (name === 'serve') {
      var sv = ticketFor('Mira', 'ramen', 0.72, 'ready');
      sv.components.forEach(function (c) { c.state = 'done'; });
      state.activeTicketId = sv.id;
      ticketFor('Bram', 'burger', 0.65, 'waiting');
      state.player = { x: 740, y: 440, vx: 0, vy: 0 };
      state.score = 690; state.combo = 2; state.served = 4;
      state.floaters.push({ x: 740, y: 440, text: '+230 PERFECT!', ttl: 2.2, color: '#ffd54f' });
      state.caption = 'Mira loved the ramen — +230! PERFECT serve, tip +20.';
    }
    window.KitchenHud.update(state);
  }

  // ---- boot ----
  state = freshState(1);
  state.phase = 'menu';
  state.score = 0; state.tips = 0;
  window.KitchenHud.showOverlay('RUSH HOUR KITCHEN',
    'Three days. One tiny kitchen. Customers are hungry and patience is short — chop, fry, boil, plate and serve before they walk out. Burn a pan and it blocks the stove until you bin it. Ring the rush bell once a day to finish a cook instantly.',
    '', 'START DAY 1');

  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  if (shot) {
    stageShot(shot);
  } else {
    requestAnimationFrame(loop);
  }
  if (shot) requestAnimationFrame(loop);

  // ---- debug API for the scripted playtest (window.__kitchen) ----
  window.__kitchen = {
    state: function () { return state; },
    startDay: startDay,
    tick: function (dt) { update(dt); },
    teleport: function (x, y) { state.player.x = x; state.player.y = y; },
    interactAt: function (id) {
      var s = window.KitchenStations.byId(id);
      window.KitchenStations.interact(state, s);
    },
    interactNearest: function () {
      var near = window.KitchenStations.nearestStation(state);
      window.KitchenStations.interact(state, near);
    },
    // Drive one full order start-to-finish through the real interact() path.
    completeOrder: function () {
      var S = window.KitchenStations;
      var guard = 0;
      function step() {
        if (guard++ > 400) throw new Error('completeOrder: too many steps');
        if (state.phase !== 'playing') return 'phase:' + state.phase;
        var t = S.activeTicket(state);
        if (!t) {
          // take the first waiting ticket
          var w = null;
          for (var i = 0; i < state.tickets.length; i++) if (state.tickets[i].state === 'waiting') { w = state.tickets[i]; break; }
          if (!w) { update(1); return step(); }
          S.takeTicket(state, w);
          return step();
        }
        if (t.state === 'ready') {
          state.player.x = 740; state.player.y = 440;
          S.interact(state, S.byId('hatch'));
          return 'served';
        }
        // find next todo component
        var comp = null;
        for (var j = 0; j < t.components.length; j++) if (t.components[j].state === 'todo') { comp = t.components[j]; break; }
        if (!comp) { update(0.5); return step(); }
        if (!state.carrying) {
          state.player.x = 85; state.player.y = 130; // fridge
          S.interact(state, S.byId('fridge'));
          if (!state.carrying) return 'stuck:fridge:' + state.caption;
          return step();
        }
        var c = state.carrying;
        if (c.kind === 'done') {
          state.player.x = 815; state.player.y = 130; // plating
          S.interact(state, S.byId('plating'));
          return step();
        }
        if (c.kind === 'burnt') {
          state.player.x = 350; state.player.y = 440; // bin
          S.interact(state, S.byId('bin'));
          return step();
        }
        // raw: go to its station
        var target = c.station === 'board' ? { id: 'board', x: 235, y: 130 }
          : c.station === 'stove' ? { id: 'stove', x: 385, y: 130 }
          : { id: 'pot', x: 685, y: 130 };
        state.player.x = target.x; state.player.y = target.y;
        S.interact(state, S.byId(target.id));
        // wait for the task to finish
        var st = state.stations[target.id];
        var waited = 0;
        while (st.mode === 'chopping' || st.mode === 'cooking') {
          update(0.25);
          waited += 0.25;
          if (waited > 30) return 'stuck:cook-timeout';
          if (state.phase !== 'playing') return 'phase:' + state.phase;
        }
        if (st.mode === 'burnt') return 'burnt:' + target.id;
        if (st.mode === 'done') {
          // pick it up before it burns
          S.interact(state, S.byId(target.id));
        }
        if (st.mode === 'idle' && state.carrying && state.carrying.kind === 'done') return step();
        if (st.mode === 'idle' && !state.carrying) return step();
        return step();
      }
      return step();
    }
  };
})();
