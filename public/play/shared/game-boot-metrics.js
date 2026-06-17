(function () {
  // Boot performance metrics collector
  // Exposes window.PirateArcadeMetrics with mark/measure/get API.
  // Supports both performance.mark/measure (when available) and a
  // plain JSON object for Playwright test access via window.__paBootMetrics.
  var marks = {};
  var measures = {};

  function setMetric(name, value) {
    measures[name] = value;
    if (window.__paBootMetrics) {
      window.__paBootMetrics[name] = value;
    } else {
      window.__paBootMetrics = { [name]: value };
    }
  }

  window.PirateArcadeMetrics = {
    mark: function (name) {
      var now = performance.now();
      marks[name] = now;
      setMetric(name, now);
      try { performance.mark(name); } catch (e) { /* ignore */ }
    },

    measure: function (name, startMark, endMark) {
      var start = marks[startMark] || 0;
      var end = marks[endMark] || 0;
      if (start > 0 && end > 0) {
        var result = end - start;
        setMetric(name, result);
        try {
          performance.measure(name, startMark, endMark);
        } catch (e) { /* ignore */ }
        return result;
      }
      return undefined;
    },

    get: function () {
      return Object.assign({}, measures);
    },

    clear: function () {
      marks = {};
      measures = {};
      window.__paBootMetrics = {};
    },

    getMarks: function () {
      return Object.assign({}, marks);
    },

    // Compute all standard duration metrics from existing marks
    computeDurations: function () {
      var m = marks;
      if (m['python-ready'] && m['page-script-start']) {
        setMetric('total-to-python-ready', m['python-ready'] - m['page-script-start']);
      }
      if (m['pygame-install-end'] && m['pygame-install-start']) {
        setMetric('pygame-install-duration', m['pygame-install-end'] - m['pygame-install-start']);
      }
      if (m['archive-fetch-end'] && m['archive-fetch-start']) {
        setMetric('archive-fetch-duration', m['archive-fetch-end'] - m['archive-fetch-start']);
      }
      if (m['archive-extract-end'] && m['archive-extract-start']) {
        setMetric('archive-extract-duration', m['archive-extract-end'] - m['archive-extract-start']);
      }
      if (m['display-init-end'] && m['display-init-start']) {
        setMetric('display-init-duration', m['display-init-end'] - m['display-init-start']);
      }
      if (m['game-ready'] && m['page-script-start']) {
        setMetric('total-to-game-ready', m['game-ready'] - m['page-script-start']);
      }
      if (m['loader-hidden'] && m['page-script-start']) {
        setMetric('total-to-loader-hidden', m['loader-hidden'] - m['page-script-start']);
      }
    },

    // Playable-readiness flag: true when loader is hidden AND game state
    // indicates the game is running (not loading/menu). Set by loading API
    // after ready() + input bridge confirmation.
    markPlayable: function () {
      if (!measures.playable) {
        setMetric('playable', true);
      }
    },

    isPlayable: function () {
      return !!measures.playable;
    }
  };

  // Mark page script start immediately
  window.PirateArcadeMetrics.mark('page-script-start');

  // Debug signal: set window.__paServiceWorkerReady when the SW is active
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'SW_ACTIVATED') {
          window.__paServiceWorkerReady = true;
        }
      });
      navigator.serviceWorker.ready.then(function () {
        window.__paServiceWorkerReady = true;
      });
    }
  } catch (e) { /* SW API not available */ }
})();
