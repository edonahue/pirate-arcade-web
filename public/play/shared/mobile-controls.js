(function () {
  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !('ontouchstart' in window)) return;

  var overlay = document.getElementById('touch-overlay');
  if (!overlay) return;

  // Debug mode: ?debugTouch=1 shows outlines and logs
  var debugTouch = window.location.search.includes('debugTouch=1');
  if (debugTouch) {
    console.log('[mobile-controls] Debug mode enabled');
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
  var dragActive = {};
  var dragStarted = false;

  // Read controls metadata from game-wrap
  var gameWrap = document.getElementById('game-wrap');
  var directionalKeys = {};
  var dragAxis = 'x';
  var controlMode = '';
  if (gameWrap) {
    try {
      directionalKeys = JSON.parse(gameWrap.getAttribute('data-control-directional-keys') || '{}');
    } catch (e) {
      directionalKeys = {};
    }
    dragAxis = gameWrap.getAttribute('data-control-drag-axis') || 'x';
    controlMode = gameWrap.getAttribute('data-control-mode') || '';
  }

  // Map button data-dir to logical direction name based on control mode.
  // Pong uses left/right nudge buttons for up/down movement (vertical paddle).
  function dirToLogical(dataDir) {
    if (controlMode === 'pong') {
      if (dataDir === 'left') return 'up';
      if (dataDir === 'right') return 'down';
    }
    // breakout, asteroids, and default: left→left, right→right, up→up, down→down
    return dataDir;
  }

  var input = window.PirateArcadeInput;

  function hold(k) {
    if (input) { input.keyDown(k); }
  }
  function release(k) {
    if (input) { input.keyUp(k); }
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
      
      setTimeout(function () {
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
    if (d === 'left' || d === 'right' || d === 'up' || d === 'down') {
      var logical = dirToLogical(d);
      held[e.pointerId] = { keys: directionalKeys[logical] || ['Arrow' + logical.charAt(0).toUpperCase() + logical.slice(1)] };
      held[e.pointerId].keys.forEach(hold);
    } else if (d === 'thrust') {
      held[e.pointerId] = { keys: directionalKeys.thrust || ['ArrowUp', 'w'] };
      held[e.pointerId].keys.forEach(hold);
    } else if (d === 'fire') {
      held[e.pointerId] = { keys: directionalKeys.fire || ['Space'] };
      held[e.pointerId].keys.forEach(hold);
    } else if (d === 'action') {
      document.body.classList.add('game-started');
      if (window.PirateArcadeActions && window.PirateArcadeActions.performPrimary) {
        window.PirateArcadeActions.performPrimary();
      } else if (input) {
        input.tap('Enter', 220);
      }
    } else if (d === 'pause') {
      if (input) {
        input.pause();
      }
    }
    return true;
  }

  function handleDown(e) {
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        if (debugTouch) {
          console.log('[mobile-controls] Back link click allowed');
          debugOutline(target, '#ff0', 'Back-link');
        }
        return;
      }
      target = target.parentNode;
    }

    var btn = buttonFor(e.target);
    if (btn && handleButton(btn, e)) return;

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
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        if (debugTouch) {
          console.log('[mobile-controls] Back link click allowed');
          debugOutline(target, '#ff0', 'Back-link');
        }
        return;
      }
      target = target.parentNode;
    }

    if (dragActive.pointerId === e.pointerId) {
      clearDragTarget();
      if (debugTouch) {
        console.log('[mobile-controls] Drag target cleared');
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
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        if (debugTouch) {
          console.log('[mobile-controls] Back link area touched - ignored');
          debugOutline(target, '#ff0', 'Back-link area');
        }
        return;
      }
      target = target.parentNode;
    }

    if (dragActive.pointerId === e.pointerId) {
      e.preventDefault();
      if (debugTouch) {
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
    var target = e.target;
    while (target) {
      if (target.hasAttribute && target.hasAttribute('data-no-touch-control')) {
        return;
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

  overlay.classList.add('active');

  // ── Release-all: reset all input state ──────────────────────
  function mobileReleaseAll(reason) {
    if (window.PirateArcadeInput && window.PirateArcadeInput.releaseAll) {
      window.PirateArcadeInput.releaseAll(reason || 'unknown');
    }
    held = {};
    dragActive = {};
    dragStarted = false;
    overlay.classList.remove('drag-active');
    overlay.querySelectorAll('.btn.pressed').forEach(function (el) {
      el.classList.remove('pressed');
    });
  }

  window.__paReleaseAll = mobileReleaseAll;

  // ── Wire release events ─────────────────────────────────────
  if (!window.__paReleaseWired) {
    window.__paReleaseWired = true;
    window.addEventListener('blur', function () { mobileReleaseAll('blur'); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) mobileReleaseAll('visibility');
    });
    window.addEventListener('pagehide', function () { mobileReleaseAll('pagehide'); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { mobileReleaseAll('orientation'); }, 100);
    });
  }

  // ── Update action button label from game state ──────────────
  if (window.PirateArcadeGameState && window.PirateArcadeActions) {
    window.PirateArcadeGameState.subscribe(function (state) {
      if (state && state.phase) {
        window.PirateArcadeActions.updateButtonLabel();
      }
    });
  }
})();
