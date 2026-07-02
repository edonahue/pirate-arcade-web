"""
Pirate Arcade — Runtime Contract Tests

Verifies that each Pygbag game's production class can be imported,
instantiated, updated, and drawn without crashing.

Runs inside each game's isolated subprocess (set up by
run-python-game-tests.py).  Each subprocess has only its own game's
import path configured, so only the matching test class will
successfully import its game module.  A class that cannot import is
skipped gracefully.

This catches regressions such as missing Ball.rect, import failures,
and constructor crashes.
"""

import unittest
import os

os.environ["SDL_VIDEODRIVER"] = "dummy"
os.environ["SDL_AUDIODRIVER"] = "dummy"

import pygame as pg


class _MockAudio:
    def play(self, *a, **kw):
        pass
    muted = False


# ── Cannonball Clash ──────────────────────────────────────────────

try:
    from games.pong.game import PongGame
    import constants as c
    _CB = True
except ImportError:
    _CB = False

if _CB:
    import builtins
    builtins.__dict__["__pa_page_visible__"] = True
    pg.font.init()
    from games.pong.game import PongGame


    class TestCannonballContract(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.surface = pg.Surface((1600, 900))
            pg.display.set_mode((1, 1))

        def setUp(self):
            self.game = PongGame(self.surface, _MockAudio())

        def test_instantiate(self):
            self.assertIsNotNone(self.game)

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

try:
    from games.breakout.game import BreakoutGame
    import constants as c
    _TC = True
except ImportError:
    _TC = False

if _TC:
    import builtins
    builtins.__dict__["__pa_page_visible__"] = True
    pg.font.init()
    from games.breakout.game import BreakoutGame


    class TestTreasureCoveContract(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.surface = pg.Surface((1600, 900))
            pg.display.set_mode((1, 1))

        def setUp(self):
            self.game = BreakoutGame(self.surface, _MockAudio())

        def test_instantiate(self):
            self.assertIsNotNone(self.game)

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
            self.assertEqual(r.centerx, int(b.x))
            self.assertEqual(r.centery, int(b.y))

        def test_paddle_movement(self):
            from games.breakout.paddle import Paddle
            import constants as c
            p = Paddle(800, 800)
            p.vx = c.PADDLE_BREAKOUT_SPEED
            x_before = p.x
            p.update(1 / 60)
            self.assertGreater(p.x, x_before)

        def test_stage_speeds(self):
            gameplay = self.game.gameplay
            gameplay.stage = 1
            self.assertEqual(gameplay._get_stage_speed(), 650)
            gameplay.stage = 2
            self.assertEqual(gameplay._get_stage_speed(), 700)
            gameplay.stage = 3
            self.assertEqual(gameplay._get_stage_speed(), 750)

        def test_brick_count_positive(self):
            gameplay = self.game.gameplay
            total = (
                gameplay.standard_count
                + gameplay.reinforced_count
                + gameplay.powder_keg_count
                + gameplay.treasure_count
            )
            self.assertGreater(total, 0)
            self.assertEqual(total, gameplay.remaining_bricks)

# ── Kraken's Wake ─────────────────────────────────────────────────

try:
    from games.asteroids.game import AsteroidsGame
    import constants as c
    _KW = True
except ImportError:
    _KW = False

if _KW:
    import builtins
    builtins.__dict__["__pa_page_visible__"] = True
    pg.font.init()
    from games.asteroids.game import AsteroidsGame


    class TestKrakensWakeContract(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.surface = pg.Surface((1600, 900))
            pg.display.set_mode((1, 1))

        def setUp(self):
            self.game = AsteroidsGame(self.surface, _MockAudio())

        def test_instantiate(self):
            self.assertIsNotNone(self.game)

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


if __name__ == "__main__":
    unittest.main()
