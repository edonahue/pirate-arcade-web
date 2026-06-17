// Pygbag game configurations — single source of truth for shell generation
// Each entry provides the per-game parameters consumed by pygbag-shell-template.mjs

import { ASSET_VERSION } from "./game-asset-versions.mjs";

export const PYBAG_GAMES = [
  {
    id: "cannonball-clash",
    title: "Cannonball Clash",
    moduleImport: "from games.pong.game import PongGame",
    gameClass: "PongGame",
    caption: "Cannonball Clash",
    controlsHint: "Slide ship up/down  \u2022  START  \u2022  PAUSE",
    controlsMode: "pong",
    readyMessage: "Ready \u2014 tap START",
    loadingText: "Installing touch controls\u2026",
    touchOverlay: "pong",
    crossFileTimeout: 30000,
    hasHighscoresShim: false,
  },
  {
    id: "treasure-cove",
    title: "Treasure Cove",
    moduleImport: "from games.breakout.game import BreakoutGame",
    gameClass: "BreakoutGame",
    caption: "Treasure Cove",
    controlsHint: "Slide longboat left/right  \u2022  LAUNCH  \u2022  PAUSE",
    controlsMode: "breakout",
    readyMessage: "Ready \u2014 tap START",
    loadingText: "Installing touch controls\u2026",
    touchOverlay: "breakout",
    crossFileTimeout: 30000,
    hasHighscoresShim: false,
  },
  {
    id: "krakens-wake",
    title: "Kraken's Wake",
    moduleImport: "from games.asteroids.game import AsteroidsGame",
    gameClass: "AsteroidsGame",
    caption: "Kraken's Wake",
    controlsHint: "TURN  \u2022  THRUST  \u2022  FIRE  \u2022  PAUSE",
    controlsMode: "asteroids",
    readyMessage: "Ready \u2014 tap to play",
    loadingText: "Setting up game\u2026",
    touchOverlay: "asteroids",
    crossFileTimeout: 10000,
    hasHighscoresShim: true,
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
