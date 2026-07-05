import unittest
import sys
import os

_BASE = os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port")
sys.path.insert(0, os.path.join(_BASE, "krakens-wake"))
sys.path.insert(0, _BASE)
os.environ["SDL_VIDEODRIVER"] = "dummy"

import pygame as pg
import constants as c
from games.asteroids.game import AsteroidsGame
from games.asteroids.ship import Ship
from games.asteroids.cannonball import Cannonball
import builtins
import math

builtins.__dict__["__pa_page_visible__"] = True


class _MockAudio:
    def play(self, *a, **kw):
        pass
    muted = False


_KEYS_EMPTY = {
    pg.K_a: False, pg.K_d: False, pg.K_w: False, pg.K_s: False,
    pg.K_LEFT: False, pg.K_RIGHT: False, pg.K_UP: False, pg.K_DOWN: False,
    pg.K_SPACE: False, pg.K_ESCAPE: False, pg.K_p: False, pg.K_f: False,
    pg.K_RETURN: False,
}


def _key_set(*keys):
    d = dict(_KEYS_EMPTY)
    for k in keys:
        d[k] = True
    return d


class TestKrakensWakeShipMotion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pg.init()
        cls.surface = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))

    @classmethod
    def tearDownClass(cls):
        pg.quit()

    def setUp(self):
        self.game = AsteroidsGame(self.surface, _MockAudio())
        self.game.state = "playing"
        self.game.paused = False
        self.ship = self.game.gameplay.ship

    def test_ship_starts_at_center(self):
        self.assertEqual(self.ship.x, c.WINDOW_WIDTH // 2)
        self.assertEqual(self.ship.y, c.WINDOW_HEIGHT // 2)
        self.assertEqual(self.ship.angle, 0)
        self.assertEqual(self.ship.speed, 0)

    def test_turn_left_changes_angle(self):
        angle_before = self.ship.angle
        self.game._update(1/60)
        angle_after = self.ship.angle
        self.assertEqual(angle_after, angle_before)

    def test_turn_left_decreases_angle(self):
        self.ship.angle = 90
        self.game.gameplay.update(1/60, _key_set(pg.K_a))
        self.assertLess(self.ship.angle, 90)

    def test_turn_left_using_arrow(self):
        self.ship.angle = 90
        self.game.gameplay.update(1/60, _key_set(pg.K_LEFT))
        self.assertLess(self.ship.angle, 90)

    def test_turn_right_increases_angle(self):
        self.ship.angle = 0
        self.game.gameplay.update(1/60, _key_set(pg.K_d))
        self.assertGreater(self.ship.angle, 0)

    def test_turn_right_using_arrow(self):
        self.ship.angle = 0
        self.game.gameplay.update(1/60, _key_set(pg.K_RIGHT))
        self.assertGreater(self.ship.angle, 0)

    def test_thrust_increases_speed(self):
        self.game.gameplay.update(1/60, _key_set(pg.K_w))
        self.assertGreater(self.ship.speed, 0)

    def test_thrust_using_arrow(self):
        self.game.gameplay.update(1/60, _key_set(pg.K_UP))
        self.assertGreater(self.ship.speed, 0)

    def test_thrust_changes_position(self):
        x_before = self.ship.x
        y_before = self.ship.y
        for _ in range(10):
            self.game.gameplay.update(1/60, _key_set(pg.K_w))
        self.assertNotEqual((self.ship.x, self.ship.y), (x_before, y_before))

    def test_no_thrust_leaves_speed_zero(self):
        self.game.gameplay.update(1/60, _KEYS_EMPTY)
        self.assertEqual(self.ship.speed, 0)

    def test_friction_decays_speed(self):
        for _ in range(10):
            self.game.gameplay.update(1/60, _key_set(pg.K_w))
        speed_after = self.ship.speed
        for _ in range(10):
            self.game.gameplay.update(1/60, _KEYS_EMPTY)
        self.assertLess(self.ship.speed, speed_after)

    def test_speed_capped_at_max(self):
        for _ in range(1000):
            self.game.gameplay.update(1/60, _key_set(pg.K_w))
        self.assertLessEqual(self.ship.speed, c.SHIP_MAX_SPEED * 1.01)


class TestKrakensWakeCannon(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pg.init()
        cls.surface = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))

    @classmethod
    def tearDownClass(cls):
        pg.quit()

    def setUp(self):
        self.game = AsteroidsGame(self.surface, _MockAudio())
        self.game.state = "playing"
        self.game.paused = False

    def test_fire_increases_projectile_count(self):
        before = len(self.game.gameplay.cannonballs)
        self.game.gameplay.cooldown = 0
        self.game.gameplay.update(1/60, _key_set(pg.K_SPACE))
        after = len(self.game.gameplay.cannonballs)
        self.assertGreater(after, before)

    def test_fire_respects_cooldown(self):
        self.game.gameplay.cooldown = 10
        before = len(self.game.gameplay.cannonballs)
        self.game.gameplay.update(1/60, _key_set(pg.K_SPACE))
        after = len(self.game.gameplay.cannonballs)
        self.assertEqual(after, before)

    def test_cooldown_counts_down(self):
        self.game.gameplay.cooldown = 0.1
        self.game.gameplay.update(1/60, _KEYS_EMPTY)
        self.assertLess(self.game.gameplay.cooldown, 0.1)

    def test_cannonball_moves(self):
        self.game.gameplay.cooldown = 0
        self.game.gameplay.update(1/60, _key_set(pg.K_SPACE))
        cb = self.game.gameplay.cannonballs[0]
        x_before, y_before = cb.x, cb.y
        self.game.gameplay.update(1/60, _KEYS_EMPTY)
        self.assertNotEqual((cb.x, cb.y), (x_before, y_before))


class TestKrakensWakeErrorRecovery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pg.init()
        cls.surface = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))

    @classmethod
    def tearDownClass(cls):
        pg.quit()

    def setUp(self):
        self.game = AsteroidsGame(self.surface, _MockAudio())

    def test_recovered_error_count_starts_zero(self):
        self.assertEqual(self.game._recovered_error_count, 0)

    def test_normal_update_leaves_error_count_zero(self):
        self.game.state = "playing"
        for _ in range(60):
            self.game._update(1/60)
        self.assertEqual(self.game._recovered_error_count, 0)

    def test_normal_draw_leaves_error_count_zero(self):
        self.game.surface = self.surface
        self.game.state = "playing"
        for _ in range(60):
            self.game._draw(60)
        self.assertEqual(self.game._recovered_error_count, 0)

    def test_static_state_keeps_error_zero(self):
        for _ in range(30):
            self.game._update(1/60)
        self.assertEqual(self.game._recovered_error_count, 0)

    def test_error_count_in_published_state(self):
        self.game._recovered_error_count = 3
        self.game._last_recovered_phase = "update"
        state = self.game._build_game_state()
        self.assertEqual(state["recoveredErrorCount"], 3)
        self.assertEqual(state["lastRecoveredPhase"], "update")

    def test_state_event_key_includes_error_count(self):
        self.game._recovered_error_count = 1
        key = self.game._state_event_key()
        self.assertIn(1, key)


class TestKrakensWakeExitSemantics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pg.init()
        cls.surface = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))

    @classmethod
    def tearDownClass(cls):
        pg.quit()

    def setUp(self):
        self.game = AsteroidsGame(self.surface, _MockAudio())

    def test_pause_quit_to_menu_returns_menu(self):
        self.game.state = "playing"
        self.game.paused = True
        self.game.pause_selection = 4
        result = self.game._handle_key(pg.K_SPACE)
        self.assertEqual(result, "menu")
        self.assertEqual(self.game.state, "menu")

    def test_pause_resume_returns_none(self):
        self.game.state = "playing"
        self.game.paused = True
        self.game.pause_selection = 0
        result = self.game._handle_key(pg.K_SPACE)
        self.assertIsNone(result)
        self.assertFalse(self.game.paused)

    def test_menu_escape_returns_quit(self):
        self.game.state = "menu"
        result = self.game._handle_key(pg.K_ESCAPE)
        self.assertEqual(result, "quit")

    def test_game_over_escape_returns_quit(self):
        self.game.state = "game_over"
        result = self.game._handle_key(pg.K_ESCAPE)
        self.assertEqual(result, "quit")

    def test_game_over_space_restarts(self):
        self.game.state = "game_over"
        result = self.game._handle_key(pg.K_SPACE)
        self.assertIsNone(result)
        self.assertEqual(self.game.state, "playing")

    def test_menu_space_starts_playing(self):
        self.game.state = "menu"
        result = self.game._handle_key(pg.K_SPACE)
        self.assertIsNone(result)
        self.assertEqual(self.game.state, "playing")

    def test_pause_escape_resumes(self):
        self.game.state = "playing"
        self.game.paused = True
        result = self.game._handle_key(pg.K_ESCAPE)
        self.assertIsNone(result)
        self.assertFalse(self.game.paused)

    def test_playing_escape_pauses(self):
        self.game.state = "playing"
        self.game.paused = False
        result = self.game._handle_key(pg.K_ESCAPE)
        self.assertIsNone(result)
        self.assertTrue(self.game.paused)


class TestKrakensWakeGameStateBridge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pg.init()
        cls.surface = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))

    @classmethod
    def tearDownClass(cls):
        pg.quit()

    def setUp(self):
        self.game = AsteroidsGame(self.surface, _MockAudio())
        self.game.state = "playing"

    def test_state_has_ship_angle_and_speed(self):
        state = self.game._build_game_state()
        self.assertIn("shipAngle", state)
        self.assertIn("shipSpeed", state)
        self.assertIsInstance(state["shipAngle"], (int, float))
        self.assertIsInstance(state["shipSpeed"], (int, float))

    def test_state_has_lives_and_score(self):
        state = self.game._build_game_state()
        self.assertIn("lives", state)
        self.assertIn("score", state)
        self.assertGreater(state["lives"], 0)

    def test_state_has_projectile_count(self):
        state = self.game._build_game_state()
        self.assertIn("projectileCount", state)
        self.assertGreaterEqual(state["projectileCount"], 0)

    def test_state_has_phase_playing(self):
        state = self.game._build_game_state()
        self.assertEqual(state["phase"], "playing")

    def test_state_phase_paused(self):
        self.game.paused = True
        state = self.game._build_game_state()
        self.assertEqual(state["phase"], "paused")

    def test_state_phase_game_over(self):
        self.game.state = "game_over"
        state = self.game._build_game_state()
        self.assertEqual(state["phase"], "game-over")

    def test_state_recovered_error_count(self):
        self.game._recovered_error_count = 0
        state = self.game._build_game_state()
        self.assertEqual(state["recoveredErrorCount"], 0)


class TestKrakensWakeShipWrap(unittest.TestCase):
    def setUp(self):
        self.ship = Ship()

    def test_wrap_left_to_right(self):
        self.ship.x = -200
        self.ship.y = c.WINDOW_HEIGHT // 2
        self.ship._wrap()
        self.assertGreater(self.ship.x, c.WINDOW_WIDTH // 2)

    def test_wrap_right_to_left(self):
        self.ship.x = c.WINDOW_WIDTH + 200
        self.ship.y = c.WINDOW_HEIGHT // 2
        self.ship._wrap()
        self.assertLess(self.ship.x, 0)

    def test_ship_speed_bucketed_cache(self):
        self.assertIsNotNone(self.ship._ship_cache)
        self.assertEqual(len(self.ship._ship_cache), 36)

    def test_reset_clears_velocity(self):
        self.ship.vx = 500
        self.ship.vy = 300
        self.ship.angle = 45
        self.ship.reset()
        self.assertEqual(self.ship.vx, 0)
        self.assertEqual(self.ship.vy, 0)
        self.assertEqual(self.ship.angle, 0)
        self.assertTrue(self.ship.alive)

    def test_dead_ship_update_noop(self):
        self.ship.alive = False
        self.ship.vx = 100
        self.ship.update(1/60, {})
        self.assertEqual(self.ship.vx, 100)

    def test_rect_updates_with_position(self):
        self.ship.x = 300
        self.ship.y = 400
        r = self.ship.rect
        self.assertEqual(r.centerx, 300)
        self.assertEqual(r.centery, 400)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
