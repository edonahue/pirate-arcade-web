(function () {
  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !('ontouchstart' in window)) return;

  var overlay = document.getElementById('touch-overlay');
  if (!overlay) return;

  var held = {};
  var hint = document.getElementById('controls-hint');
  var dragActive = {};
  var dragStarted = false;

  // Per-game control mode
  var controlMode = '';
  var node = overlay;
  while (node) {
    if (node.dataset && node.dataset.controls) {
      controlMode = node.dataset.controls;
      break;
    }
    node = node.parentNode;
  }
  var isPong = controlMode === 'pong';

  // Key mappings for fallback nudge buttons
  var DIR_KEYS = {
    left: isPong ? ['ArrowUp', 'w'] : ['ArrowLeft', 'a'],
    right: isPong ? ['ArrowDown', 's'] : ['ArrowRight', 'd'],
  };

  var input = window.PirateArcadeInput;

  function hold(k) {
    if (input) { input.keyDown(k); }
  }
  function release(k) {
    if (input) { input.keyUp(k); }
  }

  function pressAndRelease(k) {
    if (input) {
      input.tap(k, 220);
    }
  }

  function buttonFor(el) {
    while (el && el.nodeType === 1 && !el.classList.contains('btn')) {
      el = el.parentNode;
    }
    return el && el.nodeType === 1 ? el : null;
  }

  function isDragZone(el) {
    return el && el.classList.contains('touch-drag-zone');
  }

  function safeHandler(fn) {
    return function (e) {
      try { fn(e); } catch (err) {
        console.error('mobile-controls: error in handler', err);
      }
    };
  }

  function getCanvasGameCoords(clientX, clientY) {
    var canvas = document.getElementById('canvas');
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var cw = canvas.width;
    var ch = canvas.height;
    if (!cw || !ch || !rect.width || !rect.height) return null;
    var gameX = ((clientX - rect.left) / rect.width) * cw;
    var gameY = ((clientY - rect.top) / rect.height) * ch;
    return { x: Math.round(gameX), y: Math.round(gameY) };
  }

  function updateDragTarget(e) {
    var coords = getCanvasGameCoords(e.clientX, e.clientY);
    if (!coords) return;
    var dragAxis = dragActive.axis;
    if (dragAxis === 'y') {
      if (input) input.setTouchTarget('y', coords.y, true);
    } else if (dragAxis === 'x') {
      if (input) input.setTouchTarget('x', coords.x, true);
    }
    if (!dragStarted) {
      dragStarted = true;
      overlay.classList.add('drag-active');
    }
  }

  function clearDragTarget() {
    if (dragActive.axis) {
      if (input) input.clearTouchTarget();
      dragActive.axis = null;
      dragActive.pointerId = null;
      dragStarted = false;
      overlay.classList.remove('drag-active');
    }
  }

  function handleButton(btn, e) {
    var d = btn.getAttribute('data-dir');
    if (!d) return false;
    e.preventDefault();
    btn.classList.add('pressed');
    try { btn.setPointerCapture(e.pointerId); } catch (e) {}
    if (d === 'left' || d === 'right') {
      held[e.pointerId] = { keys: DIR_KEYS[d] };
      held[e.pointerId].keys.forEach(hold);
    } else if (d === 'action') {
      document.body.classList.add('game-started');
      if (input) {
        input.keyDown('Enter');
        input.keyDown(' ');
        setTimeout(function () {
          input.keyUp(' ');
          input.keyUp('Enter');
        }, 220);
      }
    } else if (d === 'pause') {
      pressAndRelease('Escape');
    }
    return true;
  }

  function handleDown(e) {
    // Skip if target is an excluded control (e.g., Back link)
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        return; // Let browser handle natively (navigation)
      }
      target = target.parentNode;
    }

    // First check: did the user touch a button? (e.target is reliable
    // when the button has higher z-index than the drag zone)
    var btn = buttonFor(e.target);
    if (btn && handleButton(btn, e)) return;

    // Second check: fallback to elementFromPoint for drag zones
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;

    btn = buttonFor(el);
    if (btn && handleButton(btn, e)) return;

    if (isDragZone(el)) {
      e.preventDefault();
      var ddir = el.getAttribute('data-dir');
      dragActive.axis = ddir === 'drag-x' ? 'x' : 'y';
      dragActive.pointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (e) {}
      updateDragTarget(e);
      return;
    }
  }

  function handleUp(e) {
    // Skip if target is an excluded control (e.g., Back link)
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        return; // Let browser handle natively
      }
      target = target.parentNode;
    }

    if (dragActive.pointerId === e.pointerId) {
      clearDragTarget();
    }
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

  function handleMove(e) {
    // Skip if target is an excluded control (e.g., Back link)
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        return; // Let browser handle natively
      }
      target = target.parentNode;
    }

    if (dragActive.pointerId === e.pointerId) {
      e.preventDefault();
      updateDragTarget(e);
      return;
    }
    if (overlay.classList.contains('active') && held[e.pointerId]) {
      e.preventDefault();
    }
  }

  function handleCancel(e) {
    // Skip if target is an excluded control (e.g., Back link)
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        return; // Let browser handle natively
      }
      target = target.parentNode;
    }

    if (dragActive.pointerId === e.pointerId) {
      clearDragTarget();
    }
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
  document.addEventListener('pointermove', safeHandler(handleMove), {passive: false});

  if (hint) {
    if (isPong) {
      hint.textContent = 'Touch: slide ship up/down  \u2022  START  \u2022  \u275A\u275A pause';
    } else {
      hint.textContent = 'Touch: slide longboat left/right  \u2022  LAUNCH  \u2022  \u275A\u275A pause';
    }
  }
  overlay.classList.add('active');
})();
