import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
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

  it("returns content-hashed .tar.gz for Pygbag game", () => {
    const url = getArchiveUrl(pygbagGame);
    expect(url).toMatch(
      /^\/play\/cannonball-clash\/cannonball-clash\.tar\.gz\?h=/,
    );
    expect(url).toContain("?h=");
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

  it("returns content-hashed archive for Pygbag game", () => {
    const attrs = getLaunchLinkAttrs(pygbagGame);
    expect(attrs).not.toBeNull();
    expect(attrs!["data-game-archive"]).toContain("?h=");
    expect(attrs!["data-game-archive"]).toMatch(/\.tar\.gz\?h=[a-f0-9]{64}$/);
  });
});

describe("archive hash contract: data-driven from games.json", () => {
  const gamesJson = JSON.parse(
    readFileSync(resolve("src/data/games.json"), "utf-8"),
  );

  const pygbagBrowserGames = gamesJson.filter(
    (g: any) => g.status === "browser-playable" && g.engine === "pygbag",
  );

  const phaserBrowserGames = gamesJson.filter(
    (g: any) => g.status === "browser-playable" && g.engine === "phaser",
  );

  describe("every Pygbag browser game has a .sha256 sidecar", () => {
    for (const g of pygbagBrowserGames) {
      it(`${g.id}: has .sha256 sidecar with 64-char hex hash`, () => {
        const shaPath = resolve("public/play", g.id, `${g.id}.tar.gz.sha256`);
        expect(existsSync(shaPath)).toBe(true);

        const content = readFileSync(shaPath, "utf-8").trim();
        const hash = content.split(/\s+/)[0];
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });
    }
  });

  describe("helper archive URL matches generated shell preload URL", () => {
    for (const g of pygbagBrowserGames) {
      it(`${g.id}: getArchiveUrl matches shell <link rel=preload>`, () => {
        const htmlPath = resolve("public/play", g.id, "index.html");
        const html = readFileSync(htmlPath, "utf-8");

        const shellMatch = html.match(
          /<link[^>]*rel="preload"[^>]*href="(\/play\/[^/]+\/[^/]+\.tar\.gz\?h=[a-f0-9]+)"/,
        );
        expect(shellMatch).not.toBeNull();
        const shellUrl = shellMatch![1];

        const game: Game = {
          id: g.id,
          title: g.title,
          classic: "",
          description: "",
          status: "browser-playable",
          statusLabel: "Playable",
          browserUrl: `/play/${g.id}/`,
          engine: "pygbag",
          touchDifficulty: g.touchDifficulty ?? "medium",
        };
        expect(getArchiveUrl(game)).toBe(shellUrl);

        const attrs = getLaunchLinkAttrs(game);
        expect(attrs).not.toBeNull();
        expect(attrs!["data-game-archive"]).toBe(shellUrl);
      });
    }
  });

  describe("no Pygbag browser launch metadata uses ?v= fallback", () => {
    for (const g of pygbagBrowserGames) {
      it(`${g.id}: data-game-archive does not contain ?v=`, () => {
        const game: Game = {
          id: g.id,
          title: g.title,
          classic: "",
          description: "",
          status: "browser-playable",
          statusLabel: "Playable",
          browserUrl: `/play/${g.id}/`,
          engine: "pygbag",
          touchDifficulty: g.touchDifficulty ?? "medium",
        };
        const url = getArchiveUrl(game);
        expect(url).not.toContain("?v=");
      });
    }
  });

  describe("Phaser games have empty archive metadata", () => {
    for (const g of phaserBrowserGames) {
      it(`${g.id}: getArchiveUrl returns ""`, () => {
        const game: Game = {
          id: g.id,
          title: g.title,
          classic: "",
          description: "",
          status: "browser-playable",
          statusLabel: "Playable",
          browserUrl: `/play/${g.id}/`,
          engine: "phaser",
          touchDifficulty: g.touchDifficulty ?? "medium",
        };
        expect(getArchiveUrl(game)).toBe("");

        const attrs = getLaunchLinkAttrs(game);
        expect(attrs).not.toBeNull();
        expect(attrs!["data-game-archive"]).toBe("");
      });
    }
  });

  describe("desktop-only games produce no launch metadata", () => {
    const desktopGames = gamesJson.filter(
      (g: any) => g.status === "desktop-available",
    );

    for (const g of desktopGames) {
      it(`${g.id}: getLaunchLinkAttrs returns null`, () => {
        const game: Game = {
          id: g.id,
          title: g.title,
          classic: "",
          description: "",
          status: "desktop-available",
          statusLabel: "Desktop",
          desktopUrl: g.desktopUrl ?? "",
        };
        expect(isBrowserPlayable(game)).toBe(false);
        expect(getLaunchLinkAttrs(game)).toBeNull();
      });
    }
  });
});
