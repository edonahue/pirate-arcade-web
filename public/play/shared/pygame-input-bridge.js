(function () {

  // ── Debug log ──────────────────────────────────────────────
  var debugLog = { events: [], bridgeCalls: [], domEvents: [] };

  function logArr(arr, entry) {
    arr.push(entry);
    // keep last 1000 entries per array
    if (arr.length > 1000) arr.shift();
  }

  function logEvent(tag, data) {
    logArr(debugLog.events, { tag: tag, ts: Date.now(), data: data });
  }

  function logBridgeCall(keyName, down, ok) {
    logArr(debugLog.bridgeCalls, { key: keyName, down: down, ok: ok, ts: Date.now() });
  }

  function logDomEvent(keyName, type, target) {
    logArr(debugLog.domEvents, { key: keyName, type: type, target: target, ts: Date.now() });
  }

  // ── Key normalisation ──────────────────────────────────────
  function normalizeKey(k) {
    if (k === ' ' || k === 'Space' || k === 'space') return 'Space';
    if (k === 'Enter' || k === 'Return' || k === 'return') return 'Enter';
    if (k === 'Escape' || k === 'Esc' || k === 'esc') return 'Escape';
    if (k === 'ArrowUp' || k === 'Up' || k === 'up') return 'ArrowUp';
    if (k === 'ArrowDown' || k === 'Down' || k === 'down') return 'ArrowDown';
    if (k === 'ArrowLeft' || k === 'Left' || k === 'left') return 'ArrowLeft';
    if (k === 'ArrowRight' || k === 'Right' || k === 'right') return 'ArrowRight';
    return k;
  }

  // DOM key mapping for the fallback dispatch
  var DOM_KEY_MAP = {
    Space:      { key: ' ',  code: 'Space',      keyCode: 32 },
    Enter:      { key: 'Enter', code: 'Enter',   keyCode: 13 },
    Escape:     { key: 'Escape', code: 'Escape', keyCode: 27 },
    ArrowUp:    { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38 },
    ArrowDown:  { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40 },
    ArrowLeft:  { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    a:  { key: 'a',  code: 'KeyA', keyCode: 65 },
    d:  { key: 'd',  code: 'KeyD', keyCode: 68 },
    w:  { key: 'w',  code: 'KeyW', keyCode: 87 },
    s:  { key: 's',  code: 'KeyS', keyCode: 83 },
    p:  { key: 'p',  code: 'KeyP', keyCode: 80 },
  };

  // ── Python bridge ──────────────────────────────────────────
  function callPythonKeyBridge(keyName, isDown) {
    if (!window.python || typeof window.python.PyRun_SimpleString !== 'function') {
      return false;
    }
    var safeKey = JSON.stringify(keyName === ' ' ? 'Space' : keyName);
    var down = isDown ? 'True' : 'False';
    var code =
      'import builtins\n' +
      'getattr(builtins, \'__pa_post_key\', lambda *a: None)(' +
      safeKey + ', ' + down + ')';
    try {
      window.python.PyRun_SimpleString(code);
      return true;
    } catch (err) {
      console.warn('PirateArcadeInput: bridge call failed', err);
      return false;
    }
  }

  // ── DOM fallback dispatch ───────────────────────────────────
  var _isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  function focusCanvas() {
    if (_isTouch) return; // iOS Safari opens virtual keyboard when focusing a canvas
    var c = document.getElementById('canvas');
    if (c && typeof c.focus === 'function') {
      try { c.focus(); } catch (e) {}
    }
  }

  function dispatchFallbackKeyEvent(keyName, type) {
    var domKey = DOM_KEY_MAP[keyName] || { key: keyName, code: keyName, keyCode: 0 };
    var opts = {
      key: domKey.key, code: domKey.code, keyCode: domKey.keyCode,
      which: domKey.keyCode, bubbles: true, cancelable: true,
    };

    var c = document.getElementById('canvas');
    if (c) {
      try { c.dispatchEvent(new KeyboardEvent(type, opts)); logDomEvent(keyName, type, 'canvas'); } catch (e) {}
    }

    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement) {
      try { document.activeElement.dispatchEvent(new KeyboardEvent(type, opts)); logDomEvent(keyName, type, 'activeElement'); } catch (e) {}
    }

    try { document.dispatchEvent(new KeyboardEvent(type, opts)); logDomEvent(keyName, type, 'document'); } catch (e) {}
    try { window.dispatchEvent(new KeyboardEvent(type, opts)); logDomEvent(keyName, type, 'window'); } catch (e) {}
  }

  // ── Held-key tracking ──────────────────────────────────────
  var _heldKeys = {};
  var _lastReleaseReason = null;
  var _releaseCount = 0;

  // ── Public API ──────────────────────────────────────────────
  var PirateArcadeInput = {
    keyDown: function (keyName) {
      keyName = normalizeKey(keyName);
      _heldKeys[keyName] = true;
      logEvent('keyDown', { key: keyName });
      focusCanvas();
      var ok = callPythonKeyBridge(keyName, true);
      logBridgeCall(keyName, true, ok);
      if (!ok) logEvent('bridgeMiss', { key: keyName });
      dispatchFallbackKeyEvent(keyName, 'keydown');
    },

    keyUp: function (keyName) {
      keyName = normalizeKey(keyName);
      delete _heldKeys[keyName];
      logEvent('keyUp', { key: keyName });
      var ok = callPythonKeyBridge(keyName, false);
      logBridgeCall(keyName, false, ok);
      if (!ok) logEvent('bridgeMiss', { key: keyName });
      dispatchFallbackKeyEvent(keyName, 'keyup');
    },

    tap: function (keyName, holdMs) {
      if (holdMs == null) holdMs = 200;
      keyName = normalizeKey(keyName);
      logEvent('tapStart', { key: keyName, holdMs: holdMs });
      this.keyDown(keyName);
      var self = this;
      setTimeout(function () {
        self.keyUp(keyName);
        logEvent('tapEnd', { key: keyName });
      }, holdMs);
    },

    releaseAll: function (reason) {
      var r = reason || 'unknown';
      _lastReleaseReason = r;
      _releaseCount++;
      logEvent('releaseAll', { reason: r, releaseCount: _releaseCount });
      for (var k in _heldKeys) {
        if (_heldKeys.hasOwnProperty(k)) {
          var keyName = k;
          var ok = callPythonKeyBridge(keyName, false);
          logBridgeCall(keyName, false, ok);
          logEvent('releaseKey', { key: keyName, bridgeOk: ok });
          dispatchFallbackKeyEvent(keyName, 'keyup');
        }
      }
      _heldKeys = {};
      this.clearTouchTarget();
      // Diagnostics history is preserved for post-failure analysis.
      // Call clearDebug() explicitly only from tests or debug UI.
    },

    getState: function () {
      var hk = {};
      for (var k in _heldKeys) {
        if (_heldKeys.hasOwnProperty(k)) hk[k] = true;
      }
      return {
        heldKeys: hk,
        heldCount: Object.keys(_heldKeys).length,
        releaseReason: _lastReleaseReason,
        releaseCount: _releaseCount,
        lastReleaseReason: _lastReleaseReason,
      };
    },

    getDebug: function () { return debugLog; },
    clearDebug: function () {
      debugLog.events.length = 0;
      debugLog.bridgeCalls.length = 0;
      debugLog.domEvents.length = 0;
    },

    setTouchTarget: function (axis, value, active) {
      logEvent('touchTarget', { axis: axis, value: value, active: active });
      if (!window.python || typeof window.python.PyRun_SimpleString !== 'function') return false;
      var safeAxis = JSON.stringify(axis);
      var safeValue = Number.isFinite(value) ? String(Math.round(value)) : '0';
      var safeActive = active ? 'True' : 'False';
      var code =
        'import builtins\n' +
        'getattr(builtins, \'__pa_set_touch_target\', lambda *a: None)(' +
        safeAxis + ', ' + safeValue + ', ' + safeActive + ')';
      try {
        window.python.PyRun_SimpleString(code);
        return true;
      } catch (err) {
        console.warn('PirateArcadeInput touch target bridge failed', err);
        return false;
      }
    },

    clearTouchTarget: function () {
      return this.setTouchTarget('none', 0, false);
    },

    pause: function () {
      logEvent('pause', {});
      this.releaseAll('pause');
      this.tap('Escape', 120);
    },
  };

  // Query Python-side bridge state for tests
  PirateArcadeInput.getDebugPythonState = function () {
    if (!window.python || typeof window.python.PyRun_SimpleString !== 'function') {
      return { keyEventCount: 0, lastKey: null, lastKeyDown: false, touchEventCount: 0, touchActive: false, bridgeAvailable: false };
    }
    try {
      window.python.PyRun_SimpleString(
        'import json, builtins\n' +
        'try:\n' +
        '  _pa_state = json.dumps({\n' +
        '    "keyEventCount": getattr(builtins, "__pa_key_event_count__", 0),\n' +
        '    "lastKey": str(getattr(builtins, "__pa_last_key__", "None")),\n' +
        '    "lastKeyDown": bool(getattr(builtins, "__pa_last_key_down__", False)),\n' +
        '    "touchEventCount": getattr(builtins, "__pa_touch_event_count__", 0),\n' +
        '    "touchActive": bool(getattr(builtins, "__pa_touch_active__", False)),\n' +
        '    "lastTouchAxis": str(getattr(builtins, "__pa_last_touch_axis__", "None")),\n' +
        '    "lastTouchValue": float(getattr(builtins, "__pa_last_touch_value__", 0)),\n' +
        '  })\n' +
        '  open("/tmp/_pa_test_state.json", "w").write(_pa_state)\n' +
        'except Exception:\n' +
        '  pass\n'
      );
      var stateStr = window.python.FS.readFile('/tmp/_pa_test_state.json', { encoding: 'utf8' });
      return JSON.parse(stateStr);
    } catch (e) {
      return { keyEventCount: 0, lastKey: null, lastKeyDown: false, touchEventCount: 0, touchActive: false, bridgeAvailable: false, error: e.message };
    }
  };

  window.PirateArcadeInput = PirateArcadeInput;
  window.__paInputDebug = debugLog;

  // ── Loading overlay API ─────────────────────────────────────
  var loadingEl = document.getElementById('game-loading');
  var loadingDetail = document.getElementById('game-loading-detail');
  var booted = false;
  var _loadingWarnTimer = null;
  var _retryBtn = null;

  function _startLoadingWarn() {
    _clearLoadingWarn();
    _loadingWarnTimer = setTimeout(function () {
      var note = loadingEl && loadingEl.querySelector('.loader-note');
      if (note) note.textContent = 'Still working — first load takes a little while on iPad.';
    }, 30000);
  }

  function _clearLoadingWarn() {
    if (_loadingWarnTimer) {
      clearTimeout(_loadingWarnTimer);
      _loadingWarnTimer = null;
    }
  }

  function _removeRetryBtn() {
    if (_retryBtn && _retryBtn.parentNode) {
      _retryBtn.parentNode.removeChild(_retryBtn);
    }
    _retryBtn = null;
  }

  function _showRetryBtn() {
    _removeRetryBtn();
    _retryBtn = document.createElement('button');
    _retryBtn.textContent = 'Try Again';
    _retryBtn.className = 'loading-retry-btn';
    _retryBtn.addEventListener('click', function () {
      logEvent('loadingRetry', {});
      window.location.reload();
    });
    if (loadingEl) loadingEl.appendChild(_retryBtn);
  }

  var PirateArcadeLoading = {
    set: function (msg) {
      logEvent('loadingSet', { msg: msg });
      if (loadingDetail) loadingDetail.textContent = msg;
      if (loadingEl) {
        loadingEl.classList.remove('hidden', 'game-error');
      }
      _removeRetryBtn();
      _startLoadingWarn();
    },
    ready: function (msg) {
      logEvent('loadingReady', { msg: msg || '' });
      booted = true;
      _clearLoadingWarn();
      _removeRetryBtn();
      if (msg && loadingDetail) loadingDetail.textContent = msg;
      if (loadingEl) {
        loadingEl.classList.add('hidden');
        if (window.PirateArcadeMetrics) {
          window.PirateArcadeMetrics.mark('loader-hidden');
          window.PirateArcadeMetrics.computeDurations();
        }
      }
    },
    error: function (msg) {
      logEvent('loadingError', { msg: msg });
      _clearLoadingWarn();
      if (loadingDetail) loadingDetail.textContent = msg;
      if (loadingEl) {
        loadingEl.classList.remove('hidden');
        loadingEl.classList.add('game-error');
      }
      document.body.classList.add('game-error');
      PirateArcadeInput.releaseAll('error');
      _showRetryBtn();
    },
    isReady: function () { return booted; },
  };

  window.PirateArcadeLoading = PirateArcadeLoading;

  // ── Shared game-state contract ──────────────────────────────
  // Reads Python-side __pa_game_state_json (set each frame by each
  // game's _update) via PyRun_SimpleString + FS.  Polling is cheap
  // enough for button-label updates and lifecycle management; tests
  // can also read the file directly.
  //
  // PirateArcadeGameState:
  //   getState()          → last polled state or null
  //   subscribe(cb)       → returns unsubscribe function
  //   startPolling(ms)    → begin polling at interval (default 500)
  //   stopPolling()       → stop polling
  //   refresh()           → one-shot poll

  var _gameState = null;
  var _gameStateSubs = [];
  var _gameStateTimer = null;
  var _gameStatePolling = false;

  function _readGameState() {
    // Fast path: JS-set state (web-native games like Race can set
    // window.__pa_game_state_json directly)
    if (typeof window.__pa_game_state_json === 'string') {
      try { return JSON.parse(window.__pa_game_state_json); } catch (e) { return null; }
    }
    // DOM element bridge: Pygbag Python writes state into
    // #pa-game-state via _w["pa-game-state"].innerText.
    var bridgeEl = document.getElementById('pa-game-state');
    if (bridgeEl && bridgeEl.textContent) {
      try { return JSON.parse(bridgeEl.textContent); } catch (e) { }
    }
    // Fallback: Python file I/O (may not work in all Pygbag versions)
    if (!window.python || typeof window.python.PyRun_SimpleString !== 'function' ||
        typeof window.python.FS?.readFile !== 'function') {
      return null;
    }
    try {
      window.python.PyRun_SimpleString(
        'import json, builtins\n' +
        'open("/tmp/_pa_game_state.json","w").write(' +
        '  getattr(builtins, "__pa_game_state_json", "null")\n' +
        ')'
      );
      var raw = window.python.FS.readFile('/tmp/_pa_game_state.json', { encoding: 'utf8' });
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  var PirateArcadeGameState = {
    getState: function () { return _gameState; },
    subscribe: function (cb) {
      _gameStateSubs.push(cb);
      return function () {
        var idx = _gameStateSubs.indexOf(cb);
        if (idx >= 0) _gameStateSubs.splice(idx, 1);
      };
    },
    startPolling: function (intervalMs) {
      if (_gameStatePolling) return;
      _gameStatePolling = true;
      intervalMs = intervalMs || 500;
      function poll() {
        if (!_gameStatePolling) return;
        PirateArcadeGameState.refresh();
        _gameStateTimer = setTimeout(poll, intervalMs);
      }
      poll();
    },
    stopPolling: function () {
      _gameStatePolling = false;
      if (_gameStateTimer) {
        clearTimeout(_gameStateTimer);
        _gameStateTimer = null;
      }
    },
    refresh: function () {
      var parsed = _readGameState();
      if (!parsed) return;
      if (JSON.stringify(parsed) !== JSON.stringify(_gameState)) {
        _gameState = parsed;
        for (var i = 0; i < _gameStateSubs.length; i++) {
          try { _gameStateSubs[i](_gameState); } catch (e) {}
        }
      }
    },
  };

  window.PirateArcadeGameState = PirateArcadeGameState;

  // ── Per-game action semantics ────────────────────────────────
  // Dispatches the correct primary key for each game based on its
  // control mode and current game phase.  One tap = one key — no
  // Enter+Space double dispatch.
  var PirateArcadeActions = {
    getPrimaryKey: function () {
      var mode = '';
      var ov = document.getElementById('touch-overlay');
      if (ov && ov.dataset && ov.dataset.controls) mode = ov.dataset.controls;
      if (mode === 'breakout') return 'Space';
      if (mode === 'asteroids') return 'Space';
      return 'Enter';
    },
    performPrimary: function () {
      logEvent('actionPrimary', { key: this.getPrimaryKey() });
      if (window.PirateArcadeInput) {
        window.PirateArcadeInput.tap(this.getPrimaryKey(), 220);
      }
    },
    getLabel: function () {
      var state = window.PirateArcadeGameState
        ? window.PirateArcadeGameState.getState()
        : null;
      var phase = state && state.phase;
      if (phase === 'game-over') return 'PLAY AGAIN';
      if (phase === 'menu') {
        var mode = '';
        var ov = document.getElementById('touch-overlay');
        if (ov && ov.dataset && ov.dataset.controls) mode = ov.dataset.controls;
        if (mode === 'breakout') return 'LAUNCH';
        if (mode === 'asteroids') return 'START';
        return 'START';
      }
      return 'ACTION';
    },
  };

  window.PirateArcadeActions = PirateArcadeActions;
  logEvent('bridgeInit', {});
})();
