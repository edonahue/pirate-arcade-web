import { test, expect } from "./helpers/browserGame";
import {
  waitForPygbagRuntime,
  readGameState,
  expectGamePhase,
} from "./helpers/browserGame";

async function pressEnter(page: any) {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
}

for (const game of [
  { id: "treasure-cove", name: "Treasure Cove" },
  { id: "cannonball-clash", name: "Cannonball Clash" },
]) {
  test.describe(`${game.name} — game-state bridge`, () => {
    test("boots and exposes all required state fields", async ({ page }) => {
      await page.goto(`/play/${game.id}/`);
      await waitForPygbagRuntime(page);
      await expectGamePhase(page, "menu");
      await pressEnter(page);
      await expectGamePhase(page, "playing");
      await page.waitForTimeout(1000);

      const state = (await readGameState(page)) as Record<
        string,
        unknown
      > | null;
      expect(state).toBeTruthy();
      expect(state!.gameId).toBe(game.id);
      expect(state!.phase).toBe("playing");
      expect(typeof state!.score).toBe("number");

      if (game.id === "treasure-cove") {
        expect(state!.stage).toBe(1);
        expect(state!.maxStage).toBe(3);
        expect(typeof state!.bricksRemaining).toBe("number");
        expect((state!.bricksRemaining as number) > 0).toBe(true);
        expect(typeof state!.standardBricksRemaining).toBe("number");
        expect(typeof state!.reinforcedBricksRemaining).toBe("number");
        expect(typeof state!.powderKegsRemaining).toBe("number");
        expect(typeof state!.treasureBricksRemaining).toBe("number");
        expect(typeof state!.widePaddleActive).toBe("boolean");
        expect(typeof state!.slowMotionActive).toBe("boolean");
        expect(state!.widePaddleActive).toBe(false);
        expect(state!.slowMotionActive).toBe(false);
        expect(state!.stageTransitionActive).toBe(false);
        expect(typeof state!.ballsActive).toBe("number");
        expect(typeof state!.underlyingBallSpeed).toBe("number");
        expect(typeof state!.effectiveBallSpeed).toBe("number");
        expect((state!.underlyingBallSpeed as number) >= 650).toBe(true);
        expect(state!.fallingPickupCount).toBe(0);
      }

      if (game.id === "cannonball-clash") {
        expect(typeof state!.currentRally).toBe("number");
        expect(typeof state!.longestRally).toBe("number");
        expect(typeof state!.rallyTier).toBe("number");
        expect(state!.currentRally).toBe(0);
        expect(state!.longestRally).toBe(0);
        expect(state!.rallyTier).toBe(0);
        expect(typeof state!.aiShrinkActive).toBe("boolean");
        expect(typeof state!.aiShrinkRemainingMs).toBe("number");
        expect(state!.aiShrinkActive).toBe(false);
        expect(state!.aiShrinkRemainingMs).toBe(0);
      }
    });
  });
}
