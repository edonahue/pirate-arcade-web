(function () {
  // Consolidated loading overlay API for Pygbag game shells.
  // Replaces the per-shell inline PirateArcadeLoading and the
  // override previously defined in pygame-input-bridge.js.
  //
  // This file must be loaded early (before pygbag pythons.js) so
  // the Python boot code can call PirateArcadeLoading.set/ready/error
  // immediately.

  // Lazy element lookups: the DOM may not be parsed yet when this
  // IIFE runs (loaded in <head>).  Grab the elements on first use.
  var _loadingEl = null;
  var _loadingDetail = null;
  var _booted = false;
  var _loadingWarnTimer = null;
  var _retryBtn = null;

  function _getEl() {
    if (!_loadingEl) _loadingEl = document.getElementById("game-loading");
    return _loadingEl;
  }
  function _getDetail() {
    if (!_loadingDetail)
      _loadingDetail = document.getElementById("game-loading-detail");
    return _loadingDetail;
  }

  function _startLoadingWarn() {
    _clearLoadingWarn();
    _loadingWarnTimer = setTimeout(function () {
      var el = _getEl();
      var note = el && el.querySelector(".loader-note");
      if (note)
        note.textContent =
          "Still working — first load takes a little while on iPad.";
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
  };
})();
