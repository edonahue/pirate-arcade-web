(function () {
  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !('ontouchstart' in window)) return;

  var overlay = document.getElementById('touch-overlay');
  if (!overlay) return;

  var held = {};
  var hint = document.getElementById('controls-hint');

  // Per-game control mode. Default keeps the existing behavior for
  // Cannonball Clash and Treasure Cove. Set data-controls="asteroids" on
  // the touch overlay (or any ancestor) to switch to Kraken's Wake style:
  // hold left/right to turn, hold a thrust button, hold a fire button,
  // tap pause. Adding new buttons and modes is non-breaking: when the
  // attribute is absent, the original mappings and the original hint
  // text are used unchanged.
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

  function keyEvent(k, type) {
    var code = {ArrowLeft:37,ArrowRight:39,ArrowUp:38,ArrowDown:40,' ':32,Escape:27}[k]||0;
    document.dispatchEvent(new KeyboardEvent(type, {
      key: k, code: k, keyCode: code, which: code,
      bubbles: true, cancelable: true
    }));
  }

  function hold(k) { keyEvent(k, 'keydown'); }
  function release(k) { keyEvent(k, 'keyup'); }

  function pressAndRelease(k) {
    hold(k);
    setTimeout(function () { release(k); }, 80);
  }

  function buttonFor(el) {
    while (el && !el.classList.contains('btn')) el = el.parentNode;
    return el;
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

    if (dir === 'left') {
      held[e.pointerId] = {keys:['ArrowLeft','a']};
      held[e.pointerId].keys.forEach(hold);
    } else if (dir === 'right') {
      held[e.pointerId] = {keys:['ArrowRight','d']};
      held[e.pointerId].keys.forEach(hold);
    } else if (dir === 'thrust') {
      held[e.pointerId] = {keys:['ArrowUp','w']};
      held[e.pointerId].keys.forEach(hold);
    } else if (dir === 'fire') {
      held[e.pointerId] = {keys:[' ']};
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
    // Note: We don't need to check for pressed buttons here as we're just cleaning up state
    // The classList removal happens in handleUp/handleDown when we have a valid element
  }

  overlay.addEventListener('pointerdown', handleDown);
  overlay.addEventListener('pointerup', handleUp);
  overlay.addEventListener('pointercancel', handleCancel);
  overlay.addEventListener('pointerleave', handleUp);
  overlay.addEventListener('lostpointercapture', handleCancel);

  document.addEventListener('pointermove', function (e) {
    if (overlay.classList.contains('active') && held[e.pointerId]) {
      e.preventDefault();
    }
  }, {passive: false});

  if (hint) {
    if (isAsteroids) {
      hint.textContent =
        'Touch: \u25C0 \u25B6 turn  \u2022  \u2191 thrust  \u2022  \u23FA fire  \u2022  \u275A\u275A pause';
    } else {
      hint.textContent =
        'Touch: \u25C0 \u25B6 move  \u2022  \u23CE launch  \u2022  \u275A\u275A pause';
    }
  }
  overlay.classList.add('active');
})();
