(function () {
  // Boot performance metrics collector.
  //
  // Three distinct canonical stores (never mixed):
  //   marks      – timestamp numbers only (performance.now)
  //   durations  – duration numbers only (end - start)
  //   flags      – Boolean state
  //
  // Compatibility window.__paBootMetrics mirrors all values in a flat
  // structure for legacy consumers (marks/durations as named keys, flags
  // as __paBootMetrics.flags).  It is a generated view, never an
  // independent mutable store.
  //
  // snapshot() returns the canonical three-store shape (schema v2).
  // get() returns only durations.
  //

  var marks = {};
  var durations = {};
  var flags = { activePlay: false, firstUserInput: false };
  var markOnceRecorded = {};
  var bootMetrics = {}; // flat mirror
  var _ownedNames = {}; // performance.mark/measure names created by PA

  function writeFlat(name, value) {
    bootMetrics[name] = value;
    window.__paBootMetrics = bootMetrics;
  }

  function writeFlags() {
    bootMetrics.flags = {
      activePlay: !!flags.activePlay,
      firstUserInput: !!flags.firstUserInput,
    };
    window.__paBootMetrics = bootMetrics;
  }

  window.PirateArcadeMetrics = {
    mark: function (name) {
      var now = performance.now();
      marks[name] = now;
      writeFlat(name, now);
      try {
        performance.mark(name);
        _ownedNames[name] = true;
      } catch (e) {
        /* ignore */
      }
    },

    // Idempotent mark: records timestamp only on first call.
    markOnce: function (name) {
      if (!markOnceRecorded[name]) {
        markOnceRecorded[name] = true;
        this.mark(name);
      }
      return marks[name];
    },

    measure: function (name, startMark, endMark) {
      var start = marks[startMark];
      var end = marks[endMark];
      if (typeof start === "number" && typeof end === "number") {
        var result = end - start;
        durations[name] = result;
        writeFlat(name, result);
        try {
          performance.measure(name, startMark, endMark);
          _ownedNames[name] = true;
        } catch (e) {
          /* ignore */
        }
        return result;
      }
      return undefined;
    },

    get: function () {
      return Object.assign({}, durations);
    },

    clear: function () {
      marks = {};
      durations = {};
      flags = { activePlay: false, firstUserInput: false };
      markOnceRecorded = {};
      bootMetrics = {};
      window.__paBootMetrics = bootMetrics;
      try {
        for (var n in _ownedNames) {
          if (_ownedNames.hasOwnProperty(n)) {
            performance.clearMarks(n);
            performance.clearMeasures(n);
          }
        }
        _ownedNames = {};
      } catch (e) {
        /* ignore */
      }
    },

    getMarks: function () {
      return Object.assign({}, marks);
    },

    snapshot: function () {
      return {
        schemaVersion: 2,
        marks: Object.assign({}, marks),
        durations: Object.assign({}, durations),
        flags: {
          activePlay: !!flags.activePlay,
          firstUserInput: !!flags.firstUserInput,
        },
        context: {
          url: window.location.href,
          serviceWorkerControlled: navigator.serviceWorker?.controller
            ? true
            : false,
        },
      };
    },

    computeDurations: function () {
      var m = marks;
      if (m["python-ready"] && m["page-script-start"]) {
        this.measure(
          "total-to-python-ready",
          "page-script-start",
          "python-ready",
        );
      }
      if (m["pygame-install-end"] && m["pygame-install-start"]) {
        this.measure(
          "pygame-install-duration",
          "pygame-install-start",
          "pygame-install-end",
        );
      }
      if (m["archive-fetch-end"] && m["archive-fetch-start"]) {
        this.measure(
          "archive-fetch-duration",
          "archive-fetch-start",
          "archive-fetch-end",
        );
      }
      if (m["archive-extract-end"] && m["archive-extract-start"]) {
        this.measure(
          "archive-extract-duration",
          "archive-extract-start",
          "archive-extract-end",
        );
      }
      if (m["display-init-end"] && m["display-init-start"]) {
        this.measure(
          "display-init-duration",
          "display-init-start",
          "display-init-end",
        );
      }
      if (m["game-ready"] && m["page-script-start"]) {
        this.measure("total-to-game-ready", "page-script-start", "game-ready");
      }
      if (m["loader-hidden"] && m["page-script-start"]) {
        this.measure(
          "total-to-loader-hidden",
          "page-script-start",
          "loader-hidden",
        );
      }
    },

    // markPlayable derives from active-play (compatibility).
    markPlayable: function () {
      this.markActivePlay();
    },

    isPlayable: function () {
      return !!flags.activePlay;
    },

    markActivePlay: function () {
      if (!flags.activePlay) {
        flags.activePlay = true;
        writeFlags();
        this.markOnce("active-play");
      }
    },

    markFirstUserInput: function () {
      if (!flags.firstUserInput) {
        flags.firstUserInput = true;
        writeFlags();
        this.markOnce("first-user-input");
      }
    },
  };

  // Mark page script start immediately
  window.PirateArcadeMetrics.mark("page-script-start");

  // Debug signal: set window.__paServiceWorkerReady when the SW is active
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", function (event) {
        if (event.data && event.data.type === "SW_ACTIVATED") {
          window.__paServiceWorkerReady = true;
        }
      });
      navigator.serviceWorker.ready.then(function () {
        window.__paServiceWorkerReady = true;
      });
    }
  } catch (e) {
    /* SW API not available */
  }
})();
