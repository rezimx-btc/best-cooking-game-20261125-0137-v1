// audio.js — procedural WebAudio bleeps for Rush Hour Kitchen. No audio files.
(function () {
  var ctx = null;
  var muted = false;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when) {
    if (muted) return;
    var ac = ensure();
    if (!ac) return;
    var t0 = ac.currentTime + (when || 0);
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freq) {
    if (muted) return;
    var ac = ensure();
    if (!ac) return;
    var len = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ac.createBufferSource();
    src.buffer = buf;
    var f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 1800; f.Q.value = 0.8;
    var g = ac.createGain(); g.gain.value = vol || 0.15;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start();
  }

  window.KitchenAudio = {
    chop: function () { noise(0.08, 0.22, 2400); },
    grab: function () { tone(520, 0.08, 'triangle', 0.1); },
    place: function () { tone(340, 0.1, 'triangle', 0.1); },
    done: function () { tone(880, 0.12, 'sine', 0.12); tone(1174, 0.16, 'sine', 0.1, 0.09); },
    serve: function () { tone(523, 0.12, 'triangle', 0.14); tone(659, 0.12, 'triangle', 0.14, 0.1); tone(784, 0.22, 'triangle', 0.14, 0.2); },
    perfect: function () { tone(784, 0.12, 'sine', 0.14); tone(988, 0.12, 'sine', 0.14, 0.1); tone(1174, 0.12, 'sine', 0.14, 0.2); tone(1568, 0.3, 'sine', 0.14, 0.3); },
    burn: function () { tone(220, 0.35, 'sawtooth', 0.12); tone(165, 0.4, 'sawtooth', 0.1, 0.12); },
    walkout: function () { tone(392, 0.18, 'square', 0.08); tone(311, 0.3, 'square', 0.08, 0.15); },
    bell: function () { tone(1318, 0.5, 'sine', 0.16); tone(988, 0.6, 'sine', 0.1, 0.05); },
    tick: function () { tone(1046, 0.05, 'square', 0.05); },
    win: function () { var n = [523, 659, 784, 1046]; for (var i = 0; i < n.length; i++) tone(n[i], 0.22, 'triangle', 0.14, i * 0.13); },
    lose: function () { var n = [392, 330, 262, 196]; for (var i = 0; i < n.length; i++) tone(n[i], 0.25, 'triangle', 0.12, i * 0.16); },
    toggleMute: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; },
    unlock: ensure
  };
})();
