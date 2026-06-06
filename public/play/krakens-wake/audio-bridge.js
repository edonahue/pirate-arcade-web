/* Kraken's Wake — Web Audio API sound synthesis bridge.
 *
 * Exposes window.PirateArcadeAudio which the Python game code calls
 * via platform.window.PirateArcadeAudio.play(name).
 *
 * Sound frequencies match the desktop procedural-audio originals:
 *   audio.py → _make_cannon_tone, _make_treasure_tone, _make_victory_tone,
 *              _make_explosion_tone, _make_life_lost_tone
 *
 * No external dependencies. AudioContext is created lazily on init(),
 * which must be called after a user gesture (UME) per browser autoplay rules.
 */

(function () {
  "use strict";

  var ctx = null;
  var gain = null;
  var muted = false;
  var ready = false;

  function init() {
    if (ready) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      gain = ctx.createGain();
      gain.gain.value = 0.3;
      gain.connect(ctx.destination);
      ready = true;
    } catch (e) {
      console.warn("PirateArcadeAudio: cannot create AudioContext", e);
    }
  }

  function resume() {
    if (ready && ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (gain) {
      gain.gain.value = muted ? 0 : 0.3;
    }
  }

  // --- helpers ---

  function tone(freq, dur, vol) {
    if (!ready || muted) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env).connect(gain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  function dual(f1, f2, dur, v1, v2) {
    if (!ready || muted) return;
    var t = ctx.currentTime;
    [f1, f2].forEach(function (f, i) {
      var v = i === 0 ? v1 : v2;
      var osc = ctx.createOscillator();
      var env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      env.gain.setValueAtTime(v, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(env).connect(gain);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });
  }

  function chord(freqs, dur, vols) {
    if (!ready || muted) return;
    var t = ctx.currentTime;
    for (var i = 0; i < freqs.length; i++) {
      var osc = ctx.createOscillator();
      var env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freqs[i];
      env.gain.setValueAtTime(vols && vols[i] != null ? vols[i] : 0.3, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(env).connect(gain);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
  }

  // --- noise helper for cannon/explosion ---
  function noiseBurst(dur, vol) {
    if (!ready || muted) return;
    var t = ctx.currentTime;
    var buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * vol;
    }
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var env = ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(env).connect(gain);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  // --- sound map (matches desktop audio.py) ---

  var sounds = {
    // cannon_fire: 180Hz + 300Hz + noise, 0.15s
    cannon_fire: function () {
      tone(180, 0.15, 0.5);
      tone(300, 0.15, 0.3);
      noiseBurst(0.15, 0.5);
    },
    // treasure: 880Hz + 1100Hz, 0.2s
    treasure: function () {
      dual(880, 1100, 0.2, 0.3, 0.2);
    },
    // level_win: victory chord (523, 659, 784), 0.5s
    level_win: function () {
      chord([523, 659, 784], 0.5, [0.35, 0.25, 0.25]);
    },
    // barrel_break: explosion (100Hz + 200Hz + noise), 0.2s
    barrel_break: function () {
      tone(100, 0.2, 0.4);
      tone(200, 0.2, 0.3);
      noiseBurst(0.2, 0.6);
    },
    // life_lost: 200Hz + 150Hz, 0.3s
    life_lost: function () {
      dual(200, 150, 0.3, 0.4, 0.3);
    },
  };

  function play(name) {
    if (!ready || muted) return;
    var fn = sounds[name];
    if (fn) fn();
  }

  // --- public API ---

  window.PirateArcadeAudio = {
    init: init,
    resume: resume,
    setMuted: setMuted,
    play: play,
  };
})();