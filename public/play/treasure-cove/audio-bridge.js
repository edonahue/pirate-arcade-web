/* Treasure Cove — Web Audio API sound synthesis bridge.
 *
 * Exposes window.PirateArcadeAudio which the Python game code calls
 * via platform.window.PirateArcadeAudio.play(name).
 *
 * Sound frequencies match the desktop procedural-audio originals:
 *   ../localgame/audio.py → _make_tone(freq, dur), _make_brick_break_tone(), etc.
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

  // --- sound map (matches desktop audio.py) ---

  var sounds = {
    paddle_hit: function () { tone(440, 0.1, 0.4); },
    wall_hit:   function () { tone(220, 0.08, 0.3); },
    brick_break: function () { dual(600, 900, 0.12, 0.3, 0.2); },
    life_lost:  function () { dual(200, 150, 0.3, 0.4, 0.3); },
    level_win:  function () { chord([523, 659, 784], 0.5, [0.35, 0.25, 0.25]); },
    score:      function () { tone(180, 0.3, 0.35); },
    powerup:    function () { tone(660, 0.15, 0.4); },
    victory:    function () { chord([523, 659, 784], 0.5, [0.35, 0.25, 0.25]); },
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
