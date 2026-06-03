(function () {
  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !('ontouchstart' in window)) return;

  var overlay = document.getElementById('touch-overlay');
  if (!overlay) return;

  var held = {};
  var hint = document.getElementById('controls-hint');

  // Per-game control mode via data-controls attribute on the overlay.
  //   "pong"     = Cannonball Clash: left/right keys map to UP/DOWN movement.
  //   "breakout" = Treasure Cove: left/right keys map to LEFT/RIGHT movement.
  //   "asteroids"= Kraken's Wake: left/right turn, thrust, fire.
  //   absent     = default (breakout-style) for backward compat.
  var controlMode = '';
  var node = overlay;
  while (node) {
    if (node.dataset && node.dataset.controls) {
      controlMode = node.dataset.controls;
      break;
    }
    node = node.parentNode;
  }
  var isAsteroids = controlMode === 'asteroids';
  var isPong = controlMode === 'pong';
  var isBreakout = controlMode === 'breakout';

  // Key mappings per game mode
  var DIR_KEYS = {
    left: isPong ? ['ArrowUp', 'w'] : ['ArrowLeft', 'a'],
    right: isPong ? ['ArrowDown', 's'] : ['ArrowRight', 'd'],
  };

  // Dispatch keyboard events to window AND document, with correct
  // key/code per the DOM spec. Pygbag/SDL hooks keyboard events at
  // the window level, and uses both event.key and event.code to
  // map to SDL scancodes. The code field MUST be the physical key
  // name (e.g. "Space", "KeyA", "ArrowUp"), NOT the key value.
  function dispatchKey(k, type) {
    var keyData = keyMap[k] || { key: k, code: k, keyCode: 0 };
    var opts = {
      key: keyData.key, code: keyData.code,
      keyCode: keyData.keyCode, which: keyData.keyCode,
      bubbles: true, cancelable: true
    };
    try { window.dispatchEvent(new KeyboardEvent(type, opts)); } catch (e) {}
    try { document.dispatchEvent(new KeyboardEvent(type, opts)); } catch (e) {}
  }

  var keyMap = {
    'ArrowLeft':  { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37 },
    'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    'ArrowUp':    { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38 },
    'ArrowDown':  { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40 },
    ' ':          { key: ' ',          code: 'Space',      keyCode: 32 },
    'Escape':     { key: 'Escape',     code: 'Escape',     keyCode: 27 },
    'Enter':      { key: 'Enter',      code: 'Enter',      keyCode: 13 },
    'a':          { key: 'a',          code: 'KeyA',       keyCode: 65 },
    'd':          { key: 'd',          code: 'KeyD',       keyCode: 68 },
    'w':          { key: 'w',          code: 'KeyW',       keyCode: 87 },
    's':          { key: 's',          code: 'KeyS',       keyCode: 83 },
  };

  function hold(k) { dispatchKey(k, 'keydown'); }
  function release(k) { dispatchKey(k, 'keyup'); }

  function pressAndRelease(k) {
    hold(k);
    setTimeout(function () { release(k); }, 80);
  }

  function buttonFor(el) {
    while (el && el.nodeType === 1 && !el.classList.contains('btn')) {
      el = el.parentNode;
    }
    return el && el.nodeType === 1 ? el : null;
  }

  function safeHandler(fn) {
    return function (e) {
      try { fn(e); } catch (err) {
        console.error('mobile-controls: error in handler', err);
      }
    };
  }

  function handleDown(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    el = buttonFor(el);
    if (!el) return;

    var dir = el.getAttribute('data-dir');
    if (!dir) return;

    e.preventDefault();
    el.classList.add('pressed');
    el.setPointerCapture(e.pointerId);

    if (dir === 'left' || dir === 'right') {
      held[e.pointerId] = { keys: DIR_KEYS[dir] };
      held[e.pointerId].keys.forEach(hold);
    } else if (dir === 'thrust') {
      held[e.pointerId] = { keys: ['ArrowUp', 'w'] };
      held[e.pointerId].keys.forEach(hold);
    } else if (dir === 'fire') {
      held[e.pointerId] = { keys: [' '] };
      held[e.pointerId].keys.forEach(hold);
    } else if (dir === 'action') {
      pressAndRelease(' ');
    } else if (dir === 'pause') {
      pressAndRelease('Escape');
    } else if (dir === 'up') {
      pressAndRelease('ArrowUp');
    } else if (dir === 'down') {
      pressAndRelease('ArrowDown');
    }
  }

  function handleUp(e) {
    var entry = held[e.pointerId];
    if (entry) {
      entry.keys.forEach(release);
      delete held[e.pointerId];
    }
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    el = buttonFor(el);
    if (el) el.classList.remove('pressed');
  }

  function handleCancel(e) {
    var entry = held[e.pointerId];
    if (entry) {
      entry.keys.forEach(release);
      delete held[e.pointerId];
    }
  }

  overlay.addEventListener('pointerdown', safeHandler(handleDown));
  overlay.addEventListener('pointerup', safeHandler(handleUp));
  overlay.addEventListener('pointercancel', safeHandler(handleCancel));
  overlay.addEventListener('pointerleave', safeHandler(handleUp));
  overlay.addEventListener('lostpointercapture', safeHandler(handleCancel));

  document.addEventListener('pointermove', safeHandler(function (e) {
    if (overlay.classList.contains('active') && held[e.pointerId]) {
      e.preventDefault();
    }
  }), {passive: false});

  if (hint) {
    if (isAsteroids) {
      hint.textContent =
        'Touch: \u25C0 \u25B6 turn  \u2022  \u2191 thrust  \u2022  \u23FA fire  \u2022  \u275A\u275A pause';
    } else if (isPong) {
      hint.textContent =
        'Touch: \u25C0 \u25B6 up/down  \u2022  \u23CE action  \u2022  \u275A\u275A pause';
    } else {
      hint.textContent =
        'Touch: \u25C0 \u25B6 move  \u2022  \u23CE action  \u2022  \u275A\u275A pause';
    }
  }
  overlay.classList.add('active');
})();
