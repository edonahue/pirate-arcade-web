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

  // Use the Python input bridge (PirateArcadeInput) which updates
  // both the pg.key.get_pressed() key state AND the pygame event
  // queue. Falls back to DOM KeyboardEvent dispatch if the bridge
  // is unavailable.
  var input = window.PirateArcadeInput;

  function hold(k) {
    if (input) { input.keyDown(k); }
  }
  function release(k) {
    if (input) { input.keyUp(k); }
  }

  function pressAndRelease(k) {
    if (input) {
      // 220ms hold so a 60 FPS pygame polling loop catches it
      input.tap(k, 220);
    }
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
    try { el.setPointerCapture(e.pointerId); } catch (e) {}

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
      // Send both Enter (for menus) and Space (for in-game actions like
      // Treasure Cove ball launch which only accepts pg.K_SPACE)
      if (input) {
        input.keyDown('Enter');
        input.keyDown(' ');
        setTimeout(function () {
          input.keyUp(' ');
          input.keyUp('Enter');
        }, 220);
      }
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
        'Touch: \u25B2 \u25BC up/down  \u2022  \u23CE start  \u2022  \u275A\u275A pause';
    } else {
      hint.textContent =
        'Touch: \u25C0 \u25B6 move  \u2022  \u23CE action  \u2022  \u275A\u275A pause';
    }
  }
  overlay.classList.add('active');
})();
