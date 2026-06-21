(function () {

  // ── Debug log ──────────────────────────────────────────────
  // Small ring buffer in normal mode; ?debug expands to 1000.
  var DEBUG_RING_SIZE = /[?&]debug\b/.test(window.location.search) ? 1000 : 100;
  var debugLog = { events: [], bridgeCalls: [], domEvents: [] };

  // Monotonic counter for total successful bridge calls (never resets).
  var _successfulBridgeCalls = 0;

  function logArr(arr, entry) {
    arr.push(entry);
    if (arr.length > DEBUG_RING_SIZE) arr.shift();
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
      _successfulBridgeCalls++;
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
  var _pendingTaps = {};
  var _lastReleaseReason = null;
  var _releaseCount = 0;
  var _firstInputMarked = false;

  function markFirstInputIfNeeded() {
    if (!_firstInputMarked && window.PirateArcadeMetrics) {
      _firstInputMarked = true;
      window.PirateArcadeMetrics.markFirstUserInput();
    }
  }

  // ── Public API ──────────────────────────────────────────────
  var PirateArcadeInput = {
    keyDown: function (keyName) {
      keyName = normalizeKey(keyName);
      _heldKeys[keyName] = true;
      logEvent('keyDown', { key: keyName });
      focusCanvas();
      var ok = callPythonKeyBridge(keyName, true);
      logBridgeCall(keyName, true, ok);
      if (ok) markFirstInputIfNeeded();
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
      // Cancel any existing pending tap for this key
      if (_pendingTaps[keyName]) {
        clearTimeout(_pendingTaps[keyName]);
      }
      var self = this;
      _pendingTaps[keyName] = setTimeout(function () {
        delete _pendingTaps[keyName];
        self.keyUp(keyName);
        logEvent('tapEnd', { key: keyName });
      }, holdMs);
    },

    releaseAll: function (reason) {
      var r = reason || 'unknown';
      _lastReleaseReason = r;
      _releaseCount++;
      logEvent('releaseAll', { reason: r, releaseCount: _releaseCount });
      for (var pt in _pendingTaps) {
        if (_pendingTaps.hasOwnProperty(pt)) {
          clearTimeout(_pendingTaps[pt]);
          logEvent('cancelPendingTap', { key: pt });
        }
      }
      _pendingTaps = {};
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
    },

    getState: function () {
      var hk = {};
      for (var k in _heldKeys) {
        if (_heldKeys.hasOwnProperty(k)) hk[k] = true;
      }
      var pt = {};
      for (var p in _pendingTaps) {
        if (_pendingTaps.hasOwnProperty(p)) pt[p] = true;
      }
      return {
        heldKeys: hk,
        heldCount: Object.keys(_heldKeys).length,
        pendingTapKeys: pt,
        pendingTapCount: Object.keys(_pendingTaps).length,
        releaseReason: _lastReleaseReason,
        releaseCount: _releaseCount,
        lastReleaseReason: _lastReleaseReason,
        successfulBridgeCalls: _successfulBridgeCalls,
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
        if (active) markFirstInputIfNeeded();
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
  Object.defineProperty(window, '__paSuccessBridgeCalls', {
    get: function () { return _successfulBridgeCalls; },
    configurable: true,
    enumerable: true,
  });

  // ── Shared game-state contract ──────────────────────────────
  // MutationObserver-first observation of the #pa-game-state element
  // with bounded polling as fallback.  BFCache pageshow restores
  // observation after Safari/Chrome page-cache restore.
  //
  // PirateArcadeGameState:
  //   getState()          → last polled state or null
  //   subscribe(cb)       → returns unsubscribe function
  //   startPolling(ms)    → begin polling (bounded to MAX_POLL_INTERVAL)
  //   stopPolling()       → stop polling
  //   refresh()           → one-shot poll

  var _gameState = null;
  var _lastRawJson = null;
  var _gameStateSubs = new Set();
  var _gameStateTimer = null;
  var _gameStatePolling = false;
  var _bridgeMeta = {
    source: null,
    lastUpdatedAt: null,
    parseErrorCount: 0,
    stale: true,
    observerType: 'none',
    observerConnected: false,
    bfcacheRestores: 0,
    mutationCount: 0,
    pollCycles: 0,
    rawReadCount: 0,
    unchangedRawSkips: 0,
    parseCount: 0,
    subscriberNotificationCount: 0,
  };
  var _stateObserver = null;
  var _observerTarget = null;
  var _debounceTimer = null;
  var _bfcacheRestoreCount = 0;

  var POLL_INTERVAL = 500;
  var MAX_POLL_INTERVAL = 2000;
  var DEBOUNCE_MS = 50;

  function _readGameState() {
    // Fast path: JS-set state (web-native games like Race can set
    // window.__pa_game_state_json directly)
    if (typeof window.__pa_game_state_json === 'string') {
      try {
        _bridgeMeta.source = 'window.__pa_game_state_json';
        _bridgeMeta.lastUpdatedAt = Date.now();
        _bridgeMeta.stale = false;
        return JSON.parse(window.__pa_game_state_json);
      } catch (e) {
        _bridgeMeta.parseErrorCount++;
        return null;
      }
    }
    // DOM element bridge: Pygbag Python writes state into
    // #pa-game-state via _w["pa-game-state"].innerText.
    var bridgeEl = document.getElementById('pa-game-state');
    if (bridgeEl && bridgeEl.textContent) {
      try {
        _bridgeMeta.source = 'dom#pa-game-state';
        _bridgeMeta.lastUpdatedAt = Date.now();
        _bridgeMeta.stale = false;
        return JSON.parse(bridgeEl.textContent);
      } catch (e) {
        _bridgeMeta.parseErrorCount++;
      }
    }
    // Fallback: Python file I/O (may not work in all Pygbag versions)
    if (!window.python || typeof window.python.PyRun_SimpleString !== 'function' ||
        typeof window.python.FS?.readFile !== 'function') {
      _bridgeMeta.stale = true;
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
      _bridgeMeta.source = 'python-file-fallback';
      _bridgeMeta.lastUpdatedAt = Date.now();
      _bridgeMeta.stale = false;
      return JSON.parse(raw);
    } catch (e) {
      _bridgeMeta.parseErrorCount++;
      _bridgeMeta.stale = true;
      return null;
    }
  }

  function _notifySubscribers() {
    _bridgeMeta.subscriberNotificationCount++;
    _gameStateSubs.forEach(function (cb) {
      try { cb(_gameState); } catch (e) {}
    });
  }

  function _readRawJson() {
    // Fast source: JS-set state (Race sets window.__pa_game_state_json directly)
    if (typeof window.__pa_game_state_json === 'string') {
      _bridgeMeta.source = 'window.__pa_game_state_json';
      _bridgeMeta.lastUpdatedAt = Date.now();
      _bridgeMeta.stale = false;
      return window.__pa_game_state_json;
    }
    // DOM element bridge: Pygbag writes into #pa-game-state via innerText
    var bridgeEl = document.getElementById('pa-game-state');
    if (bridgeEl && bridgeEl.textContent) {
      _bridgeMeta.source = 'dom#pa-game-state';
      _bridgeMeta.lastUpdatedAt = Date.now();
      _bridgeMeta.stale = false;
      return bridgeEl.textContent;
    }
    return null;
  }

  function _refreshAndNotify() {
    // Fast path: compare raw JSON strings (avoids double-stringify)
    var raw = _readRawJson();
    if (raw) {
      _bridgeMeta.rawReadCount++;
      if (raw === _lastRawJson) {
        _bridgeMeta.unchangedRawSkips++;
        return;
      }
      _lastRawJson = raw;
      try {
        _gameState = JSON.parse(raw);
        _bridgeMeta.parseCount++;
        _notifySubscribers();
        return;
      } catch (e) {
        _bridgeMeta.parseErrorCount++;
      }
    }
    // Fallback: python file I/O
    var parsed = _readGameState();
    if (!parsed) return;
    _bridgeMeta.parseCount++;
    if (JSON.stringify(parsed) !== JSON.stringify(_gameState)) {
      _gameState = parsed;
      _notifySubscribers();
    }
  }

  // ── MutationObserver ────────────────────────────────────────

  function _startMutationObserver() {
    _stopMutationObserver();
    var el = document.getElementById('pa-game-state');
    if (!el) {
      _bridgeMeta.observerType = 'polling';
      _bridgeMeta.observerConnected = false;
      _bridgeMeta.stale = true;
      return false;
    }
    _observerTarget = el;
    _stateObserver = new MutationObserver(function () {
      _bridgeMeta.mutationCount++;
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function () {
        _debounceTimer = null;
        _refreshAndNotify();
      }, DEBOUNCE_MS);
    });
    _stateObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    _bridgeMeta.observerType = 'mutation';
    _bridgeMeta.observerConnected = true;
    _bridgeMeta.stale = false;
    return true;
  }

  function _stopMutationObserver() {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }
    if (_stateObserver) {
      _stateObserver.disconnect();
      _stateObserver = null;
    }
    _observerTarget = null;
    _bridgeMeta.observerConnected = false;
  }

  // ── Bounded polling (fallback) ─────────────────────────────

  function _pollingCycle() {
    if (!_gameStatePolling) return;
    _bridgeMeta.pollCycles++;

    // Upgrade to MutationObserver if #pa-game-state element appears
    if (!_stateObserver) {
      var upgraded = _startMutationObserver();
      if (upgraded) {
        _gameStatePolling = false;
        if (_gameStateTimer) {
          clearTimeout(_gameStateTimer);
          _gameStateTimer = null;
        }
        _refreshAndNotify();
        return;
      }
    }

    _refreshAndNotify();
    _gameStateTimer = setTimeout(_pollingCycle, POLL_INTERVAL);
  }

  function _restoreObservation() {
    _bfcacheRestoreCount++;
    _bridgeMeta.bfcacheRestores = _bfcacheRestoreCount;
    logEvent('bfcacheRestore', { count: _bfcacheRestoreCount });

    PirateArcadeGameState.stopPolling();
    _stateObserver = null;
    _observerTarget = null;
    if (!_startMutationObserver()) {
      PirateArcadeGameState.startPolling();
    }
    _refreshAndNotify();
  }

  var PirateArcadeGameState = {
    getState: function () { return _gameState; },
    subscribe: function (cb) {
      if (_gameStateSubs.size >= 20) {
        console.warn('PirateArcadeGameState: subscriber limit reached (20)');
        return function () {};
      }
      _gameStateSubs.add(cb);
      return function () { _gameStateSubs.delete(cb); };
    },
    startPolling: function (intervalMs) {
      if (_gameStatePolling) return;
      if (_bridgeMeta.observerType === 'mutation' && _bridgeMeta.observerConnected) return;
      _gameStatePolling = true;
      if (intervalMs != null) POLL_INTERVAL = Math.min(intervalMs, MAX_POLL_INTERVAL);
      _pollingCycle();
    },
    stopPolling: function () {
      _gameStatePolling = false;
      if (_gameStateTimer) {
        clearTimeout(_gameStateTimer);
        _gameStateTimer = null;
      }
    },
    refresh: function () {
      _refreshAndNotify();
    },
    getMeta: function () {
      return {
        source: _bridgeMeta.source,
        lastUpdatedAt: _bridgeMeta.lastUpdatedAt,
        parseErrorCount: _bridgeMeta.parseErrorCount,
        stale: _bridgeMeta.stale,
        observerType: _bridgeMeta.observerType,
        observerConnected: _bridgeMeta.observerConnected,
        bfcacheRestores: _bridgeMeta.bfcacheRestores,
        mutationCount: _bridgeMeta.mutationCount,
        pollCycles: _bridgeMeta.pollCycles,
        rawReadCount: _bridgeMeta.rawReadCount,
        unchangedRawSkips: _bridgeMeta.unchangedRawSkips,
        parseCount: _bridgeMeta.parseCount,
        subscriberNotificationCount: _bridgeMeta.subscriberNotificationCount,
      };
    },
  };

  window.PirateArcadeGameState = PirateArcadeGameState;

  // ── Initialisation ──────────────────────────────────────────
  // Try MutationObserver first; fall back to bounded polling.
  // Listen for pageshow to restore observation after BFCache.
  (function () {
    function init() {
      var mo = _startMutationObserver();
      if (!mo) {
        PirateArcadeGameState.startPolling();
      }

      window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
          _restoreObservation();
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();

  // ── Game-state observer for active-play milestone ────────────
  (function () {
    var _observerStarted = false;
    var _activePlayMarked = false;
    var _pageHiding = false;

    var ACTIVE_PHASES = ['playing'];

    function isActivePhase(phase) {
      return phase && ACTIVE_PHASES.indexOf(phase) !== -1;
    }

    function startObserver() {
      if (_observerStarted) return;
      _observerStarted = true;

      var unsubscribe = PirateArcadeGameState.subscribe(function (state) {
        if (_pageHiding) return;
        if (!_activePlayMarked && state && isActivePhase(state.phase)) {
          _activePlayMarked = true;
          if (window.PirateArcadeMetrics) {
            window.PirateArcadeMetrics.markActivePlay();
          }
        }
      });

      window.addEventListener('pagehide', function () {
        _pageHiding = true;
        PirateArcadeGameState.stopPolling();
        unsubscribe();
      });

      // Re-subscribe after BFCache restore (pagehide + pageshow cycle)
      window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
          _pageHiding = false;
          _observerStarted = false;
          startObserver();
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserver);
    } else {
      startObserver();
    }
  })();

  // ── Per-game action semantics ────────────────────────────────
  function getControlMeta(name, fallback) {
    var wrap = document.getElementById('game-wrap');
    if (wrap && wrap.dataset && wrap.dataset[name] !== undefined) {
      return wrap.dataset[name];
    }
    return fallback;
  }

  var PirateArcadeActions = {
    getPrimaryKey: function () {
      return getControlMeta('controlActionKey', 'Enter');
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
      if (phase === 'game-over') return getControlMeta('controlGameoverLabel', 'PLAY AGAIN');
      if (phase === 'menu') return getControlMeta('controlMenuLabel', 'START');
      return getControlMeta('controlPlayLabel', 'ACTION');
    },
    updateButtonLabel: function () {
      var label = this.getLabel();
      var btn = document.querySelector('.btn-action[data-dir="action"]');
      if (btn) {
        btn.textContent = label;
        btn.setAttribute('aria-label', label);
      }
    },
  };

  window.PirateArcadeActions = PirateArcadeActions;
  logEvent('bridgeInit', {});
})();
