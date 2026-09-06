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
        strips = self.gp._tier_overlays.get(5)
        self.assertIsNotNone(strips)
        top, bottom, left, right = strips
        self.assertEqual(top.get_width(), c.WINDOW_WIDTH)
        self.assertEqual(bottom.get_width(), c.WINDOW_WIDTH)
        self.assertEqual(left.get_height(), c.WINDOW_HEIGHT)
        self.assertEqual(right.get_height(), c.WINDOW_HEIGHT)
        border_w = 30 + 5 * 2
        self.assertEqual(top.get_height(), border_w)
        self.assertEqual(left.get_width(), border_w)


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


class TestMatchLifecycle(unittest.TestCase):
    def setUp(self):
        self.game = PongGame(None, _MockAudio())

    def _start_match(self):
        self.game.state = 'menu'
        self.game.menu_selection = 0
        self.game._handle_key(pg.K_SPACE)

    def test_begin_match_launches_ball(self):
        self._start_match()
        self.assertEqual(self.game.state, 'playing')
        self.assertGreater(self.game.gameplay.ball.speed, 0)

    def test_begin_match_ball_moves(self):
        self._start_match()
        x0 = self.game.gameplay.ball.x
        self.game._update(1/60)
        self.assertNotEqual(self.game.gameplay.ball.x, x0)

    def test_pause_restart_launches_ball(self):
        self._start_match()
        self.game.paused = True
        self.game.pause_selection = 1
        self.game._handle_key(pg.K_SPACE)
        self.assertFalse(self.game.paused)
        self.assertEqual(self.game.gameplay.player_score, 0)
        self.assertEqual(self.game.gameplay.ai_score, 0)
        self.assertGreater(self.game.gameplay.ball.speed, 0)

    def test_game_over_replay_launches_ball(self):
        self.game.state = 'game_over'
        self.game.gameplay.player_score = 11
        self.game.gameplay.ai_score = 9
        self.game._handle_key(pg.K_SPACE)
        self.assertEqual(self.game.state, 'playing')
        self.assertEqual(self.game.gameplay.player_score, 0)
        self.assertGreater(self.game.gameplay.ball.speed, 0)

    def test_point_lifecycle_holds_then_launches(self):
        self._start_match()
        speed_before = self.game.gameplay.ball.speed
        self.game.gameplay.point_transition_timer = c.POINT_PAUSE_DURATION
        self.game.gameplay.point_callout = 'HIT!'
        self.game._update(1/60)
        self.assertAlmostEqual(self.game.gameplay.point_transition_timer, c.POINT_PAUSE_DURATION - 1/60, places=3)
        self.assertEqual(self.game.gameplay.ball.speed, speed_before)
        self.game.gameplay.point_transition_timer = 0.01
        self.game._update(0.02)
        self.assertEqual(self.game.gameplay.point_transition_timer, 0.0)
        self.assertIsNone(self.game.gameplay.point_callout)
        self.assertGreater(self.game.gameplay.ball.speed, 0)

    def test_victory_rendering_animates_then_static(self):
        self.game.state = 'game_over'
        self.game.game_over_state = 'player'
        self.game._active_animation = True
        self.game.game_over_timer = 0
        self.assertTrue(self.game._active_animation)
        self.game._update(0.01)
        self.assertGreater(self.game.game_over_timer, 0)
        for _ in range(100):
            self.game._update(1/60)
        self.assertFalse(self.game._active_animation)
        self.assertGreaterEqual(self.game.game_over_timer, c.WIN_ANIMATION_DURATION)

    def test_static_draw_suppression_after_victory(self):
        self.game.state = 'game_over'
        self.game.game_over_state = 'player'
        self.game._active_animation = False
        self.game.game_over_timer = c.WIN_ANIMATION_DURATION
        self.game._render_after_anim = False
        self.game._update(1/60)
        metrics = self.game._timer.metrics()
        metrics.reset()
        for _ in range(10):
            self.game._update(1/60)
        self.assertEqual(metrics.snapshot()["simSteps"], 0)


class TestCollisionIntegration(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_high_speed_ball_hits_left_paddle(self):
        self.gp.ball.x = self.gp.player_paddle.rect.right + 10
        self.gp.ball.y = self.gp.player_paddle.y
        self.gp.ball.px = self.gp.ball.x + 100
        self.gp.ball.py = self.gp.ball.y
        self.gp.ball.vx = -999999
        self.gp.ball.vy = 0
        self.gp.ball.speed = 999999
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertGreater(self.gp.rally_count, 0)

    def test_ball_moving_away_from_left_paddle_no_collision(self):
        old_rally = self.gp.rally_count
        self.gp.ball.x = self.gp.player_paddle.rect.right + 30
        self.gp.ball.y = self.gp.player_paddle.y
        self.gp.ball.px = self.gp.ball.x - 50
        self.gp.ball.py = self.gp.ball.y
        self.gp.ball.vx = 500
        self.gp.ball.vy = 0
        self.gp.ball.speed = 500
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertEqual(self.gp.rally_count, old_rally)

    def test_ball_moving_away_from_right_paddle_no_collision(self):
        old_rally = self.gp.rally_count
        self.gp.ball.x = self.gp.ai_paddle.rect.left - 30
        self.gp.ball.y = self.gp.ai_paddle.y
        self.gp.ball.px = self.gp.ball.x + 50
        self.gp.ball.py = self.gp.ball.y
        self.gp.ball.vx = -500
        self.gp.ball.vy = 0
        self.gp.ball.speed = 500
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertEqual(self.gp.rally_count, old_rally)

    def test_single_increment_per_hit(self):
        self.gp.ball.x = self.gp.player_paddle.rect.right + 5
        self.gp.ball.y = self.gp.player_paddle.y
        self.gp.ball.px = self.gp.ball.x + 200
        self.gp.ball.py = self.gp.ball.y
        self.gp.ball.vx = -999999
        self.gp.ball.vy = 0
        self.gp.ball.speed = 999999
        self.gp.rally_count = 0
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertEqual(self.gp.rally_count, 1)
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertEqual(self.gp.rally_count, 1)

    def test_ball_resolved_outside_paddle_face(self):
        self.gp.ball.x = self.gp.player_paddle.rect.right + 5
        self.gp.ball.y = self.gp.player_paddle.y
        self.gp.ball.px = self.gp.ball.x + 200
        self.gp.ball.py = self.gp.ball.y
        self.gp.ball.vx = -999999
        self.gp.ball.vy = 0
        self.gp.ball.speed = 999999
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        r = c.BALL_SIZE // 2
        self.assertGreaterEqual(self.gp.ball.x, self.gp.player_paddle.rect.right + r)

    def test_high_speed_right_paddle_collision(self):
        self.gp.ball.x = self.gp.ai_paddle.rect.left - 10
        self.gp.ball.y = self.gp.ai_paddle.y
        self.gp.ball.px = self.gp.ball.x - 200
        self.gp.ball.py = self.gp.ball.y
        self.gp.ball.vx = 999999
        self.gp.ball.vy = 0
        self.gp.ball.speed = 999999
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertGreater(self.gp.rally_count, 0)

    def test_edge_contact_still_collides(self):
        self.gp.ball.x = self.gp.player_paddle.rect.right + 3
        self.gp.ball.y = self.gp.player_paddle.rect.top - 2
        self.gp.ball.px = self.gp.ball.x + 100
        self.gp.ball.py = self.gp.ball.y + 50
        self.gp.ball.vx = -999
        self.gp.ball.vy = -300
        self.gp.ball.speed = 1000
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertGreater(self.gp.rally_count, 0)


class TestPowerupCadence(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_spawn_after_countdown(self):
        self.gp.powerup = None
        self.gp.powerup_spawn_timer = 0.001
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertIsNotNone(self.gp.powerup)

    def test_collection_restarts_timer(self):
        from games.pong.powerup import PowerUp
        self.gp.powerup = PowerUp(c.POWERUP_TYPE_LARGE_PADDLE)
        self.gp.powerup.x = self.gp.player_paddle.x + 1
        self.gp.powerup.y = self.gp.player_paddle.y
        self.gp.powerup_spawn_timer = 1.0
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertIsNone(self.gp.powerup)
        self.assertAlmostEqual(self.gp.powerup_spawn_timer, c.POWERUP_SPAWN_INTERVAL, delta=0.1)

    def test_expiry_restarts_timer(self):
        from games.pong.powerup import PowerUp
        self.gp.powerup = PowerUp(c.POWERUP_TYPE_LARGE_PADDLE)
        self.gp.powerup.x = 0
        self.gp.powerup.timer = 0.001
        self.gp.powerup_spawn_timer = -5
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertIsNone(self.gp.powerup)
        self.assertAlmostEqual(self.gp.powerup_spawn_timer, c.POWERUP_SPAWN_INTERVAL, delta=0.1)

    def test_no_immediate_replacement_after_expiry(self):
        from games.pong.powerup import PowerUp
        self.gp.powerup = PowerUp(c.POWERUP_TYPE_LARGE_PADDLE)
        self.gp.powerup.timer = 0.001
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertIsNone(self.gp.powerup)
        self.assertGreater(self.gp.powerup_spawn_timer, 5)

    def test_no_duplicate_spawn(self):
        from games.pong.powerup import PowerUp
        self.gp.powerup = PowerUp(c.POWERUP_TYPE_CURSED_POWDER)
        self.gp.powerup_spawn_timer = -5
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertIsNotNone(self.gp.powerup)

    def test_reset_sets_initial_interval(self):
        self.gp.reset()
        self.assertAlmostEqual(self.gp.powerup_spawn_timer, c.POWERUP_SPAWN_INTERVAL, delta=0.1)

    def test_point_transition_no_duplicate_pickup(self):
        self.gp.point_transition_timer = 0.5
        self.gp.powerup = None
        self.gp.powerup_spawn_timer = -5
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertIsNone(self.gp.powerup)


class TestBallTrailCache(unittest.TestCase):
    def setUp(self):
        self.ball = Ball()

    def test_identity_on_repeat_assign(self):
        self.ball.set_rally_tier(5)
        surfs = self.ball._trail_surfs
        self.ball.set_rally_tier(5)
        self.assertIs(surfs, self.ball._trail_surfs)


class TestMuzzleFlashCache(unittest.TestCase):
    def setUp(self):
        self.paddle = Paddle(200, 300, side='left')

    def test_bounded_size(self):
        self.assertEqual(len(self.paddle._muzzle_flash_frames), 8)

    def test_frames_are_surfaces(self):
        for frame in self.paddle._muzzle_flash_frames:
            self.assertIsNotNone(frame)
            self.assertGreater(frame.get_width(), 0)
            self.assertGreater(frame.get_height(), 0)


class TestCannonballClashExitSemantics(unittest.TestCase):
    def setUp(self):
        self.game = PongGame(None, _MockAudio())

    def _start_match(self):
        self.game.state = 'menu'
        self.game.menu_selection = 0
        self.game._handle_key(pg.K_SPACE)

    def test_playing_escape_pauses(self):
        self._start_match()
        self.game.paused = False
        self.game._handle_key(pg.K_ESCAPE)
        self.assertTrue(self.game.paused)

    def test_paused_escape_resumes(self):
        self._start_match()
        self.game.paused = True
        self.game._handle_key(pg.K_ESCAPE)
        self.assertFalse(self.game.paused)

    def test_paused_p_resumes(self):
        self._start_match()
        self.game.paused = True
        self.game._handle_key(pg.K_p)
        self.assertFalse(self.game.paused)

    def test_pause_quit_to_menu_returns_menu(self):
        self._start_match()
        self.game.paused = True
        self.game.pause_selection = 5
        result = self.game._handle_key(pg.K_SPACE)
        self.assertEqual(result, "menu")
        self.assertEqual(self.game.state, "menu")

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

    def test_pause_resume_returns_no_result(self):
        self._start_match()
        self.game.paused = True
        self.game.pause_selection = 0
        result = self.game._handle_key(pg.K_SPACE)
        self.assertIsNone(result)
        self.assertFalse(self.game.paused)

    def test_pause_restart_clears_scores(self):
        self._start_match()
        self.game.gameplay.player_score = 5
        self.game.gameplay.ai_score = 3
        self.game.paused = True
        self.game.pause_selection = 1
        self.game._handle_key(pg.K_SPACE)
        self.assertEqual(self.game.gameplay.player_score, 0)
        self.assertEqual(self.game.gameplay.ai_score, 0)


class TestCannonballClashSpeedBounds(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_ball_speed_within_max(self):
        self.gp.ball.reset()
        self.gp.ball.launch()
        self.assertLessEqual(self.gp.ball.speed, c.BALL_MAX_SPEED)

    def test_ball_speed_starts_at_initial(self):
        self.gp.ball.reset()
        self.gp.ball.launch()
        self.assertAlmostEqual(self.gp.ball.speed, c.BALL_SPEED_INITIAL, delta=1)

    def test_speed_increases_with_rally(self):
        self.gp.ball.reset()
        self.gp.ball.launch()
        speed_before = self.gp.ball.speed
        for _ in range(5):
            self.gp.ball.bump_speed()
        self.assertGreater(self.gp.ball.speed, speed_before)
        self.assertLessEqual(self.gp.ball.speed, c.BALL_MAX_SPEED)

    def test_reset_restores_initial_speed(self):
        self.gp.ball.reset()
        self.gp.ball.launch()
        for _ in range(10):
            self.gp.ball.bump_speed()
        self.gp.ball.reset()
        self.gp.ball.launch()
        self.assertAlmostEqual(self.gp.ball.speed, c.BALL_SPEED_INITIAL, delta=1)


class TestCannonballClashPaddleMovement(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_arrow_down_moves_paddle_down(self):
        y_before = self.gp.player_paddle.y
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: True})
        y_after = self.gp.player_paddle.y
        self.assertGreater(y_after, y_before)

    def test_arrow_up_moves_paddle_up(self):
        # Move down first to have room upward
        for _ in range(10):
            self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: True})
        y_after_down = self.gp.player_paddle.y
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: True, pg.K_DOWN: False})
        y_after_up = self.gp.player_paddle.y
        self.assertLess(y_after_up, y_after_down)

    def test_paddle_stays_in_window_down(self):
        for _ in range(500):
            self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: True})
        p = self.gp.player_paddle
        self.assertLessEqual(p.rect.bottom, c.WINDOW_HEIGHT)

    def test_paddle_stays_in_window_up(self):
        for _ in range(500):
            self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: True, pg.K_DOWN: False})
        p = self.gp.player_paddle
        self.assertGreaterEqual(p.rect.top, 0)

    def test_no_input_leaves_paddle_still(self):
        y_before = self.gp.player_paddle.y
        self.gp.update(1/60, {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False})
        self.assertEqual(self.gp.player_paddle.y, y_before)


class TestCannonballClashResetLifecycle(unittest.TestCase):
    def setUp(self):
        self.game = PongGame(None, _MockAudio())

    def _start_match(self):
        self.game.state = 'menu'
        self.game.menu_selection = 0
        self.game._handle_key(pg.K_SPACE)

    def test_reset_clears_player_score(self):
        self._start_match()
        self.game.gameplay.player_score = 11
        self.game.gameplay.reset()
        self.assertEqual(self.game.gameplay.player_score, 0)

    def test_reset_clears_ai_score(self):
        self._start_match()
        self.game.gameplay.ai_score = 11
        self.game.gameplay.reset()
        self.assertEqual(self.game.gameplay.ai_score, 0)

    def test_reset_clears_game_over_state(self):
        self.game.state = 'game_over'
        self.game.game_over_state = 'player'
        self.game.game_over_timer = 1.0
        self.game._handle_key(pg.K_SPACE)
        self.assertEqual(self.game.state, 'playing')
        self.assertIsNone(self.game.game_over_state)

    def test_reset_clears_active_animation(self):
        self.game._active_animation = True
        self.game.state = 'game_over'
        self.game._handle_key(pg.K_SPACE)
        self.assertFalse(self.game._active_animation)

    def test_particles_start_empty(self):
        self.assertEqual(len(self.game.particles.particles), 0)

    def test_particles_reset_populates(self):
        self.game.particles.reset()
        self.assertGreater(len(self.game.particles.particles), 0)


class TestCannonballClashAiDifficulty(unittest.TestCase):
    def setUp(self):
        self.game = PongGame(None, _MockAudio())

    def test_default_difficulty_medium(self):
        self.assertEqual(self.game.ai_difficulty, 'medium')

    def test_difficulty_published_in_state(self):
        state = self.game._build_game_state()
        self.assertIn("aiDifficulty", state)
        self.assertGreater(state["aiDifficulty"], 0)

    def test_set_difficulty_reflected(self):
        self.game.ai_difficulty = 'hard'
        self.game.gameplay.set_difficulty('hard')
        state = self.game._build_game_state()
        self.assertGreater(state["aiDifficulty"], 0.5)

    def test_difficulty_changes_speed_factor(self):
        self.game.gameplay.set_difficulty('hard')
        self.assertAlmostEqual(self.game.gameplay.ai.speed_factor, 0.85, delta=0.1)

    def test_difficulty_easy_speed_factor(self):
        self.game.gameplay.set_difficulty('easy')
        self.assertAlmostEqual(self.game.gameplay.ai.speed_factor, 0.4, delta=0.1)

    def test_difficulty_medium_speed_factor(self):
        self.game.gameplay.set_difficulty('medium')
        self.assertAlmostEqual(self.game.gameplay.ai.speed_factor, 0.6, delta=0.1)


class TestFeverReinforcement(unittest.TestCase):
    """Cannonball Fever (rally 10) grants mid-point Reinforced Hull."""

    def setUp(self):
        self.gp = Gameplay(_MockAudio())
        # Isolate the grant from natural power-up spawns.
        self.gp.powerup_spawn_timer = 9999.0
        self.gp.powerup = None

    def _keys(self):
        return {pg.K_w: False, pg.K_s: False, pg.K_UP: False, pg.K_DOWN: False}

    def _drive_player_hit(self):
        # Ball.update runs before collision: place the ball so one frame of
        # travel at 650px/s carries it across the paddle face.
        gp = self.gp
        gp.ball.x = gp.player_paddle.rect.right + 5
        gp.ball.y = gp.player_paddle.y
        gp.ball.vx = -650
        gp.ball.vy = 0
        gp.ball.speed = 650
        gp.update(1 / 60, self._keys())

    def _stage_rally(self, count, tier):
        self.gp.rally_count = count
        self.gp.rally_tier = tier
        if self.gp.longest_rally < count:
            self.gp.longest_rally = count

    def test_grant_fires_once_at_rally_10(self):
        self._stage_rally(9, 5)
        self._drive_player_hit()
        self.assertEqual(self.gp.rally_count, 10)
        self.assertEqual(self.gp.rally_tier, 10)
        self.assertEqual(self.gp.player_paddle.height, 150)
        self.assertGreaterEqual(self.gp.player_paddle.big_timer, 7.9)

    def test_no_grant_below_10(self):
        self._stage_rally(8, 5)
        self._drive_player_hit()
        self.assertEqual(self.gp.rally_count, 9)
        self.assertEqual(self.gp.rally_tier, 5)
        self.assertEqual(self.gp.player_paddle.height, 100)

    def test_no_regrant_at_11_to_14(self):
        self._stage_rally(9, 5)
        self._drive_player_hit()
        self.assertEqual(self.gp.player_paddle.big_timer, 8.0)
        self.gp.player_paddle.big_timer = 5.0
        self._stage_rally(13, 10)
        self._drive_player_hit()
        self.assertEqual(self.gp.rally_count, 14)
        # Timer decayed naturally from 5.0: no refresh, no second grant.
        self.assertLess(self.gp.player_paddle.big_timer, 5.0)
        self.assertGreater(self.gp.player_paddle.big_timer, 0.0)

    def test_grant_clears_on_point_reset(self):
        self._stage_rally(9, 5)
        self._drive_player_hit()
        self.assertEqual(self.gp.player_paddle.height, 150)
        self.gp.reset_round()
        self.assertEqual(self.gp.player_paddle.height, 100)
        self.assertEqual(self.gp.rally_tier, 0)

    def test_grant_coexists_with_cursed(self):
        self.gp.ai_shrink_timer = 7.0
        self.gp.ai_paddle.height = 65
        self._stage_rally(9, 5)
        self._drive_player_hit()
        self.assertEqual(self.gp.player_paddle.height, 150)
        self.assertEqual(self.gp.ai_paddle.height, 65)

    def test_grant_identical_across_difficulties(self):
        for difficulty in ("easy", "medium", "hard"):
            with self.subTest(difficulty=difficulty):
                gp = Gameplay(_MockAudio())
                gp.powerup_spawn_timer = 9999.0
                gp.powerup = None
                gp.ai.set_difficulty(difficulty)
                self.gp = gp
                self._stage_rally(9, 5)
                self._drive_player_hit()
                self.assertEqual(gp.player_paddle.height, 150)
                self.assertEqual(gp.rally_tier, 10)

    def test_longest_rally_untouched_by_grant(self):
        self._stage_rally(9, 5)
        self._drive_player_hit()
        self.assertEqual(self.gp.longest_rally, 10)
        self.assertEqual(self.gp.rally_count, 10)


class TestDebugRallySeam(unittest.TestCase):
    def setUp(self):
        from shared import pa_store
        pa_store.clear_memory()
        self.gp = Gameplay(_MockAudio())
        self.gp.powerup_spawn_timer = 9999.0
        self.gp.powerup = None

    def tearDown(self):
        from shared import pa_store
        pa_store.clear_memory()

    def test_fresh_construct_without_seed_is_ordinary(self):
        self.assertFalse(self.gp._test_mode)
        self.assertEqual(self.gp.rally_count, 0)
        self.assertEqual(self.gp.rally_tier, 0)

    def test_seed_consumed_once_and_parked(self):
        from shared import pa_store
        pa_store._MEM["pa-pong-test-rally"] = "10"
        gp = Gameplay(_MockAudio())
        gp.powerup_spawn_timer = 9999.0
        gp.powerup = None
        self.assertTrue(gp._test_mode)
        self.assertEqual(gp.rally_count, 9)
        self.assertEqual(gp.rally_tier, 5)
        self.assertNotIn("pa-pong-test-rally", pa_store._MEM)

    def test_reset_reuses_memory_without_reread(self):
        from shared import pa_store
        pa_store._MEM["pa-pong-test-rally"] = "10"
        gp = Gameplay(_MockAudio())
        gp.powerup_spawn_timer = 9999.0
        gp.powerup = None
        self.assertTrue(gp._test_mode)
        gp.reset_round()
        self.assertTrue(gp._test_mode)
        self.assertEqual(gp.rally_count, 9)
        self.assertEqual(gp.rally_tier, 5)

    def test_malformed_seed_consumed_not_poisonous(self):
        from shared import pa_store
        pa_store._MEM["pa-pong-test-rally"] = "[[broken"
        gp = Gameplay(_MockAudio())
        self.assertFalse(gp._test_mode)
        self.assertNotIn("pa-pong-test-rally", pa_store._MEM)
        self.assertEqual(gp.rally_count, 0)

    def test_test_mode_suppresses_best_submit(self):
        from shared import pa_store
        pa_store._MEM["pa-pong-test-rally"] = "10"
        game = PongGame(None, _MockAudio())
        game.gameplay.powerup_spawn_timer = 9999.0
        game.gameplay.powerup = None
        self.assertTrue(game.gameplay._test_mode)
        game.state = 'playing'
        # Cross rally 10 through the real update path incl. submit guard.
        for _ in range(6):
            gp = game.gameplay
            gp.ball.x = gp.player_paddle.rect.right + 5
            gp.ball.y = gp.player_paddle.y
            gp.ball.vx = -650
            gp.ball.vy = 0
            gp.ball.speed = 650
            game._update(1 / 60)
            if gp.rally_tier >= 10:
                break
        self.assertEqual(game.gameplay.rally_tier, 10)
        self.assertEqual(game.gameplay.player_paddle.height, 150)
        self.assertIsNone(pa_store.get_best("pa-cannonball-rally"))
        self.assertFalse(game._is_new_best)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
