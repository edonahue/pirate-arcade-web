import unittest
import sys
import os

_BASE = os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port")
sys.path.insert(0, os.path.join(_BASE, "treasure-cove"))
sys.path.insert(0, _BASE)
os.environ["SDL_VIDEODRIVER"] = "dummy"

import pygame as pg
import constants as c
from games.breakout.ball import Ball
from games.breakout.paddle import Paddle
from games.breakout.brick import Brick, _build_body_surf, _build_keg_surf, _build_reinforced_overlay, _build_treasure_surf
from games.breakout.pickup import Pickup
from games.breakout.gameplay import Gameplay, CREW_LOST_HOLD_DURATION
from games.breakout.game import BreakoutGame
import builtins

builtins.__dict__["__pa_page_visible__"] = True

pg.font.init()
pg.display.set_mode((1, 1))


class _MockAudio:
    def play(self, *a, **kw):
        pass
    muted = False


class TestBallSpeedModel(unittest.TestCase):
    def setUp(self):
        self.ball = Ball()

    def test_init_slow_mult_is_one(self):
        self.assertEqual(self.ball._slow_mult, 1.0)

    def test_set_slow_activates_factor(self):
        self.ball.set_slow(True)
        self.assertEqual(self.ball._slow_mult, c.BALL_BREAKOUT_SLOW_FACTOR)

    def test_set_slow_off_restores_one(self):
        self.ball.set_slow(True)
        self.ball.set_slow(False)
        self.assertEqual(self.ball._slow_mult, 1.0)

    def test_slow_active_property(self):
        self.assertFalse(self.ball._slow_active)
        self.ball.set_slow(True)
        self.assertTrue(self.ball._slow_active)
        self.ball.set_slow(False)
        self.assertFalse(self.ball._slow_active)

    def test_launch_sets_underlying_speed(self):
        self.ball.launch()
        self.assertEqual(self.ball._underlying_speed, c.BALL_BREAKOUT_SPEED)

    def test_speed_equals_underlying_times_slow_mult(self):
        self.ball.launch()
        expected = self.ball._underlying_speed * self.ball._slow_mult
        self.assertAlmostEqual(self.ball.speed, expected, delta=1)

    def test_bump_speed_increases_underlying(self):
        self.ball._underlying_speed = c.BALL_BREAKOUT_SPEED
        self.ball.bump_speed()
        self.assertGreater(self.ball._underlying_speed, c.BALL_BREAKOUT_SPEED)
        self.assertLessEqual(self.ball._underlying_speed, c.BALL_BREAKOUT_MAX_SPEED)

    def test_bump_speed_updates_actual_speed(self):
        self.ball.launch()
        self.ball.bump_speed()
        expected = self.ball._underlying_speed * self.ball._slow_mult
        self.assertAlmostEqual(self.ball.speed, expected, delta=1)

    def test_speed_preserved_under_slow_toggle(self):
        self.ball.launch()
        self.ball.bump_speed()
        underlying_before = self.ball._underlying_speed
        self.ball.set_slow(True)
        self.assertEqual(self.ball._underlying_speed, underlying_before)

    def test_no_slow_multiplier_method_crash(self):
        self.ball.launch()
        self.ball.set_slow(True)
        self.ball.set_slow(False)
        self.assertEqual(self.ball._slow_mult, 1.0)

    def test_launch_resets_slow_mult(self):
        self.ball.set_slow(True)
        self.ball.launch()
        self.assertFalse(self.ball._slow_active)

    def test_reset_clears_slow_state(self):
        self.ball.set_slow(True)
        self.ball.launch()
        self.ball.reset()
        self.assertFalse(self.ball._slow_active)


class TestBallMinVy(unittest.TestCase):
    def setUp(self):
        self.ball = Ball()

    def test_ensure_min_vy_enforces_floor(self):
        self.ball.launch()
        self.ball.vy = 1
        self.ball.speed = 650
        self.ball.ensure_min_vy()
        self.assertGreaterEqual(abs(self.ball.vy), 650 * 0.15)

    def test_ensure_min_vy_rescales_vx(self):
        self.ball.launch()
        self.ball.vy = 1
        self.ball.speed = 650
        self.ball.ensure_min_vy()
        norm = (self.ball.vx ** 2 + self.ball.vy ** 2) ** 0.5
        self.assertAlmostEqual(norm, self.ball.speed, delta=1)

    def test_high_vy_not_affected(self):
        self.ball.launch()
        self.ball.vy = 500
        self.ball.speed = 650
        vy_before = self.ball.vy
        self.ball.ensure_min_vy()
        self.assertEqual(self.ball.vy, vy_before)

    def test_preserves_sign_of_vy(self):
        self.ball.launch()
        self.ball.vy = -1
        self.ball.speed = 650
        self.ball.ensure_min_vy()
        self.assertLess(self.ball.vy, 0)


class TestBallTrailCache(unittest.TestCase):
    def setUp(self):
        self.ball = Ball()

    def test_trail_surfs_prebuilt(self):
        self.assertGreater(len(self.ball._trail_surfs), 0)

    def test_trail_surfs_are_surfaces(self):
        for surf in self.ball._trail_surfs:
            self.assertIsNotNone(surf)
            self.assertGreater(surf.get_width(), 0)

    def test_trail_surf_cached_no_per_frame_alloc(self):
        surfs_before = self.ball._trail_surfs
        self.ball.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIs(self.ball._trail_surfs, surfs_before)


class TestPaddlePrebuiltSurfs(unittest.TestCase):
    def setUp(self):
        self.paddle = Paddle(c.WINDOW_WIDTH // 2, c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN)

    def test_normal_surf_exists(self):
        self.assertIsNotNone(self.paddle._normal_surf)

    def test_wide_surf_exists(self):
        self.assertIsNotNone(self.paddle._wide_surf)

    def test_normal_surf_has_correct_width(self):
        self.assertEqual(self.paddle._normal_surf.get_width(), c.PADDLE_BREAKOUT_WIDTH)

    def test_wide_surf_has_correct_width(self):
        expected = int(c.PADDLE_BREAKOUT_WIDTH * c.PADDLE_BREAKOUT_WIDE_MULTIPLIER)
        self.assertEqual(self.paddle._wide_surf.get_width(), expected)

    def test_no_per_frame_copy_in_draw(self):
        surf_before = self.paddle._normal_surf
        self.paddle.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIs(self.paddle._normal_surf, surf_before)

    def test_wide_timer_starts_zero(self):
        self.assertEqual(self.paddle.wide_timer, 0.0)

    def test_activate_wide_sets_timer(self):
        self.paddle.activate_wide()
        self.assertGreater(self.paddle.wide_timer, 0)

    def test_wide_rect_is_wider(self):
        normal_w = self.paddle.rect.width
        self.paddle.activate_wide()
        self.assertGreater(self.paddle.rect.width, normal_w)

    def test_wide_timer_decrements(self):
        self.paddle.activate_wide()
        t_before = self.paddle.wide_timer
        self.paddle.update(0.1)
        self.assertLess(self.paddle.wide_timer, t_before)

    def test_wide_expiry_returns_to_normal(self):
        self.paddle.activate_wide()
        self.paddle.wide_timer = 0.001
        self.paddle.update(0.01)
        self.assertEqual(self.paddle.wide_timer, 0.0)


class TestPaddlePulseCache(unittest.TestCase):
    def setUp(self):
        self.paddle = Paddle(c.WINDOW_WIDTH // 2, c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN)

    def test_pulse_surfs_built_on_demand(self):
        self.paddle.wide_timer = 1.0
        self.paddle.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertEqual(len(self.paddle._pulse_surfs), 8)

    def test_pulse_surfs_are_surfaces(self):
        self.paddle._build_pulse_surfs()
        for surf in self.paddle._pulse_surfs:
            self.assertIsNotNone(surf)
            self.assertGreater(surf.get_width(), 0)


class TestBrickDrawCaching(unittest.TestCase):
    def test_body_surf_cached_per_row(self):
        s1 = _build_body_surf(0, c.BRICK_STANDARD)
        s2 = _build_body_surf(0, c.BRICK_STANDARD)
        self.assertIs(s1, s2)

    def test_keg_surf_cached(self):
        s1 = _build_keg_surf(c.BRICK_WIDTH, c.BRICK_HEIGHT)
        s2 = _build_keg_surf(c.BRICK_WIDTH, c.BRICK_HEIGHT)
        self.assertIs(s1, s2)

    def test_reinforced_overlay_cached(self):
        s1 = _build_reinforced_overlay(c.BRICK_WIDTH, c.BRICK_HEIGHT)
        s2 = _build_reinforced_overlay(c.BRICK_WIDTH, c.BRICK_HEIGHT)
        self.assertIs(s1, s2)

    def test_treasure_surf_cached(self):
        s1 = _build_treasure_surf(c.BRICK_WIDTH, c.BRICK_HEIGHT)
        s2 = _build_treasure_surf(c.BRICK_WIDTH, c.BRICK_HEIGHT)
        self.assertIs(s1, s2)

    def test_brick_draw_no_poly_per_frame(self):
        brick = Brick(0, 0, c.BRICK_STANDARD)
        surf = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
        brick.draw(surf)
        brick.draw(surf)
        brick.draw(surf)


class TestPickupScaleCache(unittest.TestCase):
    def test_cached_surfs_shared_across_type(self):
        p1 = Pickup(100, 100, "multiball")
        p2 = Pickup(200, 200, "multiball")
        self.assertIs(p1._cached_scale_surfs["multiball"],
                      p2._cached_scale_surfs["multiball"])

    def test_cached_surfs_have_8_frames(self):
        p = Pickup(100, 100, "wide_paddle")
        self.assertEqual(len(p._cached_scale_surfs["wide_paddle"]), 8)

    def test_cached_surfs_are_surfaces(self):
        p = Pickup(100, 100, "slow_motion")
        for frame in p._cached_scale_surfs["slow_motion"].values():
            self.assertGreater(frame.get_width(), 0)


class TestGameplayWidePaddleTimer(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_no_wide_paddle_timer_on_gameplay(self):
        self.assertFalse(hasattr(self.gp, 'wide_paddle_timer'))

    def test_paddle_wide_timer_used_by_gameplay(self):
        self.assertEqual(self.gp.paddle.wide_timer, 0.0)

    def test_collect_wide_paddle_activates_paddle(self):
        pu = Pickup(100, 100, "wide_paddle")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertGreater(self.gp.paddle.wide_timer, 0)


class TestGameplayPowderKegChain(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_chain_start_brick_in_chain_set(self):
        start = self.gp.bricks[0]
        start.health = 0
        chain_set = set()
        chain_set.add(id(start))
        self.assertIn(id(start), chain_set)

    def test_chain_does_not_double_count_start(self):
        start = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_POWDER_KEG:
                start = b
                break
        if start is None:
            self.skipTest("No powder keg in stage 1 layout")
        start.health = 0
        remaining_before = self.gp.remaining_bricks
        self.gp._powder_keg_chain(start)
        remaining_delta = remaining_before - self.gp.remaining_bricks
        expected = sum(1 for b in self.gp.bricks if b.health == 0 and b is not start)
        self.assertEqual(remaining_delta, expected)

    def test_chain_max_limit_enforced(self):
        start = self.gp.bricks[0]
        start.health = 0
        chain_set = set(range(c.POWDER_KEG_CHAIN_MAX + 5))
        result = self.gp._powder_keg_chain(start, chain_set)
        self.assertEqual(result, [])


class TestGameplayLifeLossHold(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_life_lost_sets_timer(self):
        self.gp.lives = 2
        self.gp._life_lost_timer = 0.0
        self.gp._life_lost_pending_reset = True
        self.gp._life_lost_timer = CREW_LOST_HOLD_DURATION
        self.assertEqual(self.gp._life_lost_timer, CREW_LOST_HOLD_DURATION)

    def test_life_lost_timer_counts_down(self):
        self.gp.lives = 2
        self.gp._life_lost_timer = CREW_LOST_HOLD_DURATION
        self.gp._life_lost_pending_reset = True
        self.gp._update_timers(0.1)
        self.assertLess(self.gp._life_lost_timer, CREW_LOST_HOLD_DURATION)

    def test_reset_clears_life_lost_state(self):
        self.gp._life_lost_timer = CREW_LOST_HOLD_DURATION
        self.gp._life_lost_pending_reset = True
        self.gp.reset()
        self.assertEqual(self.gp._life_lost_timer, 0.0)
        self.assertFalse(self.gp._life_lost_pending_reset)

    def test_reset_round_clears_life_lost_state(self):
        self.gp._life_lost_timer = CREW_LOST_HOLD_DURATION
        self.gp._life_lost_pending_reset = True
        self.gp.reset_round()
        self.assertEqual(self.gp._life_lost_timer, 0.0)
        self.assertFalse(self.gp._life_lost_pending_reset)

    def test_menu_life_lost_state_false_by_default(self):
        self.assertEqual(self.gp._life_lost_timer, 0.0)
        self.assertFalse(self.gp._life_lost_pending_reset)


class TestGameplayStageBackdrops(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_backdrop_surfs_exist(self):
        self.assertIn(1, self.gp._backdrop_surfs)
        self.assertIn(2, self.gp._backdrop_surfs)
        self.assertIn(3, self.gp._backdrop_surfs)

    def test_backdrop_surfaces_correct_size(self):
        for surf in self.gp._backdrop_surfs.values():
            self.assertEqual(surf.get_width(), c.WINDOW_WIDTH)
            self.assertEqual(surf.get_height(), c.WINDOW_HEIGHT)

    def test_current_stage_backdrop_used(self):
        surf = self.gp._backdrop_surfs.get(self.gp.stage)
        self.assertIsNotNone(surf)


class TestGameplayLabelCache(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_pickup_label_surf_cached_on_collect(self):
        self.gp._pickup_label = None
        self.gp._pickup_label_surf = None
        self.gp._collect_pickup(Pickup(100, 100, "multiball"))
        self.assertIsNotNone(self.gp._pickup_label_surf)

    def test_no_per_frame_render_when_label_cached(self):
        self.gp._pickup_label = "TEST"
        label_surf = self.gp.hud_font.render("TEST", True, c.PIRATE_GOLD)
        self.gp._pickup_label_surf = label_surf
        self.gp._pickup_label_timer = 1.0
        surf = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
        self.gp.draw(surf)

    def test_crew_lost_sets_label_and_surf(self):
        self.gp.lives = 2
        self.gp._life_lost_timer = CREW_LOST_HOLD_DURATION
        self.gp._life_lost_pending_reset = True
        self.gp._pickup_label = "CREW LOST!"
        self.gp._pickup_label_surf = self.gp.hud_font.render("CREW LOST!", True, c.PIRATE_RED)
        self.gp._pickup_label_timer = CREW_LOST_HOLD_DURATION + 0.2
        self.assertIsNotNone(self.gp._pickup_label_surf)


class TestGameplayActiveAnimation(unittest.TestCase):
    def setUp(self):
        self.game = BreakoutGame(None, _MockAudio())

    def test_active_animation_starts_false(self):
        self.assertFalse(self.game._active_animation)

    def test_active_animation_true_on_game_over(self):
        self.game.state = 'playing'
        self.game._update(1/60)
        self.game.state = 'game_over'
        self.game._active_animation = True
        self.assertTrue(self.game._active_animation)

    def test_active_animation_clears_in_one_update(self):
        self.game.state = 'game_over'
        self.game._active_animation = True
        self.game._update(1/60)
        self.assertFalse(self.game._active_animation)

    def test_render_after_anim_set_on_animation_end(self):
        self.game.state = 'game_over'
        self.game._active_animation = True
        self.game._update(1/60)
        self.assertTrue(self.game._render_after_anim)

    def test_active_animation_reset_on_restart(self):
        self.game._active_animation = True
        self.game.state = 'game_over'
        self.game._handle_key(pg.K_SPACE)
        self.assertFalse(self.game._active_animation)

    def test_render_after_anim_consumed_by_run_loop(self):
        self.game._render_after_anim = True
        self.game.state = 'game_over'
        self.game.surface = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
        self.game._draw(60)
        self.assertTrue(self.game._render_after_anim)
        self._orig_run = True


class TestGameplaySweptCollision(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_swept_catches_high_speed_ball(self):
        ball = self.gp.balls[0]
        ball.launch()
        brick = self.gp.bricks[0]
        brick.health = 1
        brick.x = c.BRICK_LEFT
        brick.y = c.BRICK_MARGIN_TOP
        cy = brick.y + brick.height // 2
        ball.x = c.WINDOW_WIDTH + 50
        ball.y = cy
        ball.px = -50
        ball.py = cy
        ball.vx = 9999
        ball.vy = 0
        ball.speed = 9999
        ball.radius = c.BALL_BREAKOUT_SIZE
        result = self.gp._resolve_brick_swept(ball, brick)
        self.assertTrue(result)

    def test_swept_returns_false_for_miss(self):
        ball = self.gp.balls[0]
        ball.launch()
        ball.x = 0
        ball.y = 0
        ball.px = 0
        ball.py = 0
        ball.vx = 0
        ball.vy = 0
        ball.speed = 0
        ball.radius = c.BALL_BREAKOUT_SIZE
        brick = self.gp.bricks[0]
        brick.x = 5000
        brick.y = 5000
        result = self.gp._resolve_brick_swept(ball, brick)
        self.assertFalse(result)

    def test_swept_handles_stationary_ball(self):
        ball = self.gp.balls[0]
        ball.px = 100
        ball.py = 100
        ball.x = 100
        ball.y = 100
        ball.vx = 0
        ball.vy = 0
        brick = self.gp.bricks[0]
        brick.x = 200
        brick.y = 200
        result = self.gp._resolve_brick_swept(ball, brick)
        self.assertFalse(result)


class TestGameplayRemoveAllSlow(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_remove_all_slow_clears_balls(self):
        for ball in self.gp.balls:
            ball.set_slow(True)
        self.gp._remove_all_slow()
        for ball in self.gp.balls:
            self.assertFalse(ball._slow_active)

    def test_remove_all_slow_no_hasattr_dance(self):
        for ball in self.gp.balls:
            ball.set_slow(False)
        self.gp._remove_all_slow()
        for ball in self.gp.balls:
            self.assertFalse(ball._slow_active)


class TestGameplayStageTransition(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_stage_transition_resets_wide_timer(self):
        self.gp.paddle.activate_wide()
        self.gp._start_stage_transition()
        self.assertEqual(self.gp.paddle.wide_timer, 0.0)

    def test_stage_transition_clears_pickups(self):
        pu = Pickup(100, 100, "multiball")
        self.gp.falling_pickups.append(pu)
        self.gp._start_stage_transition()
        self.assertEqual(len(self.gp.falling_pickups), 0)

    def test_stage_transition_clears_slow(self):
        for ball in self.gp.balls:
            ball.set_slow(True)
        self.gp._start_stage_transition()
        for ball in self.gp.balls:
            self.assertFalse(ball._slow_active)

    def test_stage_transition_clears_pickup_label(self):
        self.gp._pickup_label = "TEST"
        self.gp._pickup_label_surf = "surf"
        self.gp._pickup_label_timer = 1.0
        self.gp._start_stage_transition()
        self.assertIsNone(self.gp._pickup_label)
        self.assertIsNone(self.gp._pickup_label_surf)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
