// PirateArcadeLifecycle - Shared API for lifecycle management
// Provides centralized cleanup, exit handling, and state tracking
(function () {
  'use strict';

  // Internal state
  var _disposers = [];
  var _visibilityChangeHandler = null;
  var _isInitialized = false;

  // Initialize the lifecycle manager
  function _init() {
    if (_isInitialized) {
      return;
    }
    
    // Set up visibility change handler for automatic cleanup
    _visibilityChangeHandler = function () {
      if (document.hidden) {
        // Page is hidden, dispose of resources
        dispose();
      }
    };
    
    document.addEventListener('visibilitychange', _visibilityChangeHandler, false);
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
    // Call all disposers in reverse order (LIFO)
    for (var i = _disposers.length - 1; i >= 0; i--) {
      try {
        _disposers[i]();
      } catch (e) {
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
  function exitToArcade() {
    // First dispose of any resources
    dispose();
    // Then navigate to the arcade hub
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign('/play/');
    }
  }

  // Get current lifecycle state
  function getState() {
    return {
      disposersCount: _disposers.length,
      isInitialized: _isInitialized,
      hasVisibilityHandler: !!_visibilityChangeHandler
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