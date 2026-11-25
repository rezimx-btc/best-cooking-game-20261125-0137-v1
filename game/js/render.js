// render.js — draws the whole kitchen on the canvas. One job: pixels only,
// no game rules. Reads state, never mutates it (except floaters' ttl).
(function () {
  var W = 880, H = 540;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function stationColors(kind, mode) {
    if (mode === 'burnt') return { bg: '#263238', fg: '#ef5350' };
    if (mode === 'done') return { bg: '#2e7d32', fg: '#c8e6c9' };
    if (mode === 'cooking' || mode === 'chopping') return { bg: '#e65100', fg: '#ffe0b2' };
    switch (kind) {
      case 'fridge': return { bg: '#37474f', fg: '#b0bec5' };
      case 'board': return { bg: '#6d4c41', fg: '#d7ccc8' };
      case 'stove': return { bg: '#bf360c', fg: '#ffccbc' };
      case 'pot': return { bg: '#4e342e', fg: '#d7ccc8' };
      case 'plating': return { bg: '#33691e', fg: '#dcedc8' };
      case 'counter': return { bg: '#5d4037', fg: '#d7ccc8' };
      case 'bin': return { bg: '#455a64', fg: '#cfd8dc' };
      case 'hatch': return { bg: '#1565c0', fg: '#bbdefb' };
      default: return { bg: '#555', fg: '#eee' };
    }
  }

  function drawStation(ctx, state, s) {
    var st = state.stations[s.id];
    var mode = st ? st.mode : 'idle';
    var locked = s.id === 'stove2' && state.day < 2;
    var c = locked ? { bg: '#3e2723', fg: '#8d6e63' } : stationColors(s.kind, mode);
    rr(ctx, s.x, s.y, s.w, s.h, 8);
    ctx.fillStyle = c.bg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();

    ctx.fillStyle = c.fg;
    ctx.font = 'bold 13px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(locked ? 'STOVE 2 — DAY 2' : s.name, s.x + s.w / 2, s.y + 20);

    // state word under the name (Pola 1: labeled state)
    var word = '';
    if (locked) word = 'LOCKED';
    else if (st) {
      if (st.mode === 'cooking') word = s.kind === 'pot' ? 'BOILING' : 'FRYING';
      else if (st.mode === 'done') word = 'READY!';
      else if (st.mode === 'burnt') word = 'BURNT!';
      else if (st.mode === 'chopping') word = 'CHOPPING';
      else word = 'IDLE';
    }
    if (word) {
      ctx.font = '900 12px Trebuchet MS, sans-serif';
      ctx.fillStyle = mode === 'burnt' ? '#ff8a80' : mode === 'done' ? '#a5d6a7' : '#ffe082';
      ctx.fillText(word, s.x + s.w / 2, s.y + 38);
    }

    // progress / burn bar
    if (st && (st.mode === 'cooking' || st.mode === 'chopping')) {
      var frac = Math.min(1, st.progress / (st.item ? st.item.task : 1));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(s.x + 8, s.y + s.h - 14, s.w - 16, 8);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(s.x + 8, s.y + s.h - 14, (s.w - 16) * frac, 8);
    }
    if (st && st.mode === 'done') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(s.x + 8, s.y + s.h - 14, s.w - 16, 8);
      ctx.fillStyle = st.burnLeft < 3 ? '#ef5350' : '#66bb6a';
      ctx.fillRect(s.x + 8, s.y + s.h - 14, (s.w - 16) * (st.burnLeft / 6), 8);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Trebuchet MS, sans-serif';
      ctx.fillText(Math.ceil(st.burnLeft) + 's', s.x + s.w / 2, s.y + s.h - 4);
    }
    if (st && st.mode === 'burnt') {
      // smoke puffs rising off the burnt pan
      var t = state.elapsed;
      for (var i = 0; i < 3; i++) {
        var ph = (t * 0.7 + i * 0.33) % 1;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.9 - ph * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(s.x + s.w / 2 + (i - 1) * 20, s.y - 4 - ph * 30, 7 + ph * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ff8a80';
      ctx.font = 'bold 11px Trebuchet MS, sans-serif';
      ctx.fillText('CLEAN ME!', s.x + s.w / 2, s.y + s.h - 6);
    }
    if (st && st.item && (st.mode === 'cooking' || st.mode === 'done' || st.mode === 'burnt')) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px Trebuchet MS, sans-serif';
      ctx.fillText(st.item.raw, s.x + s.w / 2, s.y + 52);
    }
  }

  function drawCustomer(ctx, cust, x, y) {
    // simple waiting customer: body + head + name tag above the head
    ctx.fillStyle = cust.color;
    rr(ctx, x - 16, y, 32, 34, 8); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 8, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffccbc'; ctx.fill();
    ctx.font = 'bold 12px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(cust.name, x, y - 26);
    ctx.fillStyle = '#fff';
    ctx.fillText(cust.name, x, y - 26);
    if (cust.angry) {
      ctx.fillStyle = '#ef5350';
      ctx.font = '900 16px Trebuchet MS, sans-serif';
      ctx.fillText('!', x + 18, y - 16);
    }
  }

  function draw(ctx, state) {
    ctx.clearRect(0, 0, W, H);
    // floor: checker tiles
    for (var ty = 0; ty < 9; ty++) {
      for (var tx = 0; tx < 15; tx++) {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? '#4a3423' : '#42301f';
        ctx.fillRect(tx * 60, 96 + ty * 40, 60, 40);
      }
    }
    // wall strip
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(0, 0, W, 96);
    ctx.fillStyle = '#241610';
    ctx.fillRect(0, 458, W, 82);

    // stations
    var stations = window.KitchenStations.STATIONS;
    for (var i = 0; i < stations.length; i++) drawStation(ctx, state, stations[i]);

    // customers waiting in a row on the kitchen floor (above the counters)
    var waiting = state.tickets.filter(function (t) { return t.state === 'waiting' || t.state === 'prepping'; });
    var colors = ['#ef5350', '#42a5f5', '#66bb6a', '#ab47bc', '#ffa726', '#26c6da'];
    for (var c = 0; c < Math.min(waiting.length, 6); c++) {
      var t = waiting[c];
      var cx = 120 + c * 110;
      drawCustomer(ctx, {
        name: t.customer,
        color: colors[c % colors.length],
        angry: t.patience < t.patienceMax * 0.3
      }, cx, 410);
    }

    // highlight the station in reach
    var near = window.KitchenStations.nearestStation(state);
    if (near && state.phase === 'playing') {
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffd54f';
      rr(ctx, near.x - 3, near.y - 3, near.w + 6, near.h + 6, 10); ctx.stroke();
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 12px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('E — ' + near.name, near.x + near.w / 2, near.y + near.h + 14);
    }

    // player: chef with hat
    var p = state.player;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 14, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    rr(ctx, p.x - 14, p.y - 6, 28, 26, 8); ctx.fill();
    ctx.fillStyle = '#e53935';
    ctx.fillRect(p.x - 14, p.y - 6, 28, 6);
    ctx.beginPath(); ctx.arc(p.x, p.y - 12, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#ffccbc'; ctx.fill();
    // chef hat
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x - 6, p.y - 20, 6, 0, Math.PI * 2); ctx.arc(p.x + 6, p.y - 20, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(p.x - 11, p.y - 24, 22, 8);
    // carried item bubble
    if (state.carrying) {
      var label = state.carrying.kind === 'burnt' ? 'BURNT ' + state.carrying.raw
        : state.carrying.kind === 'done' ? state.carrying.done : 'Raw ' + state.carrying.raw;
      ctx.font = 'bold 12px Trebuchet MS, sans-serif';
      var wdt = ctx.measureText(label).width + 14;
      ctx.fillStyle = state.carrying.kind === 'burnt' ? '#37474f' : '#fff8e1';
      rr(ctx, p.x - wdt / 2, p.y - 52, wdt, 20, 9); ctx.fill();
      ctx.fillStyle = state.carrying.kind === 'burnt' ? '#ff8a80' : '#3e2723';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, p.y - 38);
    }

    // floaters (+points)
    for (var f = 0; f < state.floaters.length; f++) {
      var fl = state.floaters[f];
      ctx.globalAlpha = Math.min(1, fl.ttl);
      ctx.fillStyle = fl.color;
      ctx.font = '900 20px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fl.text, fl.x, fl.y - (2.2 - fl.ttl) * 30);
      ctx.globalAlpha = 1;
    }

    // (day-clock urgency lives in the top bar: the clock turns red under 15s)
  }

  window.KitchenRender = { draw: draw, W: W, H: H };
})();
