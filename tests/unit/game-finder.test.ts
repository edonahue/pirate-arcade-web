import { describe, it, expect } from "vitest";
import { games } from "../../src/data/games";
import { recommendGame } from "../../src/scripts/game-finder";

const eligible = games.filter(
  (g): g is typeof g & { browserUrl: string } =>
    g.status === "browser-playable" && !!g.browserUrl,
);

describe("recommendGame", () => {
  it("returns a deterministic eligible candidate with default preferences", () => {
    const a = recommendGame(games, {});
    const b = recommendGame(games, {});
    expect(a.game).toBe(b.game);
    expect(eligible.map((g) => g.id)).toContain(a.game.id);
  });

  it("favors touchDifficulty easy when control is touch", () => {
    const rec = recommendGame(games, { control: "touch" });
    expect(rec.game.touchDifficulty).toBe("easy");
  });

  it("strongly favors phaser engine for instant load", () => {
    const rec = recommendGame(games, { load: "instant" });
    expect(rec.game.engine).toBe("phaser");
  });

  it("favors harder touchDifficulty for harder challenge", () => {
    const rec = recommendGame(games, { challenge: "harder" });
    expect(rec.game.touchDifficulty).toBe("harder");
  });

  it("returns the registry browserUrl for the selected game", () => {
    const rec = recommendGame(games, {});
    const registry = eligible.find((g) => g.id === rec.game.id);
    expect(rec.game.browserUrl).toBe(registry!.browserUrl);
  });

  it("throws when no eligible candidates exist", () => {
    const empty: typeof games = [];
    expect(() => recommendGame(empty, {})).toThrow(
      "No browser-playable games with a browserUrl are available.",
    );
  });
});
