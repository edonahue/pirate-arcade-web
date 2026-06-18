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
