// hud.js — DOM side panel, top bar, ticker and overlay. One job: keep the
// HTML in sync with state. Never changes game rules.
(function () {
  function $(id) { return document.getElementById(id); }

  function fmtClock(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function stateWord(t) {
    if (t.state === 'waiting') return ['WAITING', 'waiting'];
    if (t.state === 'prepping') return ['PREPPING', 'prepping'];
    if (t.state === 'ready') return ['READY', 'ready'];
    return [t.state.toUpperCase(), 'waiting'];
  }

  function update(state) {
    $('dayLabel').textContent = state.day + ' / 3';
    $('clock').textContent = fmtClock(state.dayTimeLeft);
    $('clock').style.color = (state.phase === 'playing' && state.dayTimeLeft <= 15) ? '#ef5350' : '#fff';
    $('score').textContent = state.score;
    $('combo').textContent = '×' + Math.min(3, 1 + 0.25 * (state.combo - 1)).toFixed(2).replace(/\.?0+$/, '');
    $('served').textContent = state.served + ' / ' + state.quota;
    $('bellCount').textContent = '🔔 ' + state.bellLeft;
    $('muteBtn').textContent = window.KitchenAudio.isMuted() ? '🔇' : '🔊';

    // ticket rail
    var rail = $('ticketRail');
    var html = '';
    var visible = state.tickets.filter(function (t) { return t.state !== 'served' && t.state !== 'gone'; });
    if (visible.length === 0) html = '<p class="dim">No tickets yet — customers are coming…</p>';
    visible.forEach(function (t) {
      var w = stateWord(t);
      var cls = t.state === 'ready' ? 'ready' : (t.id === state.activeTicketId ? 'active' : '');
      var pct = Math.max(0, t.patience / t.patienceMax * 100);
      var steps = t.components.map(function (c) {
        return (c.state === 'done' ? '✓ ' : '○ ') + c.done;
      }).join(' · ');
      html += '<div class="ticket ' + cls + '" data-ticket="' + t.id + '">' +
        '<div class="tHead"><span>' + t.customer + '</span><span class="tState ' + w[1] + '">' + w[0] + '</span></div>' +
        '<div class="tDish">' + t.dish + '</div>' +
        '<div class="tSteps">' + steps + '</div>' +
        '<div class="patience' + (pct < 30 ? ' low' : '') + '"><div style="width:' + pct + '%"></div></div>' +
        '</div>';
    });
    rail.innerHTML = html;

    // stove panel
    var sp = '';
    [['stove', 'Stove'], ['stove2', 'Stove 2'], ['pot', 'Pot']].forEach(function (pair) {
      var s = state.stations[pair[0]];
      var word = 'IDLE', cls = 'idle';
      if (pair[0] === 'stove2' && state.day < 2) { word = 'LOCKED · DAY 2'; }
      else if (s.mode === 'cooking') { word = pair[0] === 'pot' ? 'BOILING ' + s.item.raw : 'FRYING ' + s.item.raw; cls = 'cooking'; }
      else if (s.mode === 'done') { word = 'READY! ' + s.item.done + ' (' + Math.ceil(s.burnLeft) + 's)'; cls = 'ready'; }
      else if (s.mode === 'burnt') { word = 'BURNT! ' + s.item.raw; cls = 'burnt'; }
      sp += '<div class="stoveRow"><span>' + pair[1] + '</span><span class="sState ' + cls + '">' + word + '</span></div>';
    });
    $('stovePanel').innerHTML = sp;

    // tray panel
    var tray = $('trayPanel');
    var t = window.KitchenStations.activeTicket(state);
    if (!t) {
      tray.innerHTML = '<p class="dim">No active order. Take a ticket!</p>';
    } else {
      var th = '<div class="trayDish">' + t.customer + ' — ' + t.dish + (t.state === 'ready' ? ' · READY TO SERVE!' : '') + '</div>';
      t.components.forEach(function (c, i) {
        var cls2 = c.state === 'done' ? 'done' : (i === t.components.findIndex(function (x) { return x.state === 'todo'; }) ? 'next' : 'todo');
        th += '<div class="comp ' + cls2 + '"><span>' + (c.state === 'done' ? '✓ ' : '○ ') + c.done + '</span><span>' + c.station.toUpperCase() + '</span></div>';
      });
      tray.innerHTML = th;
    }

    // ticker
    if (state.caption) $('ticker').textContent = state.caption;
  }

  function showOverlay(title, text, statsHtml, btnLabel) {
    $('overlayTitle').textContent = title;
    $('overlayText').textContent = text;
    $('overlayStats').innerHTML = statsHtml || '';
    $('overlayBtn').textContent = btnLabel;
    $('overlay').classList.remove('hidden');
  }

  function hideOverlay() { $('overlay').classList.add('hidden'); }

  window.KitchenHud = { update: update, showOverlay: showOverlay, hideOverlay: hideOverlay };
})();
