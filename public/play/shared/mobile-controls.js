(function () {
  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !('ontouchstart' in window)) return;

  var overlay = document.getElementById('touch-overlay');
  if (!overlay) return;

  // Debug mode: ?debugTouch=1 shows outlines and logs
  var debugTouch = window.location.search.includes('debugTouch=1');
  if (debugTouch) {
    console.log('[mobile-controls] Debug mode enabled');
    // Inject debug styles
    var style = document.createElement('style');
    style.textContent = `
      .debug-touch-outline {
        position: fixed !important;
        pointer-events: none !important;
        z-index: 9999999 !important;
      }
      .debug-back-link { outline: 3px solid #ff0 !important; }
      .debug-drag-zone { outline: 3px solid #0ff !important; }
      .debug-btn-nudge { outline: 3px solid #0f0 !important; }
      .debug-btn-action { outline: 3px solid #ff0 !important; }
      .debug-btn-pause { outline: 3px solid #f0f !important; }
    `;
    document.head.appendChild(style);
  }

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
  var isBreakout = controlMode === 'breakout';
  var isAsteroids = controlMode === 'asteroids';

  // Key mappings for fallback nudge buttons
  var DIR_KEYS = {
    left: isPong ? ['ArrowUp', 'w'] : isBreakout ? ['ArrowLeft', 'a'] : ['ArrowLeft', 'a'],
    right: isPong ? ['ArrowDown', 's'] : isBreakout ? ['ArrowRight', 'd'] : ['ArrowRight', 'd'],
    up: ['ArrowUp', 'w'],
    down: ['ArrowDown', 's'],
    thrust: ['ArrowUp', 'w'],
    fire: ['Space'],
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

  // Debug helper: show outline around element
  function debugOutline(el, color, label) {
    if (!debugTouch || !el) return;
    el.classList.add('debug-touch-outline');
    el.style.borderColor = color;
    if (label) {
      var labelEl = document.createElement('div');
      labelEl.style.position = 'fixed';
      labelEl.style.background = 'rgba(0,0,0,0.7)';
      labelEl.style.color = '#fff';
      labelEl.style.font = '10px monospace';
      labelEl.style.padding = '2px 4px';
      labelEl.style.borderRadius = '2px';
      labelEl.style.zIndex = '9999999';
      labelEl.style.pointerEvents = 'none';
      labelEl.textContent = label;
      
      var rect = el.getBoundingClientRect();
      labelEl.style.left = (rect.left + rect.width/2 - 20) + 'px';
      labelEl.style.top = (rect.top - 20) + 'px';
      document.body.appendChild(labelEl);
      
      // Clean up after short delay
      setTimeout(() => {
        labelEl.remove();
        el.classList.remove('debug-touch-outline');
      }, 1500);
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
    } else if (d === 'up' || d === 'down') {
      held[e.pointerId] = { keys: DIR_KEYS[d] };
      held[e.pointerId].keys.forEach(hold);
    } else if (d === 'thrust') {
      held[e.pointerId] = { keys: DIR_KEYS.thrust };
      held[e.pointerId].keys.forEach(hold);
    } else if (d === 'fire') {
      held[e.pointerId] = { keys: DIR_KEYS.fire };
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
      if (input) {
        input.pause();
      }
    }
    return true;
  }

  function handleDown(e) {
    // Skip if target is an excluded control (e.g., Back link)
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        if (debugTouch) {
          console.log('[mobile-controls] Back link click allowed');
          debugOutline(target, '#ff0', 'Back-link');
        }
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
      if (debugTouch) {
        console.log('[mobile-controls] Drag zone activated');
        debugOutline(el, '#0ff', 'Drag-zone');
      }
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
        if (debugTouch) {
          console.log('[mobile-controls] Back link click allowed');
          debugOutline(target, '#ff0', 'Back-link');
        }
        return; // Let browser handle natively
      }
      target = target.parentNode;
    }

    if (dragActive.pointerId === e.pointerId) {
      clearDragTarget();
      if (debugTouch) {
        console.log('[mobile-controls] Drag target cleared');
        // Could outline the drag zone here but it's already released
      }
    }
    var entry = held[e.pointerId];
    if (entry) {
      entry.keys.forEach(release);
      delete held[e.pointerId];
    }
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    el = buttonFor(el);
    if (el) {
      el.classList.remove('pressed');
      if (debugTouch) {
        debugOutline(el, '#0f0', 'Button released');
      }
    }
  }

  function handleMove(e) {
    // Skip if target is an excluded control (e.g., Back link)
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        if (debugTouch) {
          console.log('[mobile-controls] Back link area touched - ignored');
          debugOutline(target, '#ff0', 'Back-link area');
        }
        return; // Let browser handle natively
      }
      target = target.parentNode;
    }

    if (dragActive.pointerId === e.pointerId) {
      e.preventDefault();
      if (debugTouch) {
        // Outline would be distracting during drag, so just log
        console.log('[mobile-controls] Dragging...');
      }
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
      hint.textContent = 'Slide ship up/down  \u2022  START  \u2022  PAUSE';
    } else if (isBreakout) {
      hint.textContent = 'Slide longboat left/right  \u2022  LAUNCH  \u2022  PAUSE';
    } else if (isAsteroids) {
      hint.textContent = 'TURN  \u2022  THRUST  \u2022  FIRE  \u2022  PAUSE';
    } else {
      hint.textContent = 'Slide  \u2022  ACTION  \u2022  PAUSE';
    }
  }
  overlay.classList.add('active');
})();
