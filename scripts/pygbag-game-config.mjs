// Pygbag game configurations — single source of truth for shell generation
// Each entry provides the per-game parameters consumed by pygbag-shell-template.mjs

import { ASSET_VERSION } from "./game-asset-versions.mjs";

export const PYBAG_GAMES = [
  {
    id: "cannonball-clash",
    title: "Cannonball Clash",
    pythonModule: "games.pong.game",
    gameClass: "PongGame",
    caption: "Cannonball Clash",
    controlsHint: "Slide ship up/down  \u2022  START  \u2022  PAUSE",
    controlsMode: "pong",
    readyMessage: "Ready \u2014 tap START",
    loadingText: "Installing touch controls\u2026",
    touchOverlay: "pong",
    crossFileTimeout: 30000,
    hasHighscoresShim: false,
    desktopKeys: ["ArrowUp", "ArrowDown", "Space", "Enter", "Escape"],
    actionKey: "Enter",
    dragAxis: "y",
    directionalKeys: {
      up: ["ArrowUp", "w"],
      down: ["ArrowDown", "s"],
    },
    hintText: "Slide ship up or down",
    keyboardHelp:
      "ArrowUp / W — move up \u2022 ArrowDown / S — move down \u2022 Space / Escape — pause \u2022 Enter — confirm",
    menuLabel: "START",
    playLabel: "ACTION",
    gameOverLabel: "PLAY AGAIN",
  },
  {
    id: "treasure-cove",
    title: "Treasure Cove",
    pythonModule: "games.breakout.game",
    gameClass: "BreakoutGame",
    caption: "Treasure Cove",
    controlsHint: "Slide longboat left/right  \u2022  LAUNCH  \u2022  PAUSE",
    controlsMode: "breakout",
    readyMessage: "Ready \u2014 tap LAUNCH",
    loadingText: "Installing touch controls\u2026",
    touchOverlay: "breakout",
    crossFileTimeout: 30000,
    hasHighscoresShim: false,
    desktopKeys: ["ArrowLeft", "ArrowRight", "Space", "Enter", "Escape"],
    actionKey: "Space",
    dragAxis: "x",
    directionalKeys: {
      left: ["ArrowLeft", "a"],
      right: ["ArrowRight", "d"],
    },
    hintText: "Slide longboat left or right",
    keyboardHelp:
      "ArrowLeft / A — move left \u2022 ArrowRight / D — move right \u2022 Space — launch ball \u2022 Escape — pause \u2022 Enter — confirm",
    menuLabel: "LAUNCH",
    playLabel: "LAUNCH",
    gameOverLabel: "PLAY AGAIN",
  },
  {
    id: "krakens-wake",
    title: "Kraken's Wake",
    pythonModule: "games.asteroids.game",
    gameClass: "AsteroidsGame",
    caption: "Kraken's Wake",
    controlsHint: "TURN  \u2022  THRUST  \u2022  FIRE  \u2022  PAUSE",
    controlsMode: "asteroids",
    readyMessage: "Ready \u2014 tap to play",
    loadingText: "Setting up game\u2026",
    touchOverlay: "asteroids",
    crossFileTimeout: 10000,
    hasHighscoresShim: true,
    desktopKeys: [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "Enter",
      "Escape",
    ],
    actionKey: "Space",
    dragAxis: "x",
    directionalKeys: {
      left: ["ArrowLeft", "a"],
      right: ["ArrowRight", "d"],
      thrust: ["ArrowUp", "w"],
      brake: ["ArrowDown", "s"],
    },
    hintText: "Turn, thrust, and fire",
    keyboardHelp:
      "ArrowLeft / A — turn left \u2022 ArrowRight / D — turn right \u2022 ArrowUp / W — thrust \u2022 Space — fire \u2022 Escape / P — pause \u2022 Enter — confirm",
    menuLabel: "START",
    playLabel: "FIRE",
    gameOverLabel: "PLAY AGAIN",
  },
];

// Derived helpers
export function archiveUrl(id) {
  return `/play/${id}/${id}.tar.gz?v=${ASSET_VERSION}`;
}

export function shellPageUrl(id) {
  return `/play/${id}/`;
}

export default PYBAG_GAMES;
