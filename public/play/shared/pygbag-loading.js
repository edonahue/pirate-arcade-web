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
  var _booted = false;
  var _loadingWarnTimer = null;
  var _retryBtn = null;
  var _errored = false;

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
      // Stable error: once errored, progress updates cannot overwrite
      if (_errored) return;
      var detail = _getDetail();
      var el = _getEl();
      if (detail) detail.textContent = msg;
      if (el) {
        el.classList.remove("hidden", "game-error");
      }
      _removeRetryBtn();
      _startLoadingWarn();
    },
    ready: function (msg) {
      // Stable error: once errored, ready cannot overwrite
      if (_errored) return;
      _booted = true;
      _clearLoadingWarn();
      _removeRetryBtn();
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
    },
    error: function (msg) {
      // Double-error guard: no-op if already in error state
      if (_errored) return;
      _errored = true;
      _clearLoadingWarn();
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
    },
    isReady: function () {
      return _booted;
    },
    // Ownership marker: identifies this as the canonical PirateArcade implementation
    __pirateArcadeOwned: true,
  };
})();
