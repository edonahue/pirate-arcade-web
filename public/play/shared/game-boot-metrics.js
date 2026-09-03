(function () {
  // Boot performance metrics collector v3.
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
  // snapshot() returns the canonical three-store shape (schema v3).

  var marks = {};
  var durations = {};
  var flags = { activePlay: false, firstUserInput: false };
  var markOnceRecorded = {};
  var bootMetrics = {}; // flat mirror
  var _ownedNames = {}; // performance.mark/measure names created by PA
  var _bootStage = "bootstrap";
  var _failedStage = null;
  var _firstFramePresented = false;
  var _archiveUrl = null;
  var _archiveByteLength = null;
  var _runtimeScriptUrl = null;
  var _longTaskObserver = null;
  var _longTaskSummary = { count: 0, totalDuration: 0, maxDuration: 0, bootCount: 0, earlyCount: 0 };

  // ── Boot stage enum ─────────────────────────────────────────
  var BOOT_STAGES = {
    BOOTSTRAP: "bootstrap",
    RUNTIME_SCRIPT_REQUESTED: "runtime-script-requested",
    RUNTIME_SCRIPT_LOADED: "runtime-script-loaded",
    PYTHON_READY: "python-ready",
    BOOT_START: "boot-start",
    PYGAME_INSTALL: "pygame-install",
    ARCHIVE_FETCH: "archive-fetch",
    DEPENDENCIES_READY: "dependencies-ready",
    ARCHIVE_EXTRACT: "archive-extract",
    PATH_SETUP: "path-setup",
    PYGAME_IMPORT: "pygame-import",
    DISPLAY_INIT: "display-init",
    GAME_MODULE_IMPORT: "game-module-import",
    GAME_CONSTRUCTOR: "game-constructor",
    GAME_READY: "game-ready",
    FIRST_FRAME: "first-frame",
    LOADER_HIDDEN: "loader-hidden",
    ACTIVE_PLAY: "active-play",
  };

  // ── Failure stage names ──────────────────────────────────────
  var FAILURE_STAGES = {
    RUNTIME_SCRIPT: "runtime-script",
    PYTHON_READY_TIMEOUT: "python-ready-timeout",
    CROSS_FILE_TIMEOUT: "cross-file-timeout",
    PYGAME_INSTALL: "pygame-install",
    ARCHIVE_FETCH: "archive-fetch",
    ARCHIVE_EXTRACT: "archive-extract",
    PATH_SETUP: "path-setup",
    PYGAME_IMPORT: "pygame-import",
    DISPLAY_INIT: "display-init",
    GAME_MODULE_IMPORT: "game-module-import",
    GAME_CONSTRUCTION: "game-construction",
    FIRST_FRAME_TIMEOUT: "first-frame-timeout",
    GAME_LOOP: "game-loop",
  };

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

  function writeStageContext() {
    bootMetrics.bootStage = _bootStage;
    bootMetrics.failedStage = _failedStage;
    bootMetrics.firstFramePresented = _firstFramePresented;
    bootMetrics.archiveUrl = _archiveUrl;
    bootMetrics.archiveByteLength = _archiveByteLength;
    bootMetrics.runtimeScriptUrl = _runtimeScriptUrl;
    bootMetrics.longTaskSummary = {
      count: _longTaskSummary.count,
      totalDuration: _longTaskSummary.totalDuration,
      maxDuration: _longTaskSummary.maxDuration,
    };
    window.__paBootMetrics = bootMetrics;
  }

  // ── Long task observer ──────────────────────────────────────
  function startLongTaskObserver() {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      _longTaskObserver = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          var dur = e.duration;
          _longTaskSummary.count++;
          _longTaskSummary.totalDuration += dur;
          if (dur > _longTaskSummary.maxDuration) {
            _longTaskSummary.maxDuration = dur;
          }
          // Classify by boot phase
          if (_bootStage !== "first-frame" && _bootStage !== "loader-hidden" && _bootStage !== "active-play") {
            _longTaskSummary.bootCount++;
          } else if (!flags.activePlay) {
            _longTaskSummary.earlyCount++;
          }
          writeStageContext();
        }
      });
      _longTaskObserver.observe({ type: "longtask", buffered: false });
    } catch (e) {
      // API not supported
    }
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
      _bootStage = "bootstrap";
      _failedStage = null;
      _firstFramePresented = false;
      _archiveUrl = null;
      _archiveByteLength = null;
      _runtimeScriptUrl = null;
      _longTaskSummary = { count: 0, totalDuration: 0, maxDuration: 0, bootCount: 0, earlyCount: 0 };
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
        schemaVersion: 3,
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
          bootStage: _bootStage,
          failedStage: _failedStage,
          firstFramePresented: _firstFramePresented,
          archiveUrl: _archiveUrl,
          archiveByteLength: _archiveByteLength,
          runtimeScriptUrl: _runtimeScriptUrl,
          longTaskSummary: {
            count: _longTaskSummary.count,
            totalDuration: _longTaskSummary.totalDuration,
            maxDuration: _longTaskSummary.maxDuration,
          },
        },
      };
    },

    computeDurations: function () {
      var m = marks;
      if (m["runtime-script-loaded"] && m["runtime-script-requested"]) {
        this.measure("runtime-script-duration", "runtime-script-requested", "runtime-script-loaded");
      }
      if (m["python-ready"] && m["page-script-start"]) {
        this.measure("total-to-python-ready", "page-script-start", "python-ready");
      }
      if (m["pygame-install-end"] && m["pygame-install-start"]) {
        this.measure("pygame-install-duration", "pygame-install-start", "pygame-install-end");
      }
      if (m["archive-fetch-end"] && m["archive-fetch-start"]) {
        this.measure("archive-fetch-duration", "archive-fetch-start", "archive-fetch-end");
      }
      if (m["dependencies-ready"] && m["boot-start"]) {
        this.measure("dependency-overlap-duration", "boot-start", "dependencies-ready");
      }
      if (m["archive-extract-end"] && m["archive-extract-start"]) {
        this.measure("archive-extract-duration", "archive-extract-start", "archive-extract-end");
      }
      if (m["pygame-import-end"] && m["pygame-import-start"]) {
        this.measure("pygame-import-duration", "pygame-import-start", "pygame-import-end");
      }
      if (m["display-init-end"] && m["display-init-start"]) {
        this.measure("display-init-duration", "display-init-start", "display-init-end");
      }
      if (m["game-module-import-end"] && m["game-module-import-start"]) {
        this.measure("game-module-import-duration", "game-module-import-start", "game-module-import-end");
      }
      if (m["game-constructor-end"] && m["game-constructor-start"]) {
        this.measure("game-constructor-duration", "game-constructor-start", "game-constructor-end");
      }
      if (m["game-ready"] && m["page-script-start"]) {
        this.measure("total-to-game-ready", "page-script-start", "game-ready");
      }
      if (m["first-frame-presented"] && m["page-script-start"]) {
        this.measure("total-to-first-frame", "page-script-start", "first-frame-presented");
      }
      if (m["loader-hidden"] && m["page-script-start"]) {
        this.measure("total-to-loader-hidden", "page-script-start", "loader-hidden");
      }
      if (m["first-frame-presented"] && m["game-ready"]) {
        this.measure("game-ready-to-first-frame", "game-ready", "first-frame-presented");
      }
      if (m["loader-hidden"] && m["first-frame-presented"]) {
        this.measure("first-frame-to-loader-hidden", "first-frame-presented", "loader-hidden");
      }
      if (m["first-user-input"] && m["first-frame-presented"]) {
        this.measure("first-frame-to-first-input", "first-frame-presented", "first-user-input");
      }
      if (m["active-play"] && m["first-user-input"]) {
        this.measure("first-input-to-active-play", "first-user-input", "active-play");
      }
    },

    // ── Boot stage management ──────────────────────────────────
    // setBootStage() is the single source of truth for boot progress.
    // It also notifies UI listeners (e.g. the loading overlay) via a
    // narrow "pa-boot-stage" CustomEvent carrying { stage }. This is a
    // one-event bridge for a single consumer, not a general observable.
    setBootStage: function (stage) {
      _bootStage = stage;
      writeStageContext();
      try {
        if (
          typeof window.dispatchEvent === "function" &&
          typeof window.CustomEvent === "function"
        ) {
          window.dispatchEvent(
            new window.CustomEvent("pa-boot-stage", {
              detail: { stage: stage },
            }),
          );
        }
      } catch (e) {
        /* never break boot telemetry on event delivery */
      }
    },

    getBootStage: function () {
      return _bootStage;
    },

    setFailedStage: function (stage, errorMessage) {
      _failedStage = stage;
      if (errorMessage) {
        bootMetrics.failedError = errorMessage;
      }
      writeStageContext();
    },

    getFailedStage: function () {
      return _failedStage;
    },

    setArchiveUrl: function (url) {
      _archiveUrl = url;
      writeStageContext();
    },

    setArchiveByteLength: function (bytes) {
      _archiveByteLength = bytes;
      writeStageContext();
    },

    setRuntimeScriptUrl: function (url) {
      _runtimeScriptUrl = url;
      writeStageContext();
    },

    markFirstFramePresented: function () {
      if (!_firstFramePresented) {
        _firstFramePresented = true;
        this.mark("first-frame-presented");
        writeStageContext();
      }
    },

    hasFirstFrame: function () {
      return _firstFramePresented;
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
        this.setBootStage(BOOT_STAGES.ACTIVE_PLAY);
      }
    },

    markFirstUserInput: function () {
      if (!flags.firstUserInput) {
        flags.firstUserInput = true;
        writeFlags();
        this.markOnce("first-user-input");
      }
    },

    // Export BOOT_STAGES so Python boot code can use them
    BOOT_STAGES: BOOT_STAGES,
    FAILURE_STAGES: FAILURE_STAGES,
  };

  // Mark page script start immediately
  window.PirateArcadeMetrics.mark("page-script-start");
  window.PirateArcadeMetrics.setBootStage(BOOT_STAGES.BOOTSTRAP);

  // Start long task observer early
  startLongTaskObserver();

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
