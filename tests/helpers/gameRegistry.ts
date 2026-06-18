import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface GameEntry {
  id: string;
  name: string;
  path: string;
}

export interface PygbagGameDetail extends GameEntry {
  title: string;
  controlMode: string;
  hintContains: string;
  actionLabel: string;
}

/** Per-game control metadata for Pygbag browser games */
export interface PygbagControlDetail extends PygbagGameDetail {
  desktopKeys: string[];
  actionKey: string;
  dragAxis: "x" | "y";
  directionalKeys: Record<string, string[]>;
  hintText: string;
  keyboardHelp: string;
}

function loadGamesJson(): any[] {
  const gamesPath = resolve(__dirname, "../../src/data/games.json");
  return JSON.parse(readFileSync(gamesPath, "utf-8"));
}

/** Pygbag browser-playable games (cannonball-clash, treasure-cove, krakens-wake) */
export function loadPybagGames(): GameEntry[] {
  return loadGamesJson()
    .filter(
      (g: any) => g.engine === "pygbag" && g.status === "browser-playable",
    )
    .map((g: any) => ({ id: g.id, name: g.title, path: g.browserUrl }));
}

/** Pygbag games with detail fields derived from games.json */
export function loadPybagGameDetails(): PygbagGameDetail[] {
  return loadGamesJson()
    .filter(
      (g: any) => g.engine === "pygbag" && g.status === "browser-playable",
    )
    .map((g: any) => ({
      id: g.id,
      name: g.title,
      title: g.title,
      path: g.browserUrl,
      controlMode: g.controlMode ?? "pong",
      hintContains: g.controlMode === "asteroids" ? "turn" : "slide",
      actionLabel:
        g.controlMode === "pong"
          ? "START"
          : g.controlMode === "breakout"
            ? "LAUNCH"
            : g.controlMode === "asteroids"
              ? "\u23ce"
              : "START",
    }));
}

/** Per-game control data for Pygbag browser games, keyed by controlMode */
const PYBAG_CONTROL_MAP: Record<
  string,
  {
    desktopKeys: string[];
    actionKey: string;
    dragAxis: "x" | "y";
    directionalKeys: Record<string, string[]>;
  }
> = {
  pong: {
    desktopKeys: ["ArrowUp", "ArrowDown", "Space", "Enter", "Escape"],
    actionKey: "Enter",
    dragAxis: "y",
    directionalKeys: {
      up: ["ArrowUp", "w"],
      down: ["ArrowDown", "s"],
    },
  },
  breakout: {
    desktopKeys: ["ArrowLeft", "ArrowRight", "Space", "Enter", "Escape"],
    actionKey: "Space",
    dragAxis: "x",
    directionalKeys: {
      left: ["ArrowLeft", "a"],
      right: ["ArrowRight", "d"],
    },
  },
  asteroids: {
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
  },
};

/** Load Pygbag games with full control metadata */
export function loadPybagControlDetails(): PygbagControlDetail[] {
  return loadPybagGameDetails().map((g) => {
    const ctrl = PYBAG_CONTROL_MAP[g.controlMode] ?? PYBAG_CONTROL_MAP.pong;
    return {
      ...g,
      desktopKeys: ctrl.desktopKeys,
      actionKey: ctrl.actionKey,
      dragAxis: ctrl.dragAxis,
      directionalKeys: ctrl.directionalKeys,
      hintText:
        g.controlMode === "pong"
          ? "Slide ship up or down"
          : g.controlMode === "breakout"
            ? "Slide longboat left or right"
            : "Turn, thrust, and fire",
      keyboardHelp:
        g.controlMode === "pong"
          ? "ArrowUp / W — move up • ArrowDown / S — move down • Space / Escape — pause • Enter — confirm"
          : g.controlMode === "breakout"
            ? "ArrowLeft / A — move left • ArrowRight / D — move right • Space — launch ball • Escape — pause • Enter — confirm"
            : "ArrowLeft / A — turn left • ArrowRight / D — turn right • ArrowUp / W — thrust • Space — fire • Escape / P — pause • Enter — confirm",
    };
  });
}

/** All browser-playable games (pygbag + phaser) */
export function loadBrowserGames(): GameEntry[] {
  return loadGamesJson()
    .filter((g: any) => g.status === "browser-playable")
    .map((g: any) => ({ id: g.id, name: g.title, path: g.browserUrl }));
}

/** IDs of all pygbag browser-playable games */
export function pygbagGameIds(): string[] {
  return loadPybagGames().map((g) => g.id);
}

/** IDs of all browser-playable games */
export function browserGameIds(): string[] {
  return loadBrowserGames().map((g) => g.id);
}
