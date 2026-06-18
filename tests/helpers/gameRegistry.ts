import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface GameEntry {
  id: string;
  name: string;
  path: string;
}

export function loadPybagGames(): GameEntry[] {
  const gamesPath = resolve(__dirname, "../../src/data/games.json");
  const games = JSON.parse(readFileSync(gamesPath, "utf-8"));
  return games
    .filter(
      (g: any) => g.engine === "pygbag" && g.status === "browser-playable",
    )
    .map((g: any) => ({ id: g.id, name: g.title, path: g.browserUrl }));
}
