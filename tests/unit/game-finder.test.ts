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

  it("uses gameplay challenge metadata for challenge preference", () => {
    const harder = recommendGame(games, { challenge: "harder" });
    expect(harder.game.challenge).toBe("harder");
    const easier = recommendGame(games, { challenge: "easier" });
    expect(easier.game.challenge).toBe("easier");
    const balanced = recommendGame(games, { challenge: "balanced" });
    expect(balanced.game.challenge).toBe("balanced");
  });

  it("does not derive challenge from touch difficulty", () => {
    // Cannonball is easy on touch but not an easier challenge pick gone wrong:
    // challenge ranking must follow the challenge field, not touchDifficulty.
    const rec = recommendGame(games, {
      control: "touch",
      challenge: "harder",
    });
    expect(rec.game.challenge).toBe("harder");
  });

  it("keyboard preference adds no ranking signal", () => {
    const keyboard = recommendGame(games, { control: "keyboard" });
    const neutral = recommendGame(games, {});
    expect(keyboard.game.id).toBe(neutral.game.id);
  });

  it("never claims keyboard superiority", () => {
    const rec = recommendGame(games, { control: "keyboard" });
    expect(rec.reason).not.toContain("keyboard-optimized");
    expect(rec.reason).toContain("full keyboard controls");
  });

  it("strongly favors phaser engine for instant load", () => {
    const rec = recommendGame(games, { load: "instant" });
    expect(rec.game.engine).toBe("phaser");
  });

  it("treats runtime-ok as neutral like no load preference", () => {
    const runtimeOk = recommendGame(games, {
      control: "keyboard",
      load: "runtime-ok",
      challenge: "balanced",
    });
    const neutral = recommendGame(games, {
      control: "keyboard",
      challenge: "balanced",
    });
    expect(runtimeOk.game.id).toBe(neutral.game.id);
  });

  it("describes reasons with matched attributes", () => {
    expect(recommendGame(games, { load: "instant" }).reason).toContain(
      "instant load",
    );
    expect(recommendGame(games, { control: "touch" }).reason).toContain(
      "easiest touch controls",
    );
    expect(recommendGame(games, { challenge: "harder" }).reason).toContain(
      "harder challenge",
    );
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
