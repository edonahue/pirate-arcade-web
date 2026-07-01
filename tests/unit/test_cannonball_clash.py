import unittest
import sys
import os

_BASE = os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port")
sys.path.insert(0, os.path.join(_BASE, "cannonball-clash"))
sys.path.insert(0, _BASE)
os.environ["SDL_VIDEODRIVER"] = "dummy"

import pygame as pg
import constants as c
from games.pong.ball import Ball
from games.pong.paddle import Paddle
from games.pong.gameplay import Gameplay, _segment_intersects_rect
from games.pong.game import PongGame
import builtins

builtins.__dict__["__pa_page_visible__"] = True

pg.font.init()
pg.display.set_mode((1, 1))


class _MockAudio:
    def play(self, *a, **kw):
        pass
    muted = False


class TestBallSplit(unittest.TestCase):
    def test_reset_centers_with_zero_velocity(self):
        b = Ball()
        b.reset()
        self.assertEqual(b.x, c.WINDOW_WIDTH // 2)
        self.assertEqual(b.y, c.WINDOW_HEIGHT // 2)
        self.assertEqual(b.vx, 0)
        self.assertEqual(b.vy, 0)
        self.assertEqual(b.speed, 0)

    def test_launch_sets_velocity_and_speed(self):
        b = Ball()
        b.reset()
        b.launch()
        self.assertGreater(b.speed, 0)
        self.assertNotEqual(b.vx, 0)
        self.assertNotEqual(b.vy, 0)
        self.assertEqual(b.speed, c.BALL_SPEED_INITIAL)

    def test_launch_direction_is_valid(self):
        b = Ball()
        for _ in range(50):
            b.reset()
            b.launch()
            speed = (b.vx ** 2 + b.vy ** 2) ** 0.5
            self.assertAlmostEqual(speed, c.BALL_SPEED_INITIAL, delta=1)
            self.assertLessEqual(abs(b.vy / b.vx) if b.vx != 0 else 99, 0.58)

    def test_reset_clears_last_hit_by(self):
        b = Ball()
        b.reset()
        b.last_hit_by = 'player'
        b.reset()
        self.assertIsNone(b.last_hit_by)

    def test_reset_tracks_prev_position(self):
        b = Ball()
        b.reset()
        self.assertEqual(b.px, b.x)
        self.assertEqual(b.py, b.y)


class TestPointTransitionTimer(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_timer_starts_at_zero(self):
        self.assertEqual(self.gp.point_transition_timer, 0.0)
        self.assertIsNone(self.gp.point_callout)

    def test_timer_set_on_score(self):
        self.gp.ball.x = c.WINDOW_WIDTH + c.BALL_SIZE + 1
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertGreater(self.gp.point_transition_timer, 0)
        self.assertEqual(self.gp.point_callout, 'HIT!')

    def test_timer_counts_down(self):
        self.gp.point_transition_timer = c.POINT_PAUSE_DURATION
        self.gp.point_callout = 'HIT!'
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertLess(self.gp.point_transition_timer, c.POINT_PAUSE_DURATION)

    def test_timer_expiry_resets_round(self):
        self.gp.rally_count = 10
        self.gp.point_transition_timer = 0.01
        self.gp.point_callout = 'HIT!'
        dt = 0.02
        self.gp.update(dt, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertEqual(self.gp.point_transition_timer, 0.0)
        self.assertIsNone(self.gp.point_callout)
        self.assertGreater(self.gp.ball.speed, 0)

    def test_no_input_during_transition(self):
        self.gp.player_paddle.y = 100
        self.gp.point_transition_timer = 0.5
        self.gp.update(1/60, {pg.K_w: True, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertEqual(self.gp.player_paddle.y, 100)

    def test_reset_clears_transition(self):
        self.gp.point_transition_timer = 0.5
        self.gp.point_callout = 'HIT!'
        self.gp.reset()
        self.assertEqual(self.gp.point_transition_timer, 0.0)
        self.assertIsNone(self.gp.point_callout)

    def test_reset_round_clears_transition(self):
        self.gp.point_transition_timer = 0.5
        self.gp.point_callout = 'HIT!'
        self.gp.reset_round()
        self.assertEqual(self.gp.point_transition_timer, 0.0)
        self.assertIsNone(self.gp.point_callout)


class TestRallyResetOnPoint(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_rally_tier_resets_on_round(self):
        self.gp.rally_tier = 10
        self.gp.reset_round()
        self.assertEqual(self.gp.rally_tier, 0)

    def test_rally_count_resets_on_round(self):
        self.gp.rally_count = 15
        self.gp.reset_round()
        self.assertEqual(self.gp.rally_count, 0)

    def test_rally_callout_cleared_on_round(self):
        self.gp.rally_callout_text = "CANNONBALL FEVER"
        self.gp.rally_callout_surf = "mock"
        self.gp.rally_callout_timer = 1.0
        self.gp.reset_round()
        self.assertIsNone(self.gp.rally_callout_text)
        self.assertIsNone(self.gp.rally_callout_surf)
        self.assertEqual(self.gp.rally_callout_timer, 0.0)

    def test_longest_rally_preserved_on_round(self):
        self.gp.longest_rally = 20
        self.gp.rally_count = 15
        self.gp.reset_round()
        self.assertEqual(self.gp.longest_rally, 20)

    def test_ball_tier_resets_on_round(self):
        self.gp.ball.set_rally_tier(10)
        self.gp.reset_round()
        self.assertEqual(self.gp.ball.rally_tier, 0)


class TestPowerupSpawnTimer(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_timer_not_reset_on_paddle_hit(self):
        self.gp.powerup_spawn_timer = 2.0
        self.gp.player_paddle.x = c.PADDLE_MARGIN
        self.gp.player_paddle.y = c.WINDOW_HEIGHT // 2
        self.gp.ball.x = self.gp.player_paddle.x + c.PADDLE_WIDTH // 2 + c.BALL_SIZE // 2
        self.gp.ball.y = self.gp.player_paddle.y
        self.gp.ball.vx = 500
        self.gp.ball.speed = 500
        self.gp.ball.update(1/60)
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertLess(self.gp.powerup_spawn_timer, 2.0)

    def test_timer_resets_on_powerup_collect(self):
        from games.pong.powerup import PowerUp
        self.gp.powerup = PowerUp(c.POWERUP_TYPE_LARGE_PADDLE)
        self.gp.powerup.x = self.gp.player_paddle.x + 1
        self.gp.powerup.y = self.gp.player_paddle.y
        self.gp.powerup_spawn_timer = 1.0
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertAlmostEqual(self.gp.powerup_spawn_timer, c.POWERUP_SPAWN_INTERVAL, delta=0.1)

    def test_single_powerup_at_a_time(self):
        from games.pong.powerup import PowerUp
        self.gp.powerup = PowerUp(c.POWERUP_TYPE_CURSED_POWDER)
        self.gp.powerup_spawn_timer = -1
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertIsNotNone(self.gp.powerup)


class TestActiveAnimation(unittest.TestCase):
    def setUp(self):
        self.game = PongGame(None, _MockAudio())

    def test_flag_starts_false(self):
        self.assertFalse(self.game._active_animation)

    def test_flag_true_on_game_over(self):
        self.game.state = 'playing'
        self.game.gameplay.player_score = 11
        self.game.gameplay.ai_score = 9
        self.game._update(1/60)
        if self.game.state == 'game_over':
            self.assertTrue(self.game._active_animation)

    def test_flag_false_after_animation_duration(self):
        self.game.state = 'game_over'
        self.game.game_over_state = 'player'
        self.game._active_animation = True
        self.game.game_over_timer = c.WIN_ANIMATION_DURATION
        self.game._update(1/60)
        self.assertFalse(self.game._active_animation)

    def test_flag_reset_on_restart(self):
        self.game._active_animation = True
        self.game.state = 'game_over'
        result = self.game._handle_key(pg.K_SPACE)
        self.assertFalse(self.game._active_animation)


class TestSegmentIntersectsRect(unittest.TestCase):
    def test_direct_intersection(self):
        rect = pg.Rect(100, 100, 50, 50)
        self.assertTrue(_segment_intersects_rect(50, 125, 200, 125, rect))

    def test_no_intersection(self):
        rect = pg.Rect(100, 100, 50, 50)
        self.assertFalse(_segment_intersects_rect(0, 0, 50, 50, rect))

    def test_point_inside(self):
        rect = pg.Rect(100, 100, 50, 50)
        self.assertTrue(_segment_intersects_rect(120, 120, 120, 120, rect))

    def test_grabs_corner(self):
        rect = pg.Rect(100, 100, 50, 50)
        self.assertTrue(_segment_intersects_rect(50, 50, 150, 150, rect))

    def test_tangent_along_edge(self):
        rect = pg.Rect(100, 100, 50, 50)
        self.assertTrue(_segment_intersects_rect(100, 75, 100, 150, rect))

    def test_vertical_miss(self):
        rect = pg.Rect(100, 100, 50, 50)
        self.assertFalse(_segment_intersects_rect(200, 75, 200, 150, rect))

    def test_horizontal_miss(self):
        rect = pg.Rect(100, 100, 50, 50)
        self.assertFalse(_segment_intersects_rect(75, 200, 150, 200, rect))


class TestPaddleRecoil(unittest.TestCase):
    def test_recoil_sets_timer(self):
        p = Paddle(200, 300, side='left')
        p.trigger_recoil()
        self.assertGreater(p._recoil_timer, 0)
        self.assertNotEqual(p._recoil_nudge, 0)

    def test_recoil_direction_player(self):
        p = Paddle(200, 300, side='left')
        p.trigger_recoil()
        self.assertEqual(p._recoil_nudge, -6)

    def test_recoil_direction_ai(self):
        p = Paddle(200, 300, side='right')
        p.trigger_recoil()
        self.assertEqual(p._recoil_nudge, 6)

    def test_recoil_fades(self):
        p = Paddle(200, 300, side='left')
        p.trigger_recoil()
        p._recoil_timer = 0.001
        p.update(0.01)
        self.assertEqual(p._recoil_nudge, 0)

    def test_reset_clears_recoil(self):
        p = Paddle(200, 300, side='left')
        p.trigger_recoil()
        p.reset()
        self.assertEqual(p._recoil_timer, 0.0)
        self.assertEqual(p._recoil_nudge, 0)
        self.assertEqual(p._muzzle_flash_timer, 0.0)

    def test_muzzle_flash_sets_timer(self):
        p = Paddle(200, 300, side='left')
        p.trigger_recoil()
        self.assertGreater(p._muzzle_flash_timer, 0)


class TestArenaOverlay(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_overlays_built_for_all_tiers(self):
        for tier in c.RALLY_GLOW_TIERS:
            self.assertIn(tier, self.gp._tier_overlays)

    def test_overlay_not_used_at_tier_zero(self):
        self.gp.rally_tier = 0
        self.assertNotIn(0, self.gp._tier_overlays)

    def test_overlay_used_at_active_tier(self):
        self.gp.rally_tier = 5
        surf = self.gp._tier_overlays.get(5)
        self.assertIsNotNone(surf)
        self.assertEqual(surf.get_width(), c.WINDOW_WIDTH)
        self.assertEqual(surf.get_height(), c.WINDOW_HEIGHT)


class TestCachedTrailSurfaces(unittest.TestCase):
    def setUp(self):
        self.ball = Ball()

    def test_trail_surfs_exist(self):
        self.ball._build_trail_surfs(0)
        self.assertGreater(len(self.ball._trail_surfs), 0)

    def test_trail_surfs_cleared_on_rally_tier_change(self):
        self.ball.set_rally_tier(5)
        self.ball.set_rally_tier(0)
        self.assertEqual(self.ball.rally_tier, 0)

    def test_trail_surf_per_index(self):
        self.ball._build_trail_surfs(5)
        for i in range(c.RALLY_TRAIL_TIERS.get(5, 5)):
            self.assertIn(i, self.ball._trail_surfs)

    def test_trail_surf_cache_size(self):
        self.ball._build_trail_surfs(20)
        self.assertEqual(len(self.ball._trail_surfs), c.RALLY_TRAIL_TIERS[20])


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
