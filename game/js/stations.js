// stations.js — kitchen layout, cooking / chopping / burn logic, E-interactions.
// One job: what happens when the chef uses a station. Pure state mutation;
// main.js owns the loop, render.js owns drawing, hud.js owns the DOM.
(function () {
  var STATIONS = [
    { id: 'fridge',  name: 'FRIDGE',    x: 20,  y: 16,  w: 130, h: 68, kind: 'fridge' },
    { id: 'board',   name: 'BOARD',     x: 170, y: 16,  w: 130, h: 68, kind: 'board' },
    { id: 'stove',   name: 'STOVE',     x: 320, y: 16,  w: 130, h: 68, kind: 'stove' },
    { id: 'stove2',  name: 'STOVE 2',   x: 470, y: 16,  w: 130, h: 68, kind: 'stove' },
    { id: 'pot',     name: 'POT',       x: 620, y: 16,  w: 130, h: 68, kind: 'pot' },
    { id: 'plating', name: 'PLATING',   x: 770, y: 16,  w: 90,  h: 68, kind: 'plating' },
    { id: 'counter', name: 'ORDERS',    x: 20,  y: 470, w: 240, h: 54, kind: 'counter' },
    { id: 'bin',     name: 'BIN',       x: 300, y: 470, w: 100, h: 54, kind: 'bin' },
    { id: 'hatch',   name: 'SERVE',     x: 620, y: 470, w: 240, h: 54, kind: 'hatch' }
  ];

  var BURN_WINDOW = 6; // seconds after cook finishes before it burns

  function byId(id) {
    for (var i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === id) return STATIONS[i];
    return null;
  }

  function stationState(state, id) { return state.stations[id]; }

  function freshStationStates() {
    return {
      stove:  { mode: 'idle', item: null, progress: 0, burnLeft: 0 },
      stove2: { mode: 'idle', item: null, progress: 0, burnLeft: 0 },
      pot:    { mode: 'idle', item: null, progress: 0, burnLeft: 0 },
      board:  { mode: 'idle', item: null, progress: 0, burnLeft: 0 }
    };
  }

  function distToRect(px, py, r) {
    var cx = Math.max(r.x, Math.min(px, r.x + r.w));
    var cy = Math.max(r.y, Math.min(py, r.y + r.h));
    return Math.hypot(px - cx, py - cy);
  }

  // Nearest station within reach of the player, or null.
  function nearestStation(state) {
    var best = null, bestD = 78;
    for (var i = 0; i < STATIONS.length; i++) {
      var s = STATIONS[i];
      if (s.id === 'stove2' && state.day < 2) continue; // locked until Day 2
      var d = distToRect(state.player.x, state.player.y, s);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  function activeTicket(state) {
    if (!state.activeTicketId) return null;
    for (var i = 0; i < state.tickets.length; i++) {
      if (state.tickets[i].id === state.activeTicketId) return state.tickets[i];
    }
    return null;
  }

  function nextTodo(ticket) {
    if (!ticket) return null;
    for (var i = 0; i < ticket.components.length; i++) {
      if (ticket.components[i].state === 'todo') return ticket.components[i];
    }
    return null;
  }

  function say(state, msg) { state.caption = msg; state.captionAt = state.elapsed; }

  // The E key / click on a station. Returns nothing; sets state.caption.
  function interact(state, station) {
    if (!station) { say(state, 'Walk up to a station, then press E.'); return; }
    var t = activeTicket(state);
    var A = window.KitchenAudio;

    if (station.kind === 'counter') {
      if (t) { say(state, 'Finish the current dish first — one ticket at a time!'); return; }
      var waiting = null;
      for (var i = 0; i < state.tickets.length; i++) {
        if (state.tickets[i].state === 'waiting') { waiting = state.tickets[i]; break; }
      }
      if (!waiting) { say(state, 'No waiting tickets — the next customer is on their way.'); return; }
      takeTicket(state, waiting);
      return;
    }

    if (station.kind === 'fridge') {
      if (!t) { say(state, 'Take an order first — click a ticket or press E at ORDERS.'); return; }
      if (state.carrying) { say(state, 'Hands full! Use what you are carrying first.'); return; }
      var need = nextTodo(t);
      if (!need) { say(state, 'All ingredients are already on the tray. Plate it, then serve!'); return; }
      state.carrying = { kind: 'raw', raw: need.raw, done: need.done, station: need.station, task: need.task };
      A.grab();
      say(state, 'Grabbed a raw ' + need.raw + ' — take it to the ' + need.station.toUpperCase() + '.');
      return;
    }

    if (station.kind === 'board') {
      var b = stationState(state, 'board');
      if (b.mode === 'chopping') { say(state, 'Still chopping… stay at the board!'); return; }
      if (!state.carrying) { say(state, 'Nothing to chop — grab an ingredient at the FRIDGE.'); return; }
      if (state.carrying.kind !== 'raw' || state.carrying.station !== 'board') {
        say(state, 'The ' + state.carrying.raw + ' does not go on the chopping board.');
        return;
      }
      b.mode = 'chopping'; b.item = state.carrying; b.progress = 0;
      state.carrying = null;
      A.chop();
      say(state, 'Chopping the ' + b.item.raw + '…');
      return;
    }

    if (station.kind === 'stove' || station.kind === 'pot') {
      var s = stationState(state, station.id);
      var verb = station.kind === 'stove' ? 'fry' : 'boil';
      if (s.mode === 'burnt') {
        if (state.carrying) { say(state, 'Hands full — bin the burnt food first!'); return; }
        state.carrying = { kind: 'burnt', raw: s.item.raw, done: s.item.done, station: s.item.station, task: s.item.task };
        s.mode = 'idle'; s.item = null; s.progress = 0; s.burnLeft = 0;
        say(state, 'Picked up the burnt ' + state.carrying.raw + ' — dump it in the BIN!');
        return;
      }
      if (s.mode === 'cooking') { say(state, 'Still ' + verb + 'ing… keep an eye on it, it burns!'); return; }
      if (s.mode === 'done') {
        if (state.carrying) { say(state, 'Hands full! Put down what you are carrying first.'); return; }
        state.carrying = { kind: 'done', raw: s.item.raw, done: s.item.done, station: s.item.station, task: s.item.task };
        s.mode = 'idle'; s.item = null; s.progress = 0; s.burnLeft = 0;
        A.grab();
        say(state, 'Picked up the ' + state.carrying.done + ' — take it to PLATING.');
        return;
      }
      // idle: place a raw item to cook
      if (!state.carrying) { say(state, 'Nothing to ' + verb + ' — grab an ingredient at the FRIDGE.'); return; }
      if (state.carrying.kind !== 'raw' || state.carrying.station !== station.kind) {
        say(state, 'The ' + state.carrying.raw + ' does not go on the ' + station.name + '.');
        return;
      }
      s.mode = 'cooking'; s.item = state.carrying; s.progress = 0; s.burnLeft = BURN_WINDOW;
      state.carrying = null;
      A.place();
      say(state, (verb === 'fry' ? 'Frying' : 'Boiling') + ' the ' + s.item.raw + ' — pick it up before it burns!');
      return;
    }

    if (station.kind === 'plating') {
      if (!t) { say(state, 'No active order — take a ticket first.'); return; }
      if (!state.carrying || state.carrying.kind !== 'done') {
        say(state, 'Bring a finished ingredient here to plate it.');
        return;
      }
      var comp = null;
      for (var j = 0; j < t.components.length; j++) {
        if (t.components[j].state === 'todo' && t.components[j].done === state.carrying.done) { comp = t.components[j]; break; }
      }
      if (!comp) { say(state, 'The ' + state.carrying.done + ' is not on this ticket.'); return; }
      comp.state = 'done';
      var doneName = state.carrying.done;
      state.carrying = null;
      A.done();
      if (!nextTodo(t)) {
        t.state = 'ready';
        say(state, doneName + ' plated — ' + t.dish + ' is READY! Serve it at the HATCH!');
      } else {
        say(state, doneName + ' plated. Next: ' + nextTodo(t).raw + '.');
      }
      return;
    }

    if (station.kind === 'bin') {
      if (state.carrying && state.carrying.kind === 'burnt') {
        say(state, 'Burnt ' + state.carrying.raw + ' binned. The stove is free again.');
        state.carrying = null;
        A.place();
        return;
      }
      if (state.carrying) { say(state, 'The bin is only for burnt food — this is still good!'); return; }
      say(state, 'The bin is empty. Burnt food goes here.');
      return;
    }

    if (station.kind === 'hatch') {
      if (!t) { say(state, 'No active order to serve.'); return; }
      if (t.state !== 'ready') { say(state, t.dish + ' is not ready yet — finish the plate first!'); return; }
      serveTicket(state, t);
      return;
    }
  }

  function takeTicket(state, ticket) {
    ticket.state = 'prepping';
    ticket.taken = true;
    state.activeTicketId = ticket.id;
    window.KitchenAudio.grab();
    say(state, ticket.customer + ' wants ' + ticket.dish + ' — first: ' + ticket.components[0].raw + '!');
  }

  function serveTicket(state, ticket) {
    var res = window.KitchenOrders.scoreServe(ticket, state.combo);
    state.score += res.total;
    state.tips += res.tip;
    state.served++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    if (res.perfect) { state.combo++; } else { state.combo = 1; }
    ticket.state = 'served';
    state.activeTicketId = null;
    state.floaters.push({
      x: 740, y: 470, text: '+' + res.total + (res.perfect ? ' PERFECT!' : ''), ttl: 2.2, color: res.perfect ? '#ffd54f' : '#81c784'
    });
    if (res.perfect) {
      window.KitchenAudio.perfect();
      say(state, ticket.customer + ' loved the ' + ticket.dish + ' — PERFECT serve! +' + res.total + ' (tip +' + res.tip + ')');
    } else {
      window.KitchenAudio.serve();
      say(state, ticket.customer + ' got their ' + ticket.dish + ' — +' + res.total + ' (tip +' + res.tip + ')');
    }
  }

  // Advance cooking / chopping / burn timers by dt seconds.
  function updateStations(state, dt) {
    // Board: chopping only progresses while the chef stands at the board.
    var b = stationState(state, 'board');
    if (b.mode === 'chopping') {
      var board = byId('board');
      if (distToRect(state.player.x, state.player.y, board) < 78) {
        b.progress += dt;
        if (b.progress >= b.item.task) {
          state.carrying = { kind: 'done', raw: b.item.raw, done: b.item.done, station: 'board', task: b.item.task };
          say(state, b.item.done + ' ready — take it to PLATING.');
          window.KitchenAudio.done();
          b.mode = 'idle'; b.item = null; b.progress = 0;
        }
      }
    }
    // Stove / pot: cooking runs on its own; done food burns if ignored.
    ['stove', 'stove2', 'pot'].forEach(function (id) {
      var s = stationState(state, id);
      if (s.mode === 'cooking') {
        s.progress += dt;
        if (s.progress >= s.item.task) { s.mode = 'done'; s.burnLeft = BURN_WINDOW; say(state, 'The ' + s.item.done + ' is done — pick it up NOW before it burns!'); window.KitchenAudio.done(); }
      } else if (s.mode === 'done') {
        s.burnLeft -= dt;
        if (s.burnLeft <= 0) {
          s.mode = 'burnt';
          state.burns = (state.burns || 0) + 1;
          window.KitchenAudio.burn();
          say(state, 'The ' + s.item.done + ' BURNT! The ' + id.toUpperCase() + ' is blocked — bin the burnt food!');
        }
      }
    });
  }

  // Rush bell: finish every in-progress cook/chop instantly. Once per day.
  function ringBell(state) {
    if (state.bellLeft <= 0) { say(state, 'The rush bell is spent for today.'); return false; }
    state.bellLeft--;
    ['stove', 'stove2', 'pot'].forEach(function (id) {
      var s = stationState(state, id);
      if (s.mode === 'cooking') { s.mode = 'done'; s.progress = s.item.task; s.burnLeft = BURN_WINDOW; }
    });
    var b = stationState(state, 'board');
    if (b.mode === 'chopping') {
      state.carrying = { kind: 'done', raw: b.item.raw, done: b.item.done, station: 'board', task: b.item.task };
      b.mode = 'idle'; b.item = null; b.progress = 0;
    }
    window.KitchenAudio.bell();
    say(state, 'RING RING! The rush bell hurries every cook — grab the food before it burns!');
    return true;
  }

  window.KitchenStations = {
    STATIONS: STATIONS,
    BURN_WINDOW: BURN_WINDOW,
    byId: byId,
    freshStationStates: freshStationStates,
    nearestStation: nearestStation,
    activeTicket: activeTicket,
    takeTicket: takeTicket,
    interact: interact,
    updateStations: updateStations,
    ringBell: ringBell
  };
})();
