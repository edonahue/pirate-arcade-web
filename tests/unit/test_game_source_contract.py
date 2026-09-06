import unittest
import re
import os
import sys
import ast

REPO = os.path.normpath(os.path.join(os.path.dirname(__file__), "../.."))
PONG = os.path.join(REPO, "scripts/pygbag-port/cannonball-clash/games/pong/game.py")
BREAKOUT = os.path.join(REPO, "scripts/pygbag-port/treasure-cove/games/breakout/game.py")
ASTEROIDS = os.path.join(REPO, "scripts/pygbag-port/krakens-wake/games/asteroids/game.py")


def read_source(path):
    with open(path) as f:
        return f.read()


def parse_ast(path):
    return ast.parse(read_source(path))


class TestGameSourceContract(unittest.TestCase):

    # ── Ownership assertions (string-based, narrow) ──

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

    # ── Field presence in _build_game_state ──

    def test_pong_state_has_required_fields(self):
        src = read_source(PONG)
        for field in ("gameId", "phase", "score", "secondaryScore",
                       "playerPosition", "actionReady", "ballSpeed",
                       "initialBallSpeed", "maxBallSpeed", "rallyCount",
                       "currentRally", "longestRally", "rallyTier",
                       "powerupType", "aiShrinkActive", "aiShrinkRemainingMs",
                       "aiDifficulty", "bestRally", "newBest",
                       "playerPaddleHeight", "ballX", "ballY"):
            self.assertIn(f'"{field}"', src, f"Missing field: {field}")

    def test_breakout_state_has_required_fields(self):
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
                        "stageTransitionActive", "bestScore", "newBest",
                        "lastBreachSize"):
            self.assertIn(f'"{field}"', src, f"Missing field: {field}")

    def test_asteroids_state_has_required_fields(self):
        src = read_source(ASTEROIDS)
        for field in ("gameId", "phase", "score", "lives",
                       "playerPosition", "secondaryPosition",
                       "projectileCount", "actionReady", "shipAngle",
                       "shipSpeed", "bestScore", "newBest",
                       "bossActive", "bossPhase", "bossHp", "bossMaxHp",
                       "bossX", "bossY", "wave"):
            self.assertIn(f'"{field}"', src, f"Missing field: {field}")

    # ── New API pattern ──

    def test_pong_uses_tick_with_event_key_and_factory(self):
        src = read_source(PONG)
        self.assertIn("self._state_pub.tick(", src)
        self.assertIn("state_factory=self._build_game_state", src)
        self.assertIn("event_key=self._state_event_key()", src)
        self.assertIn("active=", src)

    def test_breakout_uses_tick_with_event_key_and_factory(self):
        src = read_source(BREAKOUT)
        self.assertIn("self._state_pub.tick(", src)
        self.assertIn("state_factory=self._build_game_state", src)
        self.assertIn("event_key=self._state_event_key()", src)
        self.assertIn("active=", src)

    def test_asteroids_uses_tick_with_event_key_and_factory(self):
        src = read_source(ASTEROIDS)
        self.assertIn("self._state_pub.tick(", src)
        self.assertIn("state_factory=self._build_game_state", src)
        self.assertIn("event_key=self._state_event_key()", src)
        self.assertIn("active=", src)

    def test_pong_has_state_event_key_method(self):
        src = read_source(PONG)
        self.assertIn("def _state_event_key", src)

    def test_breakout_has_state_event_key_method(self):
        src = read_source(BREAKOUT)
        self.assertIn("def _state_event_key", src)

    def test_asteroids_has_state_event_key_method(self):
        src = read_source(ASTEROIDS)
        self.assertIn("def _state_event_key", src)

    def test_pong_has_build_game_state_method(self):
        src = read_source(PONG)
        self.assertIn("def _build_game_state", src)

    def test_breakout_has_build_game_state_method(self):
        src = read_source(BREAKOUT)
        self.assertIn("def _build_game_state", src)

    def test_asteroids_has_build_game_state_method(self):
        src = read_source(ASTEROIDS)
        self.assertIn("def _build_game_state", src)

    # ── State factory is not called directly in _update ──
    # _build_game_state should only appear as a reference (state_factory=...),
    # not called directly with _build_game_state() in _update.

    def test_pong_build_game_state_not_called_directly_in_update(self):
        """_build_game_state() should not be called as a function in _update."""
        src = read_source(PONG)
        update_src = self._extract_method(src, "_update")
        # Find lines that call _build_game_state() but not as state_factory=
        for line in update_src.split("\n"):
            stripped = line.strip()
            if "_build_game_state()" in stripped and "state_factory=" not in stripped:
                self.fail(f"_build_game_state() called directly in _update: {line}")

    def test_breakout_build_game_state_not_called_directly_in_update(self):
        src = read_source(BREAKOUT)
        update_src = self._extract_method(src, "_update")
        for line in update_src.split("\n"):
            stripped = line.strip()
            if "_build_game_state()" in stripped and "state_factory=" not in stripped:
                self.fail(f"_build_game_state() called directly in _update: {line}")

    def test_asteroids_build_game_state_not_called_directly_in_update(self):
        src = read_source(ASTEROIDS)
        update_src = self._extract_method(src, "_update")
        for line in update_src.split("\n"):
            stripped = line.strip()
            if "_build_game_state()" in stripped and "state_factory=" not in stripped:
                self.fail(f"_build_game_state() called directly in _update: {line}")

    @staticmethod
    def _extract_method(src, method_name):
        """Extract the source of a method by finding its def and tracking indentation."""
        lines = src.split("\n")
        for i, line in enumerate(lines):
            if re.match(rf"\s+def {method_name}\(", line):
                base_indent = len(line) - len(line.lstrip())
                method_lines = []
                j = i
                while j < len(lines):
                    if j > i and lines[j].strip() and len(lines[j]) - len(lines[j].lstrip()) <= base_indent:
                        break
                    method_lines.append(lines[j])
                    j += 1
                return "\n".join(method_lines)
        return ""

    # ── Behavioral: event keys exclude continuous values ──

    def test_pong_event_key_excludes_continuous_values(self):
        """Event key should NOT contain paddle position, ball speed, or timer ms."""
        src = read_source(PONG)
        ekey_src = self._extract_method(src, "_state_event_key")
        for banned in (".y", ".speed", "RemainingMs", ".paddle"):
            self.assertNotIn(banned, ekey_src, f"Event key should not contain: {banned}")

    def test_breakout_event_key_excludes_continuous_values(self):
        """Event key should NOT contain paddle position, ball speed arrays, timer ms."""
        src = read_source(BREAKOUT)
        ekey_src = self._extract_method(src, "_state_event_key")
        for banned in (".x", ".speed", "RemainingMs", "ballSpeeds", "ballsActive"):
            self.assertNotIn(banned, ekey_src, f"Event key should not contain: {banned}")

    def test_asteroids_event_key_excludes_continuous_values(self):
        """Event key should NOT contain ship position, angle, speed, projectile count."""
        src = read_source(ASTEROIDS)
        ekey_src = self._extract_method(src, "_state_event_key")
        for banned in (".x", ".y", ".angle", ".speed", "projectileCount", "cannonballs"):
            self.assertNotIn(banned, ekey_src, f"Event key should not contain: {banned}")

    # ── Events in state but not in update loop ──
    # Pre-tick state-reporting scans should not exist in _update

    def test_breakout_no_state_scans_in_update(self):
        """Breakout _update should not contain pre-tick ball scans."""
        src = read_source(BREAKOUT)
        update_src = self._extract_method(src, "_update")
        for banned in ("active_balls", "effective_speed", "underlying_speed",
                       "sum(1 for", "max((b."):
            self.assertNotIn(banned, update_src,
                             f"State-reporting scan should not be in _update: {banned}")

    # ── Breakout dead vars ──

    def test_breakout_no_primary_ball(self):
        src = read_source(BREAKOUT)
        self.assertNotIn("primary_ball", src)

    def test_breakout_no_launched_count(self):
        src = read_source(BREAKOUT)
        self.assertNotIn("launched_count", src)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
