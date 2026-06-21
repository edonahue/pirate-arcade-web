import unittest
import re
import os
import sys


REPO = os.path.normpath(os.path.join(os.path.dirname(__file__), "../.."))
PONG = os.path.join(REPO, "scripts/pygbag-port/cannonball-clash/games/pong/game.py")
BREAKOUT = os.path.join(REPO, "scripts/pygbag-port/treasure-cove/games/breakout/game.py")
ASTEROIDS = os.path.join(REPO, "scripts/pygbag-port/krakens-wake/games/asteroids/game.py")


def read_source(path):
    with open(path) as f:
        return f.read()


class TestGameSourceContract(unittest.TestCase):

    def test_pong_uses_shared_publisher(self):
        src = read_source(PONG)
        self.assertIn("from shared.pa_state import StatePublisher", src)
        self.assertIn("StatePublisher()", src)

    def test_breakout_uses_shared_publisher(self):
        src = read_source(BREAKOUT)
        self.assertIn("from shared.pa_state import StatePublisher", src)
        self.assertIn("StatePublisher()", src)

    def test_asteroids_uses_shared_publisher(self):
        src = read_source(ASTEROIDS)
        self.assertIn("from shared.pa_state import StatePublisher", src)
        self.assertIn("StatePublisher()", src)

    def test_pong_no_direct_json_dumps(self):
        src = read_source(PONG)
        self.assertNotIn("json.dumps", src)

    def test_breakout_no_direct_json_dumps(self):
        src = read_source(BREAKOUT)
        self.assertNotIn("json.dumps", src)

    def test_asteroids_no_direct_json_dumps(self):
        src = read_source(ASTEROIDS)
        self.assertNotIn("json.dumps", src)

    def test_pong_no_direct_builtins_assign(self):
        src = read_source(PONG)
        self.assertNotIn("__pa_game_state_json", src)

    def test_breakout_no_direct_builtins_assign(self):
        src = read_source(BREAKOUT)
        self.assertNotIn("__pa_game_state_json", src)

    def test_asteroids_no_direct_builtins_assign(self):
        src = read_source(ASTEROIDS)
        self.assertNotIn("__pa_game_state_json", src)

    def test_pong_no_dom_write(self):
        src = read_source(PONG)
        self.assertNotIn("innerText", src)
        self.assertNotIn("pa-game-state", src)

    def test_breakout_no_dom_write(self):
        src = read_source(BREAKOUT)
        self.assertNotIn("innerText", src)
        self.assertNotIn("pa-game-state", src)

    def test_asteroids_no_dom_write(self):
        src = read_source(ASTEROIDS)
        self.assertNotIn("innerText", src)
        self.assertNotIn("pa-game-state", src)

    def test_pong_event_key_has_required_fields(self):
        src = read_source(PONG)
        self.assertIn('"phase"', src)
        self.assertIn('"score"', src)
        self.assertIn('"secondaryScore"', src)
        self.assertIn('"actionReady"', src)

    def test_breakout_event_key_has_required_fields(self):
        src = read_source(BREAKOUT)
        self.assertIn('"phase"', src)
        self.assertIn('"score"', src)
        self.assertIn('"lives"', src)
        self.assertIn('"actionReady"', src)
        self.assertIn('"ballLaunched"', src)
        self.assertIn('"stage"', src)
        self.assertIn('"bricksRemaining"', src)

    def test_asteroids_event_key_has_required_fields(self):
        src = read_source(ASTEROIDS)
        self.assertIn('"phase"', src)
        self.assertIn('"score"', src)
        self.assertIn('"lives"', src)
        self.assertIn('"actionReady"', src)
        self.assertIn('"projectileCount"', src)

    def test_breakout_no_primary_ball(self):
        src = read_source(BREAKOUT)
        self.assertNotIn("primary_ball", src)

    def test_breakout_no_launched_count(self):
        src = read_source(BREAKOUT)
        self.assertNotIn("launched_count", src)

    def test_pong_uses_tick(self):
        src = read_source(PONG)
        self.assertIn("self._state_pub.tick(dt, {", src)

    def test_breakout_uses_tick(self):
        src = read_source(BREAKOUT)
        self.assertIn("self._state_pub.tick(dt, {", src)

    def test_asteroids_uses_tick(self):
        src = read_source(ASTEROIDS)
        self.assertIn("self._state_pub.tick(dt, {", src)

    def test_all_existing_pong_fields_preserved(self):
        src = read_source(PONG)
        for field in ("gameId", "phase", "score", "secondaryScore",
                      "playerPosition", "actionReady", "ballSpeed",
                      "initialBallSpeed", "maxBallSpeed", "rallyCount",
                      "currentRally", "longestRally", "rallyTier",
                      "powerupType", "aiShrinkActive", "aiShrinkRemainingMs",
                      "aiDifficulty"):
            self.assertIn(f'"{field}"', src, f"Missing field: {field}")

    def test_all_existing_breakout_fields_preserved(self):
        src = read_source(BREAKOUT)
        for field in ("gameId", "phase", "score", "playerPosition",
                      "ballLaunched", "lives", "actionReady", "stage",
                      "maxStage", "ballsActive", "ballSpeeds",
                      "underlyingBallSpeed", "effectiveBallSpeed",
                      "initialBallSpeed", "maxBallSpeed", "bricksRemaining",
                      "standardBricksRemaining", "reinforcedBricksRemaining",
                      "powderKegsRemaining", "treasureBricksRemaining",
                      "fallingPickupCount", "lastPickupType",
                      "widePaddleActive", "widePaddleRemainingMs",
                      "slowMotionActive", "slowMotionRemainingMs",
                      "stageTransitionActive"):
            self.assertIn(f'"{field}"', src, f"Missing field: {field}")

    def test_all_existing_asteroids_fields_preserved(self):
        src = read_source(ASTEROIDS)
        for field in ("gameId", "phase", "score", "lives",
                      "playerPosition", "secondaryPosition",
                      "projectileCount", "actionReady", "shipAngle",
                      "shipSpeed"):
            self.assertIn(f'"{field}"', src, f"Missing field: {field}")


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
