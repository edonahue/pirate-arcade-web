// Build-time / server-side helper only.
// Reads public/play/*/*.tar.gz.sha256 via Node fs/path.
// Do not import from browser-bundled scripts; use rendered data-* attrs instead.

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
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

/**
 * Return the content-hashed archive URL for browser-playable Pygbag games.
 * Returns "" for Phaser, desktop-only, or games missing their .sha256 sidecar.
 *
 * The returned URL must match the generated shell preload URL exactly
 * (same /play/<id>/<id>.tar.gz?h=<sha256>) so prewarm warms the same
 * cache entry that the game shell fetches at runtime.
 */
export function getArchiveUrl(game: Game): string {
  if (!isBrowserPlayable(game) || !isPygbag(game)) return "";
  const hash = readArchiveHash(game.id);
  if (!hash) return "";
  return `/play/${game.id}/${game.id}.tar.gz?h=${hash}`;
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
