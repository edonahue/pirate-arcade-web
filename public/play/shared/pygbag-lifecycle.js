// PirateArcadeLifecycle - Shared API for lifecycle management
// Provides centralized cleanup, exit handling, and state tracking
(function () {
  'use strict';

  // Internal state
  var _disposers = [];
  var _visibilityChangeHandler = null;
  var _isInitialized = false;
  var _visibilityChangeCount = 0;
  var _pagehideCount = 0;
  var _pageshowCount = 0;
  var _intentionalExit = false;
  var _exitReason = null;
  var _navigationStarted = false;
  var _disposalErrorCount = 0;

  // Initialize the lifecycle manager
  function _init() {
    if (_isInitialized) {
      return;
    }
    
    // Set up visibility change handler for diagnostics only (not automatic disposal)
    _visibilityChangeHandler = function () {
      if (document.hidden) {
        _visibilityChangeCount++;
        // Track visibility changes for diagnostics, but don't auto-dispose
        // This prevents breaking tab switching and BFCache
      } else {
        _pageshowCount++;
      }
    };
    
    document.addEventListener('visibilitychange', _visibilityChangeHandler, false);
    
    // Set up pagehide/pageshow events for better lifecycle tracking
    window.addEventListener('pagehide', function () {
      _pagehideCount++;
      // Note: We don't automatically dispose on pagehere to preserve BFCache
      // Disposal should only happen on explicit exit
    });
    
    window.addEventListener('pageshow', function () {
      _pageshowCount++;
    });
    
    _isInitialized = true;
  }

  // Add a disposer function to be called when dispose() is invoked
  function addDisposer(disposerFn) {
    if (typeof disposerFn === 'function') {
      _disposers.push(disposerFn);
    }
  }

  // Remove a disposer function
  function removeDisposer(disposerFn) {
    _disposers = _disposers.filter(function (fn) {
      return fn !== disposerFn;
    });
  }

  // Dispose of all resources
  function dispose() {
    // Only dispose if not already disposed
    if (_disposers.length === 0 && !_isInitialized) {
      return;
    }
    
    // Call all disposers in reverse order (LIFO)
    for (var i = _disposers.length - 1; i >= 0; i--) {
      try {
        _disposers[i]();
      } catch (e) {
        _disposalErrorCount++;
        console.error('Error in disposer function:', e);
      }
    }
    _disposers = [];
    
    // Remove event listeners
    if (_visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', _visibilityChangeHandler);
      _visibilityChangeHandler = null;
    }
    
    _isInitialized = false;
  }

  // Exit to the arcade hub
  function exitToArcade(reason) {
    _intentionalExit = true;
    _exitReason = reason || 'user-initiated';
    _navigationStarted = true;
    
    // First dispose of any resources
    dispose();
    
    // Then navigate to the arcade hub
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign('/play/');
    }
  }

  // Get current lifecycle state
  function getState() {
    var el = null;
    try {
      el = document.getElementById("game-loading");
    } catch (e) {
      // Element might not exist, that's OK
    }
    
    return {
      phase: _disposers.length > 0 ? "disposed" : (_isInitialized ? "initialized" : "uninitialized"),
      disposed: _disposers.length === 0 && !_isInitialized,
      disposing: false, // We don't track disposing state in this implementation
      intentionalExit: _intentionalExit,
      exitReason: _exitReason,
      navigationStarted: _navigationStarted,
      disposerCount: _disposers.length,
      disposalErrorCount: _disposalErrorCount,
      visibilityChangeCount: _visibilityChangeCount,
      pagehideCount: _pagehideCount,
      pageshowCount: _pageshowCount,
      elementPresent: !!el,
      elementVisible: !!(el && !el.classList.contains('hidden'))
    };
  }

  // Public API
  window.PirateArcadeLifecycle = {
    init: _init,
    addDisposer: addDisposer,
    removeDisposer: removeDisposer,
    dispose: dispose,
    exitToArcade: exitToArcade,
    getState: getState,
    // Ownership marker
    __pirateArcadeOwned: true
  };
  
  // Auto-initialize
  _init();
})();