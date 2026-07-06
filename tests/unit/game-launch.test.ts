import { describe, it, expect } from "vitest";
import type { Game } from "../../src/data/games";
import {
  isBrowserPlayable,
  isPygbag,
  isWebNative,
  getArchiveUrl,
  getLaunchLinkAttrs,
} from "../../src/lib/gameLaunch";

const phaserGame: Game = {
  id: "race-to-treasure-island",
  title: "Race to Treasure Island",
  classic: "boat race",
  description: "Phaser boat racer",
  status: "browser-playable",
  statusLabel: "Playable",
  browserUrl: "/play/race-to-treasure-island/",
  engine: "phaser",
  touchDifficulty: "medium",
};

const pygbagGame: Game = {
  id: "cannonball-clash",
  title: "Cannonball Clash",
  classic: "pong",
  description: "Pygbag pong",
  status: "browser-playable",
  statusLabel: "Playable",
  browserUrl: "/play/cannonball-clash/",
  engine: "pygbag",
  touchDifficulty: "easy",
};

const desktopGame: Game = {
  id: "port-royale-tycoon",
  title: "Port Royale Tycoon",
  classic: "trading board game",
  description: "Desktop trading game",
  status: "desktop-available",
  statusLabel: "Desktop",
  desktopUrl: "https://github.com/edonahue/pirate-arcade/releases",
};

const browserPlannedGame: Game = {
  id: "future-game",
  title: "Future Game",
  classic: "unknown",
  description: "Not yet playable",
  status: "browser-planned",
  statusLabel: "Planned",
};

describe("isBrowserPlayable", () => {
  it("returns true for browser-playable Phaser game", () => {
    expect(isBrowserPlayable(phaserGame)).toBe(true);
  });

  it("returns true for browser-playable Pygbag game", () => {
    expect(isBrowserPlayable(pygbagGame)).toBe(true);
  });

  it("returns false for desktop-only game", () => {
    expect(isBrowserPlayable(desktopGame)).toBe(false);
  });

  it("returns false for browser-planned game without browserUrl", () => {
    expect(isBrowserPlayable(browserPlannedGame)).toBe(false);
  });
});

describe("isPygbag", () => {
  it("returns true for Pygbag game", () => {
    expect(isPygbag(pygbagGame)).toBe(true);
  });

  it("returns false for Phaser game", () => {
    expect(isPygbag(phaserGame)).toBe(false);
  });

  it("returns false for desktop-only game", () => {
    expect(isPygbag(desktopGame)).toBe(false);
  });
});

describe("isWebNative", () => {
  it("returns true for Phaser game", () => {
    expect(isWebNative(phaserGame)).toBe(true);
  });

  it("returns false for Pygbag game", () => {
    expect(isWebNative(pygbagGame)).toBe(false);
  });

  it("returns false for desktop-only game", () => {
    expect(isWebNative(desktopGame)).toBe(false);
  });
});

describe("getArchiveUrl", () => {
  it("returns empty string for Phaser game", () => {
    expect(getArchiveUrl(phaserGame)).toBe("");
  });

  it("returns versioned .tar.gz for Pygbag game", () => {
    const url = getArchiveUrl(pygbagGame);
    expect(url).toMatch(
      /^\/play\/cannonball-clash\/cannonball-clash\.tar\.gz\?v=/,
    );
    expect(url).toContain("?v=");
  });

  it("returns empty string for desktop-only game", () => {
    expect(getArchiveUrl(desktopGame)).toBe("");
  });

  it("returns empty string for browser-planned game", () => {
    expect(getArchiveUrl(browserPlannedGame)).toBe("");
  });
});

describe("getLaunchLinkAttrs", () => {
  it("returns null for desktop-only game", () => {
    expect(getLaunchLinkAttrs(desktopGame)).toBeNull();
  });

  it("returns null for browser-planned game", () => {
    expect(getLaunchLinkAttrs(browserPlannedGame)).toBeNull();
  });

  it("returns full attrs for Phaser game with empty archive", () => {
    const attrs = getLaunchLinkAttrs(phaserGame);
    expect(attrs).not.toBeNull();
    expect(attrs!.href).toBe(phaserGame.browserUrl);
    expect(attrs!["data-game-id"]).toBe(phaserGame.id);
    expect(attrs!["data-game-title"]).toBe(phaserGame.title);
    expect(attrs!["data-browser-playable"]).toBe("true");
    expect(attrs!["data-game-page"]).toBe(phaserGame.browserUrl);
    expect(attrs!["data-game-archive"]).toBe("");
    expect(attrs!["data-game-launch"]).toBe("true");
    expect(attrs!["data-captains-log"]).toBe(phaserGame.id);
  });

  it("returns versioned archive for Pygbag game", () => {
    const attrs = getLaunchLinkAttrs(pygbagGame);
    expect(attrs).not.toBeNull();
    expect(attrs!["data-game-archive"]).toContain("?v=");
    expect(attrs!["data-game-archive"]).toMatch(/\.tar\.gz\?v=.*$/);
  });
});
