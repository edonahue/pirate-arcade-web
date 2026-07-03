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
    error: function (msg) {
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
          }
          document.body.classList.add("game-error");
          if (window.PirateArcadeInput) {
            window.PirateArcadeInput.releaseAll("error");
          }
          _showRetryBtn();
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
        }
        // Note: we do not remove the game-error class from body here.
        // The body class is added by the error method and is intended to persist.
        // If we are disposing from an error state, the body class remains.
        // If we are disposing from loading or ready, there is no body class to remove.
      }
    },
    isReady: function () {
      return _phase === "ready";
    },
    getState: function () {
      var el = _getEl();
      return {
        phase: _phase,
        message: _lastMessage,
        ready: (_phase === "ready"),
        errored: (_phase === "error"),
        disposed: (_phase === "disposed"),
        elementPresent: !!el,
        elementVisible: !(el && el.classList.contains('hidden'))
      };
    },
    // Ownership marker: identifies this as the canonical PirateArcade implementation
    __pirateArcadeOwned: true
  };
})();
