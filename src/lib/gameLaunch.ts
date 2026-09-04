// Build-time / server-side helper only.
// Reads public/play/*/*.tar.gz.sha256 via Node fs/path.
// Do not import from browser-bundled scripts; use rendered data-* attrs instead.

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Game } from "../data/games";
import { site } from "../data/profile";

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
 * Single home for the desktop-availability rule. A game ships on desktop
 * when it is explicitly desktop-only, carries an explicit desktop URL, or
 * is a Pygbag port (all Pygbag ports ship in the shared desktop release).
 * Do NOT reimplement this inference in pages, components, schema, tests,
 * or validators — call this helper so the rule stays in one tested place.
 */
export function isDesktopAvailable(game: Game): boolean {
  return (
    game.status === "desktop-available" ||
    !!game.desktopUrl ||
    game.engine === "pygbag"
  );
}

/**
 * Resolve where a desktop-capable game is obtained. An explicit per-game
 * desktopUrl wins; otherwise the shared desktop releases index is used.
 * Returns "" when the game has no desktop release.
 */
export function getDesktopReleaseUrl(game: Game): string {
  if (game.desktopUrl) return game.desktopUrl;
  if (isDesktopAvailable(game)) return `${site.desktopRepoUrl}/releases`;
  return "";
}

/** Player-facing load behavior derived from the browser engine. */
export function getBrowserLoadLabel(game: Game): "Instant" | "Runtime load" | null {
  if (isWebNative(game)) return "Instant";
  if (isPygbag(game)) return "Runtime load";
  return null;
}

/** Player-facing engine label derived from the browser engine. */
export function getBrowserEngineLabel(game: Game): "Phaser" | "Pygbag" | null {
  if (isWebNative(game)) return "Phaser";
  if (isPygbag(game)) return "Pygbag";
  return null;
}

/** Player-facing challenge label derived from explicit challenge metadata. */
export function getChallengeLabel(game: Game): "Easier" | "Balanced" | "Harder" | null {
  if (game.challenge === "easier") return "Easier";
  if (game.challenge === "balanced") return "Balanced";
  if (game.challenge === "harder") return "Harder";
  return null;
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
