import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ASSET_VERSION } from "../../scripts/game-asset-versions.mjs";
import type { Game } from "../data/games";

function readArchiveHash(gameId: string): string {
  try {
    const shaPath = resolve("public/play", gameId, `${gameId}.tar.gz.sha256`);
    if (!existsSync(shaPath)) return "";
    const content = readFileSync(shaPath, "utf-8").trim();
    return content.split(/\s+/)[0] || "";
  } catch {
    return "";
  }
}

export function isBrowserPlayable(game: Game): boolean {
  return game.status === "browser-playable" && !!game.browserUrl;
}

export function isPygbag(game: Game): boolean {
  return game.engine === "pygbag";
}

export function isWebNative(game: Game): boolean {
  return game.engine === "phaser";
}

export function getArchiveUrl(game: Game): string {
  if (!isBrowserPlayable(game) || !isPygbag(game)) return "";
  const hash = readArchiveHash(game.id);
  if (hash) return `/play/${game.id}/${game.id}.tar.gz?h=${hash}`;
  return `/play/${game.id}/${game.id}.tar.gz?v=${ASSET_VERSION}`;
}

export interface LaunchLinkAttrs {
  href: string;
  "data-game-id": string;
  "data-game-title": string;
  "data-browser-playable": "true";
  "data-game-page": string;
  "data-game-archive": string;
  "data-game-launch": "true";
  "data-captains-log": string;
}

export function getLaunchLinkAttrs(game: Game): LaunchLinkAttrs | null {
  if (!isBrowserPlayable(game) || !game.browserUrl) return null;
  return {
    href: game.browserUrl,
    "data-game-id": game.id,
    "data-game-title": game.title,
    "data-browser-playable": "true",
    "data-game-page": game.browserUrl,
    "data-game-archive": getArchiveUrl(game),
    "data-game-launch": "true",
    "data-captains-log": game.id,
  };
}
