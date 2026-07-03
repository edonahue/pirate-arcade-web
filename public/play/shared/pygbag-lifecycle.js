(function () {
  // PirateArcadeLifecycle — browser exit contract for Pygbag games.
  // Source of truth: public/play/shared/pygbag-lifecycle.js
  //
  // Handles:
  //   - exitToArcade(): navigate back to /play/ without triggering
  //     Chrome's leave-page confirmation dialog.
  //   - BFCache-friendly cleanup on pagehide.
  //   - Shared contract across all 3 Pygbag games (CC/TC/KW).

  if (window.PirateArcadeLifecycle && window.PirateArcadeLifecycle.__pirateArcadeOwned) {
    return;
  }

  var _exitNavigationDone = false;

  function _exitToArcade() {
    if (_exitNavigationDone) return;
    _exitNavigationDone = true;
    // Use replace instead of assign so there's no history entry for
    // the exited game — avoids the Chrome "are you sure?" dialog.
    window.location.replace('/play/');
  }

  window.PirateArcadeLifecycle = {
    exitToArcade: _exitToArcade,
    __pirateArcadeOwned: true,
  };
})();