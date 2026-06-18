(function () {
  // Boot performance metrics collector
  // Exposes window.PirateArcadeMetrics with mark/measure/get API.
  // Supports both performance.mark/measure (when available) and a
  // plain JSON object for Playwright test access via window.__paBootMetrics.
  //
  // Readiness milestones (distinct, truthful):
  // - game-ready        : Python boot completed; game object exists; menu may still show.
  // - loader-hidden     : Loading overlay gone; game can be viewed/interacted; menu may show.
  // - active-play       : Game-state bridge confirms real gameplay phase (not loading/menu).
  //                       Marked ONCE when state transitions to a verified active phase.
  // - first-user-input  : First meaningful keyboard/touch input accepted by Python bridge.
  //                       Marked ONCE on successful bridge call (key-down or touch target).
  //
  // Boolean playable is retained ONLY as a compatibility convenience
  // derived from active-play having occurred.

  var marks = {};
  var measures = {};
  var flags = { activePlay: false, firstUserInput: false };
  var markOnceRecorded = {};

  function setMetric(name, value) {
    measures[name] = value;
    if (window.__paBootMetrics) {
      window.__paBootMetrics[name] = value;
    } else {
      window.__paBootMetrics = { [name]: value };
    }
  }

  function setFlag(name, value) {
    flags[name] = value;
    if (window.__paBootMetrics) {
      window.__paBootMetrics['flags'] = Object.assign({}, flags);
    }
  }

  window.PirateArcadeMetrics = {
    mark: function (name) {
      var now = performance.now();
      marks[name] = now;
      setMetric(name, now);
      try { performance.mark(name); } catch (e) { /* ignore */ }
    },

    // Idempotent mark: records timestamp only on first call.
    // Use for milestones that must not be overwritten (active-play, first-user-input).
    markOnce: function (name) {
      if (!markOnceRecorded[name]) {
        markOnceRecorded[name] = true;
        this.mark(name);
      }
      return marks[name];
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
      flags = { activePlay: false, firstUserInput: false };
      markOnceRecorded = {};
      window.__paBootMetrics = { flags: { activePlay: false, firstUserInput: false } };
    },

    getMarks: function () {
      return Object.assign({}, marks);
    },

    // Snapshot API: stable, JSON-serializable payload for reporting.
    // Does NOT mix Booleans into Record<string, number>.
    snapshot: function () {
      return {
        schemaVersion: 1,
        marks: Object.assign({}, marks),
        durations: Object.assign({}, measures),
        flags: Object.assign({}, flags),
        context: {
          url: window.location.href,
          serviceWorkerControlled: navigator.serviceWorker?.controller ? true : false
        }
      };
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

    // Compatibility: markPlayable sets playable=true (derived from active-play).
    markPlayable: function () {
      if (!measures.playable) {
        setMetric('playable', true);
      }
    },

    isPlayable: function () {
      return !!measures.playable;
    },

    // New: mark active-play once when game-state confirms active gameplay.
    markActivePlay: function () {
      if (!flags.activePlay) {
        setFlag('activePlay', true);
        this.markOnce('active-play');
      }
    },

    // New: mark first-user-input once on accepted input.
    markFirstUserInput: function () {
      if (!flags.firstUserInput) {
        setFlag('firstUserInput', true);
        this.markOnce('first-user-input');
      }
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