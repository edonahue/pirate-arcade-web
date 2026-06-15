// Debug Panel - Shared implementation for all Pygbag game shells
// Activates via ?debug=1 or ?debugPanel=1

(function () {
  var debugParam = new URLSearchParams(window.location.search);
  var debugEnabled = debugParam.has('debug') || debugParam.has('debugPanel');
  if (!debugEnabled) return;

  if (window.__paDebugPanelInitialized) return;
  window.__paDebugPanelInitialized = true;

  var panel = document.createElement('div');
  panel.id = 'pa-debug-panel';
  panel.style.cssText = 'position:fixed;bottom:0;right:0;width:400px;max-height:50vh;background:#0a0e17;border:1px solid #2a3142;border-radius:8px 0 0 0;padding:12px;font-family:monospace;font-size:11px;color:#b8c4d4;z-index:999999;overflow:auto;box-shadow:0 -4px 24px rgba(0,0,0,0.6);';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #2a3142;';
  header.innerHTML = '<strong style="color:#d4a843;">Debug Panel</strong><button id="pa-debug-close" style="background:none;border:1px solid #2a3142;color:#8a9ab0;padding:2px 8px;border-radius:4px;cursor:pointer;font-family:inherit;">Close</button>';
  panel.appendChild(header);

  var tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;';
  tabs.innerHTML = '<button class="pa-debug-tab active" data-tab="input" style="background:#1e2433;border:1px solid #2a3142;color:#d4a843;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;">Input Bridge</button><button class="pa-debug-tab" data-tab="python" style="background:#1e2433;border:1px solid #2a3142;color:#8a9ab0;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;">Python Bridge</button><button class="pa-debug-tab" data-tab="game" style="background:#1e2433;border:1px solid #2a3142;color:#8a9ab0;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;">Game State</button><button class="pa-debug-tab" data-tab="metrics" style="background:#1e2433;border:1px solid #2a3142;color:#8a9ab0;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;">Boot Metrics</button><button class="pa-debug-tab" data-tab="actions" style="background:#1e2433;border:1px solid #2a3142;color:#8a9ab0;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;">Actions</button>';
  panel.appendChild(tabs);

  var content = document.createElement('div');
  content.id = 'pa-debug-content';
  content.style.cssText = 'white-space:pre-wrap;word-break:break-word;line-height:1.5;';
  panel.appendChild(content);

  document.body.appendChild(panel);

  var refreshInterval = null;

  function formatTime(ts) {
    var d = new Date(ts);
    return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function switchTab(tabName) {
    tabs.querySelectorAll('.pa-debug-tab').forEach(function (btn) {
      btn.style.background = '#1e2433';
      btn.style.color = '#8a9ab0';
      btn.classList.remove('active');
    });
    var activeBtn = tabs.querySelector('.pa-debug-tab[data-tab="' + tabName + '"]');
    if (activeBtn) {
      activeBtn.style.background = '#2a3142';
      activeBtn.style.color = '#d4a843';
      activeBtn.classList.add('active');
    }
    renderTab(tabName);
  }

  // Make destroyPanel globally accessible for tests
  window.destroyDebugPanel = destroyPanel;

  tabs.querySelectorAll('.pa-debug-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.tab);
    });
  });

  document.getElementById('pa-debug-close').addEventListener('click', function () {
    destroyPanel();
  });

  function destroyPanel() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    panel.remove();
    window.__paDebugPanelInitialized = false;
  }

  function renderTab(tab) {
    var dbg = window.__paInputDebug;
    var input = window.PirateArcadeInput;
    var gameState = window.PirateArcadeGameState;
    var metrics = window.__paBootMetrics;
    var actions = window.PirateArcadeActions;
    var html = '';

    if (tab === 'input') {
      if (!dbg) {
        html = 'No debug log available';
      } else {
        var events = dbg.events.slice(-20).map(function (e) {
          return formatTime(e.ts) + ' [' + e.tag + '] ' + JSON.stringify(e.data);
        }).join('\n');
        var bridges = dbg.bridgeCalls.slice(-10).map(function (b) {
          return formatTime(b.ts) + ' [bridge] ' + b.key + ' ' + (b.down ? 'DOWN' : 'UP') + ' ' + (b.ok ? 'OK' : 'FAIL');
        }).join('\n');
        var dom = dbg.domEvents.slice(-10).map(function (d) {
          return formatTime(d.ts) + ' [dom] ' + d.key + ' ' + d.type + ' ' + d.target;
        }).join('\n');
        var state = input?.getState?.();
        html = '=== INPUT STATE ===\n' + JSON.stringify(state, null, 2) + '\n\n=== EVENTS (last 20) ===\n' + (events || '(none)') + '\n\n=== BRIDGE CALLS (last 10) ===\n' + (bridges || '(none)') + '\n\n=== DOM EVENTS (last 10) ===\n' + (dom || '(none)');
      }
    } else if (tab === 'python') {
      var pyState = input?.getDebugPythonState?.();
      if (pyState) {
        html = '=== PYTHON BRIDGE STATE ===\n' + JSON.stringify(pyState, null, 2) + '\n\nbridgeAvailable: ' + pyState.bridgeAvailable + (pyState.error ? '\nerror: ' + pyState.error : '');
      } else {
        html = 'Python bridge state unavailable';
      }
    } else if (tab === 'game') {
      var state = null;
      if (gameState) {
        gameState.refresh?.();
        state = gameState.getState?.();
      }
      if (typeof window.__pa_game_state_json === 'string') {
        try {
          state = JSON.parse(window.__pa_game_state_json);
        } catch (e) {}
      }
      if (state) {
        html = '=== GAME STATE ===\n' + JSON.stringify(state, null, 2);
      } else {
        html = 'Game state unavailable (bridge not connected)';
      }
    } else if (tab === 'metrics') {
      if (metrics) {
        html = '=== BOOT METRICS ===\n' + JSON.stringify(metrics, null, 2);
      } else {
        html = 'Boot metrics unavailable';
      }
    } else if (tab === 'actions') {
      if (actions) {
        html = '=== PIRATE ARCADE ACTIONS ===\n' + JSON.stringify({
          getPrimaryKey: typeof actions.getPrimaryKey,
          performPrimary: typeof actions.performPrimary
        }, null, 2) + '\n\n=== QUICK ACTIONS ===\n';
        html += '<button onclick="window.PirateArcadeInput?.releaseAll?.(\'debug-panel\')" style="margin:4px;padding:6px 12px;background:#2a3142;border:1px solid #d4a843;color:#d4a843;border-radius:4px;cursor:pointer;font-family:inherit;">Release Inputs</button>';
        html += '<button onclick="copyDiagnostics()" style="margin:4px;padding:6px 12px;background:#2a3142;border:1px solid #d4a843;color:#d4a843;border-radius:4px;cursor:pointer;font-family:inherit;">Copy Diagnostics</button>';
        html += '<button onclick="window.location.reload()" style="margin:4px;padding:6px 12px;background:#2a3142;border:1px solid #d4a843;color:#d4a843;border-radius:4px;cursor:pointer;font-family:inherit;">Reload Page</button>';
        html += '<button onclick="window.location.href=\'/play/\'" style="margin:4px;padding:6px 12px;background:#2a3142;border:1px solid #d4a843;color:#d4a843;border-radius:4px;cursor:pointer;font-family:inherit;">Back to Arcade</button>';
      } else {
        html = 'PirateArcadeActions unavailable';
      }
    }

    if (tab === 'actions') {
      content.innerHTML = html;
    } else {
      content.textContent = html;
    }
  }

  // Make copyDiagnostics globally available for the Actions tab
  window.copyDiagnostics = function () {
    var dbg = window.__paInputDebug;
    var input = window.PirateArcadeInput;
    var gameState = window.PirateArcadeGameState;
    var metrics = window.__paBootMetrics;
    var state = null;
    if (gameState) {
      gameState.refresh?.();
      state = gameState.getState?.();
    }
    if (typeof window.__pa_game_state_json === 'string') {
      try {
        state = JSON.parse(window.__pa_game_state_json);
      } catch (e) {}
    }
    var diag = {
      timestamp: new Date().toISOString(),
      inputState: input?.getState?.(),
      gameState: state,
      bootMetrics: metrics,
      bridgeCalls: dbg?.bridgeCalls?.slice(-50) || [],
      events: dbg?.events?.slice(-50) || [],
      domEvents: dbg?.domEvents?.slice(-50) || []
    };
    navigator.clipboard.writeText(JSON.stringify(diag, null, 2)).then(function () {
      console.log('Diagnostics copied to clipboard');
    });
  };

  renderTab('input');
  refreshInterval = setInterval(function () {
    var activeTab = tabs.querySelector('.pa-debug-tab.active')?.dataset.tab;
    if (activeTab) renderTab(activeTab);
  }, 500);

  window.addEventListener('beforeunload', function () {
    if (refreshInterval) clearInterval(refreshInterval);
  });
})();