"""
Pirate Arcade — Runtime Contract Tests

Verifies that each Pygbag game's production class can be imported,
instantiated, updated, and drawn without crashing.

Uses PA_GAME_ID environment variable to select which game to test.
The runner sets this before launching this file in each game's
isolated subprocess.

FAILS IMMEDIATELY if the expected import fails — no try/except suppression.
"""

import os
import sys
import unittest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame as pg

GAME_ID = os.environ.get("PA_GAME_ID", "")
if not GAME_ID:
    raise RuntimeError(
        "PA_GAME_ID environment variable not set. "
        "Run through scripts/run-python-game-tests.py which sets this."
    )


class _MockAudio:
    def play(self, *a, **kw):
        pass
    muted = False

    def set_music_volume(self, *a, **kw):
        pass


def _init_pg():
    import builtins
    builtins.__dict__["__pa_page_visible__"] = True
    pg.font.init()
    pg.display.set_mode((1, 1))


# ── Cannonball Clash ──────────────────────────────────────────────

if GAME_ID == "cannonball-clash":
    _init_pg()
    from games.pong.game import PongGame
    import constants as c

    class TestCannonballContract(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.surface = pg.Surface((1600, 900))
            cls.game = PongGame(cls.surface, _MockAudio())

        def setUp(self):
            self.game.state = "menu"
            self.game.game_over_state = None
            self.game.paused = False

        def test_instantiate(self):
            self.assertIsNotNone(self.game)

        def test_expected_class(self):
            self.assertIs(type(self.game), PongGame)

        def test_state_menu(self):
            self.assertEqual(self.game.state, "menu")

        def test_update_no_crash(self):
            self.game.state = "playing"
            for _ in range(10):
                self.game._update(1 / 60)

        def test_draw_no_crash(self):
            self.game.state = "playing"
            self.game._draw(60)

        def test_game_over_draw(self):
            self.game.state = "game_over"
            self.game._draw(60)

        def test_pause_draw(self):
            self.game.state = "playing"
            self.game.paused = True
            self.game._draw(60)

        def test_ball_launch_sets_speed(self):
            from games.pong.ball import Ball
            b = Ball()
            b.reset()
            b.launch()
            self.assertGreater(b.speed, 0)


# ── Treasure Cove ─────────────────────────────────────────────────

if GAME_ID == "treasure-cove":
    _init_pg()
    from games.breakout.game import BreakoutGame
    import constants as c

    class TestTreasureCoveContract(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.surface = pg.Surface((1600, 900))
            cls.game = BreakoutGame(cls.surface, _MockAudio())

        def setUp(self):
            self.game.state = "menu"
            self.game.game_over_state = None
            self.game.paused = False

        def test_instantiate(self):
            self.assertIsNotNone(self.game)

        def test_expected_class(self):
            self.assertIs(type(self.game), BreakoutGame)

        def test_state_menu(self):
            self.assertEqual(self.game.state, "menu")

        def test_update_no_crash(self):
            self.game.state = "playing"
            self.game.gameplay.reset()
            for _ in range(10):
                self.game._update(1 / 60)

        def test_draw_no_crash(self):
            self.game.state = "playing"
            self.game.gameplay.reset()
            self.game._draw(60)

        def test_game_over_draw(self):
            self.game.state = "game_over"
            self.game.gameplay.reset()
            self.game._draw(60)

        def test_pause_draw(self):
            self.game.state = "playing"
            self.game.paused = True
            self.game._draw(60)

        def test_ball_rect_exists(self):
            from games.breakout.ball import Ball
            b = Ball()
            r = b.rect
            self.assertIsNotNone(r)
            self.assertEqual(r.width, b.radius * 2)
            self.assertEqual(r.height, b.radius * 2)

        def test_paddle_movement(self):
            from games.breakout.paddle import Paddle
            p = Paddle(800, 800)
            p.vx = c.PADDLE_BREAKOUT_SPEED
            x_before = p.x
            p.update(1 / 60)
            self.assertGreater(p.x, x_before)

        def test_stage_speeds(self):
            gp = self.game.gameplay
            gp.stage = 1
            self.assertEqual(gp._get_stage_speed(), 650)
            gp.stage = 2
            self.assertEqual(gp._get_stage_speed(), 700)
            gp.stage = 3
            self.assertEqual(gp._get_stage_speed(), 750)

        def test_brick_count_positive(self):
            gp = self.game.gameplay
            total = (
                gp.standard_count
                + gp.reinforced_count
                + gp.powder_keg_count
                + gp.treasure_count
            )
            self.assertGreater(total, 0)
            self.assertEqual(total, gp.remaining_bricks)


# ── Kraken's Wake ─────────────────────────────────────────────────

if GAME_ID == "krakens-wake":
    _init_pg()
    from games.asteroids.game import AsteroidsGame
    import constants as c

    class TestKrakensWakeContract(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.surface = pg.Surface((1600, 900))
            cls.game = AsteroidsGame(cls.surface, _MockAudio())

        def setUp(self):
            self.game.state = "menu"
            self.game.game_over_state = None
            self.game.paused = False

        def test_instantiate(self):
            self.assertIsNotNone(self.game)

        def test_expected_class(self):
            self.assertIs(type(self.game), AsteroidsGame)

        def test_state_menu(self):
            self.assertEqual(self.game.state, "menu")

        def test_update_no_crash(self):
            self.game.state = "playing"
            for _ in range(10):
                self.game._update(1 / 60)

        def test_draw_no_crash(self):
            self.game.state = "playing"
            self.game._draw(60)

        def test_game_over_draw(self):
            self.game.state = "game_over"
            self.game._draw(60)

        def test_pause_draw(self):
            self.game.state = "playing"
            self.game.paused = True
            self.game._draw(60)


if GAME_ID not in ("cannonball-clash", "treasure-cove", "krakens-wake"):
    raise RuntimeError(f"Unknown PA_GAME_ID: {GAME_ID!r}")

if __name__ == "__main__":
    unittest.main()
