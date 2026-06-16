/**
 * Captain's Log - Local play history panel.
 * Runs on /play page to show browser game launch history.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "pirate-arcade-captains-log";
  const MAX_ENTRIES = 20;

  // Detect if localStorage is available (fails in Safari private mode)
  function isStorageAvailable() {
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  const STORAGE_WORKS = isStorageAvailable();

  function isValidEntry(entry) {
    return (
      entry && typeof entry === "object" && typeof entry.gameId === "string"
    );
  }

  function saveLog(log) {
    if (!STORAGE_WORKS) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch {
      // Ignore quota exceeded or other errors
    }
  }

  function getLog() {
    if (!STORAGE_WORKS) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidEntry);
    } catch {
      return [];
    }
  }

  function addEntry(gameId, title, route) {
    const log = getLog();
    const now = Date.now();
    const entry = {
      gameId,
      title,
      timestamp: now,
      route,
    };
    // Remove any existing entry for the same game (keep most recent)
    const filtered = log.filter((e) => e.gameId !== gameId);
    filtered.unshift(entry);
    // Trim to max entries
    if (filtered.length > MAX_ENTRIES) {
      filtered.length = MAX_ENTRIES;
    }
    saveLog(filtered);
    return filtered;
  }

  function getRegistryTitle(gameId) {
    const gamesData = window.__PA_GAMES_DATA || [];
    const game = gamesData.find((g) => g.id === gameId);
    return game?.title || null;
  }

  function clearLog() {
    if (!STORAGE_WORKS) return [];
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + "-counts");
    } catch {
      // Ignore
    }
    return [];
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getClassic(gameId) {
    const gamesData = window.__PA_GAMES_DATA || [];
    const game = gamesData.find((g) => g.id === gameId);
    return game?.classic || "";
  }

  function getLaunchCount(gameId) {
    if (!STORAGE_WORKS) return 1;
    try {
      const raw = localStorage.getItem(STORAGE_KEY + "-counts");
      if (!raw) return 1;
      const counts = JSON.parse(raw);
      return counts[gameId] || 1;
    } catch {
      return 1;
    }
  }

  function incrementLaunchCount(gameId) {
    if (!STORAGE_WORKS) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY + "-counts");
      const counts = raw ? JSON.parse(raw) : {};
      counts[gameId] = (counts[gameId] || 0) + 1;
      localStorage.setItem(STORAGE_KEY + "-counts", JSON.stringify(counts));
    } catch {
      // Ignore
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderLog(log) {
    const list = document.getElementById("captains-log-list");
    if (!list) return;

    if (log.length === 0) {
      list.innerHTML =
        '<li class="captains-log__empty">No voyages recorded yet. Play a game to start your log.</li>';
      return;
    }

    list.innerHTML = log
      .map(function (entry) {
        const displayTitle = getRegistryTitle(entry.gameId) || entry.title;
        return (
          '<li class="captains-log__item">' +
          '<div class="captains-log__item-header">' +
          '<span class="captains-log__game-name">' +
          escapeHtml(displayTitle) +
          "</span>" +
          '<span class="captains-log__game-classic">' +
          escapeHtml(getClassic(entry.gameId)) +
          "</span>" +
          "</div>" +
          '<div class="captains-log__meta">' +
          '<span class="captains-log__meta-item">' +
          '<span class="captains-log__meta-label">Launches:</span>' +
          "<span>" +
          getLaunchCount(entry.gameId) +
          "</span>" +
          "</span>" +
          '<span class="captains-log__meta-item">' +
          '<span class="captains-log__meta-label">Last played:</span>' +
          "<span>" +
          formatDate(entry.timestamp) +
          "</span>" +
          "</span>" +
          "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function init() {
    const container = document.getElementById("captains-log");
    if (!container) {
      // Retry after a short delay if container not found yet
      setTimeout(init, 50);
      return;
    }

    const log = getLog();
    if (log.length > 0) {
      container.hidden = false;
      renderLog(log);
    }

    const clearBtn = document.getElementById("captains-log-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearLog();
        container.hidden = true;
        renderLog([]);
      });
    }
  }

  // Expose for the launch buttons
  window.__paCaptainsLog = {
    addEntry,
    incrementLaunchCount,
    clearLog,
  };

  // Run init immediately if DOM is ready, otherwise wait
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Use setTimeout to ensure component is fully inserted
    setTimeout(init, 0);
  }
})();
