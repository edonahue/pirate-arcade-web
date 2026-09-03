(function () {
  // PirateArcade Loading API — consolidated across all Pygbag shells.
  // Source of truth: public/play/shared/pygbag-loading.js
  // DO NOT define PirateArcadeLoading elsewhere (e.g., pygame-input-bridge.js).
  // This file must be loaded early (before pygbag pythons.js) so
  // the Python boot code can call PirateArcadeLoading.set/ready/error
  // immediately.
  //
  // Platform-neutral copy, no iPad-specific messaging.
  // Stable error state: once error() is called, set() cannot overwrite.
  // Idempotent: double-setup and double-error are no-ops.

  // Double-setup guard: if another script already defined it, do not replace.
  if (window.PirateArcadeLoading && window.PirateArcadeLoading.__pirateArcadeOwned) {
    return;
  }

  // Lazy element lookups: the DOM may not be parsed yet when this
  // IIFE runs (loaded in <head>).  Grab the elements on first use.
  var _loadingEl = null;
  var _loadingDetail = null;
  var _phase = "loading";   // "loading", "ready", "error", "disposed"
  var _lastMessage = "";
  var _loadingWarnTimer = null;
  var _retryBtn = null;
  // User-visible stage index (0-3). Advanced only by pa-boot-stage events
  // while _phase === "loading"; never regresses. Segments are positional
  // only — phase copy continues to come from set()/ready()/error().
  var _stageIdx = 0;

  // Boot stage -> user stage. Unknown stages return -1 (ignored).
  // pygame-install and archive-fetch overlap by design and share one label.
  function stageIndexForBootStage(stage) {
    switch (stage) {
      case "bootstrap":
      case "runtime-script-requested":
      case "runtime-script-loaded":
      case "python-ready":
        return 0;
      case "boot-start":
      case "pygame-install":
      case "archive-fetch":
      case "dependencies-ready":
        return 1;
      case "archive-extract":
      case "path-setup":
      case "pygame-import":
      case "display-init":
      case "game-module-import":
      case "game-constructor":
        return 2;
      case "game-ready":
      case "first-frame":
      case "loader-hidden":
      case "active-play":
        return 3;
      default:
        return -1;
    }
  }

  function _syncStageSegments() {
    var el = _getEl();
    if (!el) return;
    var spans = el.querySelectorAll(".loader-stage");
    for (var i = 0; i < spans.length; i++) {
      spans[i].classList.toggle("is-done", i < _stageIdx);
      spans[i].classList.toggle("is-current", i === _stageIdx);
    }
  }

  function _getEl() {
    if (!_loadingEl) {
      _loadingEl = document.getElementById("game-loading");
      // Verify element is attached to body (not head) for proper rendering
      if (_loadingEl && !document.body.contains(_loadingEl)) {
        _loadingEl = null;
      }
    }
    return _loadingEl;
  }
  function _getDetail() {
    if (!_loadingDetail) {
      _loadingDetail = document.getElementById("game-loading-detail");
      if (_loadingDetail && !document.body.contains(_loadingDetail)) {
        _loadingDetail = null;
      }
    }
    return _loadingDetail;
  }

  function _startLoadingWarn() {
    _clearLoadingWarn();
    _loadingWarnTimer = setTimeout(function () {
      var el = _getEl();
      var note = el && el.querySelector(".loader-note");
      if (note)
        note.textContent = "Still working — first load takes a little while.";
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
    _retryBtn = document.createElement("button");
    _retryBtn.textContent = "Try Again";
    _retryBtn.className = "loading-retry-btn";
    _retryBtn.addEventListener("click", function () {
      window.location.reload();
    });
    var el = _getEl();
    if (el) el.appendChild(_retryBtn);
  }

  window.PirateArcadeLoading = {
    set: function (msg) {
      if (this.__pirateArcadeOwned && window.PirateArcadeLoading === this) {
        if (_phase === "loading") {
          _lastMessage = msg;
          var detail = _getDetail();
          var el = _getEl();
          if (detail) detail.textContent = msg;
          if (el) {
            el.classList.remove("hidden", "game-error");
            el.setAttribute("aria-hidden", "false");
          }
          _removeRetryBtn();
          _startLoadingWarn();
        }
        // If in ready, error, or disposed, do nothing
      }
    },
    ready: function (msg) {
      if (this.__pirateArcadeOwned && window.PirateArcadeLoading === this) {
        if (_phase === "loading") {
          _phase = "ready";
          _lastMessage = msg;
          var detail = _getDetail();
          var el = _getEl();
          if (msg && detail) detail.textContent = msg;
          if (el) {
            el.classList.add("hidden");
            el.setAttribute("aria-hidden", "true");
            if (window.PirateArcadeMetrics) {
              window.PirateArcadeMetrics.mark("loader-hidden");
              window.PirateArcadeMetrics.computeDurations();
            }
          }
          _removeRetryBtn();
          _clearLoadingWarn();
        }
        // If in ready, error, or disposed, do nothing
      }
    },
error: function(msg) {
      if (this.__pirateArcadeOwned && window.PirateArcadeLoading === this) {
        if (_phase === "loading" || _phase === "ready") {
          _phase = "error";
          _lastMessage = msg;
          var detail = _getDetail();
          var el = _getEl();
          if (detail) detail.textContent = msg;
          if (el) {
            el.classList.remove("hidden");
            el.classList.add("game-error");
            el.setAttribute("aria-hidden", "false");
          }
          document.body.classList.add("game-error");
          if (window.PirateArcadeInput) {
            window.PirateArcadeInput.releaseAll("error");
          }
          _showRetryBtn();
          _clearLoadingWarn();
        }
        // If in error or disposed, do nothing
      }
    },
    dispose: function (reason) {
      if (this.__pirateArcadeOwned && window.PirateArcadeLoading === this) {
        _phase = "disposed";
        _clearLoadingWarn();
        _removeRetryBtn();
        var el = _getEl();
        if (el) {
          el.classList.add("hidden");
          el.setAttribute("aria-hidden", "true");
        }
        // Note: we do not remove the game-error class from body here.
        // The body class is added by the error method and is intended to persist.
        // If we are disposing from an error state, the body class remains.
        // If we are disposing from loading or ready, there is no body class to remove.
      }
    },
    // React to authoritative boot-stage changes without keeping an
    // independent boot-state machine. Frozen once loading ends or errors.
    onBootStage: function (stage) {
      if (_phase !== "loading") return;
      var idx = stageIndexForBootStage(stage);
      if (idx < 0 || idx <= _stageIdx) return;
      _stageIdx = idx;
      _syncStageSegments();
    },
    isReady: function () {
      return _phase === "ready";
    },
    getState: function () {
      var el = document.getElementById("game-loading");
      return {
        phase: _phase,
        stage: _stageIdx,
        message: _lastMessage,
        ready: (_phase === "ready"),
        errored: (_phase === "error"),
        disposed: (_phase === "disposed"),
        elementPresent: !!(el && document.body.contains(el)),
        elementVisible: !!(el && document.body.contains(el) && !el.classList.contains('hidden'))
      };
    },
    // Ownership marker: identifies this as the canonical PirateArcade implementation
    __pirateArcadeOwned: true
  };

  // Single consumer of the pa-boot-stage bridge. Registered once: the
  // double-setup guard above returns early on repeat evaluation.
  if (typeof window.addEventListener === "function") {
    window.addEventListener("pa-boot-stage", function (event) {
      var api = window.PirateArcadeLoading;
      var stage =
        event && event.detail ? event.detail.stage : undefined;
      if (
        api &&
        api.__pirateArcadeOwned &&
        typeof api.onBootStage === "function"
      ) {
        api.onBootStage(stage);
      }
    });
  }
})();
