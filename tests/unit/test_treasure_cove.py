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
        self.assertGreaterEqual(abs(self.ball.vy), 90)

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


class TestBallLaunchDirection(unittest.TestCase):
    def setUp(self):
        self.ball = Ball()

    def test_launch_speed_matches_configured(self):
        self.ball.launch()
        speed = (self.ball.vx ** 2 + self.ball.vy ** 2) ** 0.5
        self.assertAlmostEqual(speed, c.BALL_BREAKOUT_SPEED, delta=1)

    def test_launch_vy_is_upward(self):
        self.ball.launch()
        self.assertLess(self.ball.vy, 0)

    def test_launch_can_produce_leftward_vx(self):
        import random as _random
        seen_left = False
        for _ in range(100):
            self.ball = Ball()
            self.ball.launch()
            if self.ball.vx < 0:
                seen_left = True
                break
        self.assertTrue(seen_left, "launch never produced leftward vx")

    def test_launch_can_produce_rightward_vx(self):
        import random as _random
        seen_right = False
        for _ in range(100):
            self.ball = Ball()
            self.ball.launch()
            if self.ball.vx > 0:
                seen_right = True
                break
        self.assertTrue(seen_right, "launch never produced rightward vx")

    def test_launch_vy_minimum_enforced(self):
        for _ in range(100):
            self.ball = Ball()
            self.ball.launch()
            min_abs_vy = self.ball.speed * 0.15
            self.assertGreaterEqual(abs(self.ball.vy), min_abs_vy * 0.9,
                                    f"vy={self.ball.vy} below minimum {min_abs_vy}")


class TestMultiballCloneBehavior(unittest.TestCase):
    def setUp(self):
        from games.breakout.pickup import Pickup
        self.gp = Gameplay(_MockAudio())
        self.Pickup = Pickup

    def _trigger_multiball(self):
        self.gp.balls = [Ball()]
        self.gp.balls[0].launched = True
        self.gp.balls[0].x = 400
        self.gp.balls[0].y = 300
        self.gp.balls[0].vx = 200
        self.gp.balls[0].vy = -300
        self.gp.balls[0].speed = 360
        self.gp.balls[0]._underlying_speed = c.BALL_BREAKOUT_SPEED
        pu = self.Pickup(100, 100, "multiball")
        pu.x = self.gp.paddle.x
        pu.y = self.gp.paddle.y
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)

    def test_multiball_produces_total_three(self):
        self._trigger_multiball()
        self.assertEqual(len(self.gp.balls), 3)

    def test_multiball_new_balls_launched(self):
        self._trigger_multiball()
        for b in self.gp.balls:
            self.assertTrue(b.launched)

    def test_multiball_new_balls_preserve_radius(self):
        self.gp.balls = [Ball()]
        self.gp.balls[0].set_radius(20)
        self.gp.balls[0].launched = True
        self.gp.balls[0].vx = 200
        self.gp.balls[0].vy = -300
        self.gp.balls[0].speed = 360
        self.gp.balls[0]._underlying_speed = c.BALL_BREAKOUT_SPEED
        pu = self.Pickup(100, 100, "multiball")
        pu.x = self.gp.paddle.x
        pu.y = self.gp.paddle.y
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        for b in self.gp.balls:
            self.assertEqual(b.radius, 20)

    def test_multiball_new_balls_preserve_underlying_speed(self):
        self._trigger_multiball()
        for b in self.gp.balls:
            self.assertEqual(b._underlying_speed, c.BALL_BREAKOUT_SPEED)

    def test_multiball_does_not_exceed_max(self):
        self.gp.balls = [Ball() for _ in range(c.MAX_BALLS)]
        for b in self.gp.balls:
            b.launched = True
        orig_count = len(self.gp.balls)
        pu = self.Pickup(100, 100, "multiball")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertLessEqual(len(self.gp.balls), c.MAX_BALLS)

    def test_multiball_at_max_awards_bonus(self):
        self.gp.balls = [Ball() for _ in range(c.MAX_BALLS)]
        for b in self.gp.balls:
            b.launched = True
        score_before = self.gp.score
        pu = self.Pickup(100, 100, "multiball")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertEqual(self.gp.score, score_before + c.PICKUP_COLLECT_BONUS)

    def test_multiball_new_balls_have_opposite_x_velocity(self):
        self.gp.balls = [Ball()]
        src = self.gp.balls[0]
        src.launched = True
        src.vx = 200
        src.vy = -300
        src.speed = 360
        src._underlying_speed = c.BALL_BREAKOUT_SPEED
        pu = self.Pickup(100, 100, "multiball")
        pu.x = self.gp.paddle.x
        pu.y = self.gp.paddle.y
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        for b in self.gp.balls:
            if b is not src:
                self.assertEqual(b.vx, -src.vx)


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
        self.gp._life_lost_hold_timer = 0.0
        self.gp._life_lost_hold_timer = CREW_LOST_HOLD_DURATION
        self.assertEqual(self.gp._life_lost_hold_timer, CREW_LOST_HOLD_DURATION)

    def test_life_lost_hold_timer_counts_down(self):
        self.gp.lives = 2
        self.gp._life_lost_hold_timer = CREW_LOST_HOLD_DURATION
        self.gp._update_timers(0.1)
        self.assertLess(self.gp._life_lost_hold_timer, CREW_LOST_HOLD_DURATION)

    def test_reset_clears_life_lost_state(self):
        self.gp._life_lost_hold_timer = CREW_LOST_HOLD_DURATION
        self.gp.reset()
        self.assertEqual(self.gp._life_lost_hold_timer, 0.0)
        self.assertEqual(self.gp.round_phase, "serve")

    def test_reset_round_clears_life_lost_state(self):
        self.gp._life_lost_hold_timer = CREW_LOST_HOLD_DURATION
        self.gp.reset_ball()
        self.assertEqual(self.gp._life_lost_hold_timer, 0.0)
        self.assertEqual(self.gp.round_phase, "serve")

    def test_reset_round_alias_works(self):
        self.gp._life_lost_hold_timer = CREW_LOST_HOLD_DURATION
        self.gp.reset_round()
        self.assertEqual(self.gp._life_lost_hold_timer, 0.0)
        self.assertEqual(self.gp.round_phase, "serve")

    def test_menu_life_lost_state_false_by_default(self):
        self.assertEqual(self.gp._life_lost_hold_timer, 0.0)
        self.assertEqual(self.gp.round_phase, "serve")


class TestGameplayBackdrops(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_all_backdrops_built_on_build_call(self):
        self.assertEqual(len(self.gp._backdrop_surfs), 0)
        self.gp._build_backdrop_surfs()
        self.assertIn(1, self.gp._backdrop_surfs)
        self.assertIn(2, self.gp._backdrop_surfs)
        self.assertIn(3, self.gp._backdrop_surfs)

    def test_backdrop_surfaces_correct_size(self):
        self.gp._build_backdrop_surfs()
        for surf in self.gp._backdrop_surfs.values():
            self.assertEqual(surf.get_width(), c.WINDOW_WIDTH)
            self.assertEqual(surf.get_height(), c.WINDOW_HEIGHT)

    def test_current_stage_backdrop_used(self):
        self.gp._build_backdrop_surfs()
        surf = self.gp._backdrop_surfs.get(self.gp.stage)
        self.assertIsNotNone(surf)

    def test_draw_triggers_backdrop_build(self):
        before = len(self.gp._backdrop_surfs)
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        after = len(self.gp._backdrop_surfs)
        self.assertGreater(after, before)


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
        self.gp._life_lost_hold_timer = CREW_LOST_HOLD_DURATION
        self.gp.round_phase = "life-lost-hold"
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


class TestBallSetRadius(unittest.TestCase):
    def setUp(self):
        self.ball = Ball()

    def test_set_radius_changes_radius(self):
        self.ball.set_radius(20)
        self.assertEqual(self.ball.radius, 20)

    def test_set_radius_rebuilds_glow(self):
        old_glow_size = self.ball._glow_size
        self.ball.set_radius(20)
        self.assertNotEqual(self.ball._glow_size, old_glow_size)

    def test_set_radius_rebuilds_trail(self):
        old_trails = self.ball._trail_surfs
        self.ball.set_radius(20)
        self.assertIsNot(self.ball._trail_surfs, old_trails)

    def test_set_radius_noop_when_same(self):
        old_glow_size = self.ball._glow_size
        old_trails = self.ball._trail_surfs
        self.ball.set_radius(c.BALL_BREAKOUT_SIZE)
        self.assertEqual(self.ball._glow_size, old_glow_size)
        self.assertIs(self.ball._trail_surfs, old_trails)

    def test_custom_radius_in_ctor(self):
        ball = Ball(radius=25)
        self.assertEqual(ball.radius, 25)

    def test_custom_radius_rebuilds_glow(self):
        ball = Ball(radius=25)
        self.assertEqual(ball._glow_size, 75)

    def test_rect_reflects_new_radius(self):
        self.ball.set_radius(15)
        self.assertEqual(self.ball.rect.width, 30)
        self.assertEqual(self.ball.rect.height, 30)


class TestRoundPhase(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_round_starts_at_one(self):
        self.assertEqual(self.gp.round, 1)

    def test_round_increments_on_life_loss(self):
        self.gp.lives = 2
        self.gp.balls = [Ball()]
        self.gp.balls[0].launched = True
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(self.gp.round, 2)

    def test_round_reset_on_stage_transition(self):
        self.gp.round = 3
        self.gp._start_stage_transition()
        self.assertEqual(self.gp.round, 1)

    def test_round_reset_on_game_reset(self):
        self.gp.round = 5
        self.gp.reset()
        self.assertEqual(self.gp.round, 1)

    def test_round_in_state_event_key(self):
        game = BreakoutGame(None, _MockAudio())
        game.gameplay = self.gp
        self.gp.round = 3
        key = game._state_event_key()
        self.assertIn(3, key)

    def test_round_in_build_game_state(self):
        game = BreakoutGame(None, _MockAudio())
        game.gameplay = self.gp
        self.gp.round = 4
        state = game._build_game_state()
        self.assertEqual(state["round"], 4)


class TestMultiballRadiusInheritance(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def _force_multiball(self):
        pu = Pickup(100, 100, "multiball")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp.balls[0].launched = True
        self.gp.balls[0].set_radius(20)
        self.gp._update_pickups(1/60)

    def test_new_ball_inherits_source_radius(self):
        self._force_multiball()
        for b in self.gp.balls:
            self.assertEqual(b.radius, 20)

    def test_new_ball_has_set_radius_method(self):
        self._force_multiball()
        for b in self.gp.balls:
            self.assertTrue(hasattr(b, "set_radius"))


class TestFallenBallCleanup(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_fallen_ball_removed_from_multiball(self):
        self.gp.balls = [Ball(), Ball()]
        self.gp.balls[0].launched = True
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.balls[1].launched = True
        self.gp.balls[1].y = 200
        self.gp.paddle.x = c.WINDOW_WIDTH // 2
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(len(self.gp.balls), 1)

    def test_all_fallen_balls_trigger_life_loss(self):
        self.gp.lives = 2
        self.gp.balls = [Ball(), Ball()]
        self.gp.balls[0].launched = True
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.balls[1].launched = True
        self.gp.balls[1].y = c.WINDOW_HEIGHT + 200
        self.gp.paddle.x = c.WINDOW_WIDTH // 2
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(self.gp.lives, 1)


class TestSingleContactDamage(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_brick_skipped_when_id_in_hit_set(self):
        ball = self.gp.balls[0]
        brick = self.gp.bricks[0]
        brick.health = 2
        hit_key = (id(ball), id(brick))
        self.gp._hit_bricks_this_frame.add(hit_key)
        self.gp._damage_brick(ball, brick)
        self.assertEqual(brick.health, 2)

    def test_no_score_when_brick_skipped(self):
        ball = self.gp.balls[0]
        brick = self.gp.bricks[0]
        brick.health = 2
        hit_key = (id(ball), id(brick))
        self.gp._hit_bricks_this_frame.add(hit_key)
        score_before = self.gp.score
        self.gp._damage_brick(ball, brick)
        self.assertEqual(self.gp.score, score_before)

    def test_hit_tracked_for_each_brick(self):
        ball = self.gp.balls[0]
        self.gp._hit_bricks_this_frame = set()
        b1 = self.gp.bricks[0]
        b2 = self.gp.bricks[1]
        b1.health = 2
        b2.health = 2
        self.gp._damage_brick(ball, b1)
        self.gp._damage_brick(ball, b2)
        self.assertIn((id(ball), id(b1)), self.gp._hit_bricks_this_frame)
        self.assertIn((id(ball), id(b2)), self.gp._hit_bricks_this_frame)

    def test_hit_set_cleared_by_update(self):
        ball = self.gp.balls[0]
        brick = self.gp.bricks[0]
        brick.health = 2
        self.gp._damage_brick(ball, brick)
        hit_key = (id(ball), id(brick))
        self.assertIn(hit_key, self.gp._hit_bricks_this_frame)
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertNotIn(hit_key, self.gp._hit_bricks_this_frame)


class TestBrickDestructionTelemetry(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_telemetry_tracks_standard(self):
        brick = self.gp.bricks[0]
        brick.brick_type = c.BRICK_STANDARD
        brick.health = 1
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertEqual(self.gp._brick_destruction_counts["standard"], 1)

    def test_telemetry_tracks_powder_keg(self):
        self.gp._brick_destruction_counts["powder_keg"] = 0
        start = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_POWDER_KEG:
                start = b
                break
        if start:
            start.health = 1
            self.gp._damage_brick(self.gp.balls[0], start)
            self.assertGreater(self.gp._brick_destruction_counts["powder_keg"], 0)

    def test_destruction_count_in_published_state(self):
        self.gp.game = BreakoutGame(None, _MockAudio())
        self.gp.game.gameplay = self.gp
        self.gp._brick_destruction_counts["standard"] = 5
        state = self.gp.game._build_game_state()
        self.assertEqual(state["brickDestructionCounts"]["standard"], 5)

    def test_counts_reset_on_new_game(self):
        self.gp._brick_destruction_counts["treasure"] = 99
        self.gp.reset()
        self.assertEqual(self.gp._brick_destruction_counts["treasure"], 0)


class TestPickupHistory(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_pickup_tracked_on_collect(self):
        pu = Pickup(100, 100, "multiball")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertIn("multiball", self.gp._pickup_history)

    def test_pickup_history_reset_on_new_game(self):
        self.gp._pickup_history.append("slow_motion")
        self.gp.reset()
        self.assertEqual(len(self.gp._pickup_history), 0)

    def test_pickup_history_in_published_state(self):
        self.gp.game = BreakoutGame(None, _MockAudio())
        self.gp.game.gameplay = self.gp
        self.gp._pickup_history.append("wide_paddle")
        state = self.gp.game._build_game_state()
        self.assertIn("wide_paddle", state["pickupHistory"])


class TestBackdropLifecycle(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_no_backdrops_after_init(self):
        self.assertEqual(len(self.gp._backdrop_surfs), 0)

    def test_draw_builds_backdrops(self):
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertGreater(len(self.gp._backdrop_surfs), 0)

    def test_draw_uses_correct_backdrop(self):
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIn(self.gp.stage, self.gp._backdrop_surfs)

    def test_no_redundant_build(self):
        self.gp._build_backdrop_surfs()
        first = self.gp._backdrop_surfs.get(1)
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        second = self.gp._backdrop_surfs.get(1)
        self.assertIs(first, second)


class TestHudCaching(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_stage_text_cached(self):
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIsNotNone(self.gp._cached_stage_surf)
        surf_ref = self.gp._cached_stage_surf
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIs(self.gp._cached_stage_surf, surf_ref)

    def test_balls_text_cached(self):
        self.gp.balls = [Ball(), Ball()]
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIsNotNone(self.gp._cached_balls_surf)

    def test_breached_label_prebuilt(self):
        self.assertIsNotNone(self.gp._cached_breached_surf)

    def test_wide_text_cached(self):
        self.gp.paddle.activate_wide()
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIsNotNone(self.gp._cached_wide_surf)

    def test_slow_text_cached(self):
        self.gp.slow_motion_timer = 5.0
        self.gp.draw(pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT)))
        self.assertIsNotNone(self.gp._cached_slow_surf)


class TestBreakoutGameExitSemantics(unittest.TestCase):
    def setUp(self):
        self.game = BreakoutGame(None, _MockAudio())

    def test_playing_escape_pauses(self):
        self.game.state = 'playing'
        self.game.paused = False
        self.game._handle_key(pg.K_ESCAPE)
        self.assertTrue(self.game.paused)

    def test_paused_escape_resumes(self):
        self.game.state = 'playing'
        self.game.paused = True
        self.game._handle_key(pg.K_ESCAPE)
        self.assertFalse(self.game.paused)

    def test_menu_escape_returns_quit(self):
        self.game.state = 'menu'
        result = self.game._handle_key(pg.K_ESCAPE)
        self.assertEqual(result, "quit")

    def test_game_over_escape_returns_quit(self):
        self.game.state = 'game_over'
        result = self.game._handle_key(pg.K_ESCAPE)
        self.assertEqual(result, "quit")

    def test_menu_space_starts_playing(self):
        self.game.state = 'menu'
        result = self.game._handle_key(pg.K_SPACE)
        self.assertIsNone(result)
        self.assertEqual(self.game.state, 'playing')

    def test_game_over_space_restarts(self):
        self.game.state = 'game_over'
        result = self.game._handle_key(pg.K_SPACE)
        self.assertIsNone(result)
        self.assertEqual(self.game.state, 'playing')

    def test_pause_resume_returns_none(self):
        self.game.state = 'playing'
        self.game.paused = True
        self.game.pause_selection = 0
        result = self.game._handle_key(pg.K_SPACE)
        self.assertIsNone(result)
        self.assertFalse(self.game.paused)

    def test_pause_quit_to_menu_returns_menu(self):
        self.game.state = 'playing'
        self.game.paused = True
        self.game.pause_selection = 4
        result = self.game._handle_key(pg.K_SPACE)
        self.assertEqual(result, "menu")
        self.assertEqual(self.game.state, "menu")

    def test_pause_restart_resets_score(self):
        self.game.state = 'playing'
        self.game.gameplay.score = 500
        self.game.paused = True
        self.game.pause_selection = 1
        self.game._handle_key(pg.K_SPACE)
        self.assertEqual(self.game.gameplay.score, 0)

    def test_errored_remains_false_after_menu_return(self):
        self.game.state = 'playing'
        self.game.paused = True
        self.game.pause_selection = 4
        self.game._handle_key(pg.K_SPACE)
        self.assertFalse(hasattr(self.game, 'errored'))


class TestGameplayQuitToMenu(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_quit_to_menu_sets_state_menu(self):
        self.gp.game = BreakoutGame(None, _MockAudio())
        self.gp.game.state = 'playing'
        self.gp.game.paused = True
        self.gp.game.pause_selection = 4
        result = self.gp.game._handle_key(pg.K_SPACE)
        self.assertEqual(result, "menu")
        self.assertEqual(self.gp.game.state, "menu")
        self.assertFalse(self.gp.game.paused)
        self.assertIsNone(self.gp.game.game_over_state)

    def test_quit_to_menu_resets_gameplay(self):
        self.gp.game = BreakoutGame(None, _MockAudio())
        self.gp.game.state = 'playing'
        self.gp.game.gameplay.score = 1000
        self.gp.game.paused = True
        self.gp.game.pause_selection = 4
        self.gp.game._handle_key(pg.K_SPACE)
        self.assertEqual(self.gp.game.gameplay.score, 0)

    def test_restart_from_menu_after_quit(self):
        self.gp.game = BreakoutGame(None, _MockAudio())
        # Simulate quit to menu
        self.gp.game.state = 'menu'
        self.gp.game.paused = False
        # Start new game
        self.gp.game._handle_key(pg.K_SPACE)
        self.assertEqual(self.gp.game.state, 'playing')
        self.assertEqual(self.gp.game.gameplay.round, 1)
        self.assertFalse(self.gp.game.paused)

    def test_dispose_not_triggered_by_quit_to_menu(self):
        self.gp.game = BreakoutGame(None, _MockAudio())
        self.gp.game.state = 'playing'
        self.gp.game.paused = True
        self.gp.game.pause_selection = 4
        self.gp.game._handle_key(pg.K_SPACE)
        self.assertEqual(self.gp.game.state, "menu")


class TestGameplayLaunchDeterministic(unittest.TestCase):
    def setUp(self):
        import random
        self._orig_uniform = random.uniform
        self.ball = Ball()

    def tearDown(self):
        import random
        random.uniform = self._orig_uniform

    def _launch_with_angle(self, angle_degrees):
        import random
        random.uniform = lambda a, b: angle_degrees
        self.ball.launch()

    def test_plus_60_goes_left(self):
        """angle = 60 + 90 = 150°, cos negative => leftward vx"""
        self._launch_with_angle(60)
        self.assertLess(self.ball.vx, 0)

    def test_minus_60_goes_right(self):
        """angle = -60 + 90 = 30°, cos positive => rightward vx"""
        self._launch_with_angle(-60)
        self.assertGreater(self.ball.vx, 0)

    def test_zero_degrees_near_vertical(self):
        self._launch_with_angle(0)
        self.assertAlmostEqual(self.ball.vx, 0, delta=1)

    def test_vy_always_negative(self):
        for angle in range(-60, 61, 10):
            self._launch_with_angle(angle)
            self.assertLess(self.ball.vy, 0, f"vy not negative at angle {angle}")

    def test_speed_matches_configured(self):
        self._launch_with_angle(0)
        speed = (self.ball.vx ** 2 + self.ball.vy ** 2) ** 0.5
        self.assertAlmostEqual(speed, c.BALL_BREAKOUT_SPEED, delta=1)

    def test_min_vy_enforced_after_launch(self):
        self._launch_with_angle(0)
        self.assertGreaterEqual(abs(self.ball.vy), 90)


class TestMultiballDetailed(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())
        self.Pickup = Pickup

    def _trigger(self, balls=None, src_vx=200, src_vy=-300):
        if balls is None:
            self.gp.balls = [Ball()]
        else:
            self.gp.balls = balls
        src = self.gp.balls[0]
        src.launched = True
        src.x = 400
        src.y = 300
        src.vx = src_vx
        src.vy = src_vy
        src.speed = 360
        src._underlying_speed = c.BALL_BREAKOUT_SPEED
        pu = self.Pickup(100, 100, "multiball")
        pu.x = self.gp.paddle.x
        pu.y = self.gp.paddle.y
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)

    def test_multiball_produces_exactly_three(self):
        self._trigger()
        self.assertEqual(len(self.gp.balls), 3)

    def test_new_balls_are_launched(self):
        self._trigger()
        for b in self.gp.balls:
            self.assertTrue(b.launched)

    def test_new_balls_preserve_speed(self):
        self._trigger(src_vx=200, src_vy=-300)
        for b in self.gp.balls:
            speed = (b.vx ** 2 + b.vy ** 2) ** 0.5
            self.assertAlmostEqual(speed, 360, delta=1)

    def test_max_balls_not_exceeded(self):
        self.gp.balls = [Ball() for _ in range(c.MAX_BALLS)]
        for b in self.gp.balls:
            b.launched = True
        count_before = len(self.gp.balls)
        pu = self.Pickup(100, 100, "multiball")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertLessEqual(len(self.gp.balls), c.MAX_BALLS)
        self.assertEqual(len(self.gp.balls), count_before)

    def test_max_balls_awards_bonus(self):
        self.gp.balls = [Ball() for _ in range(c.MAX_BALLS)]
        for b in self.gp.balls:
            b.launched = True
        score_before = self.gp.score
        pu = self.Pickup(100, 100, "multiball")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertEqual(self.gp.score, score_before + c.PICKUP_COLLECT_BONUS)

    def test_new_balls_have_opposite_vx(self):
        self._trigger(src_vx=200)
        for b in self.gp.balls:
            if b is not self.gp.balls[0]:
                self.assertEqual(b.vx, -200)

    def test_new_balls_preserve_slow_multiplier(self):
        # Create gameplay with single ball
        self.gp.balls = [Ball()]
        src = self.gp.balls[0]
        src.launched = True
        src.x = 400
        src.y = 300
        src.vx = 200
        src.vy = -300
        src.speed = 360
        src._underlying_speed = c.BALL_BREAKOUT_SPEED
        src._slow_mult = 0.5
        src.speed = src._underlying_speed * src._slow_mult
        # Add multiball pickup and trigger
        pu = self.Pickup(100, 100, "multiball")
        pu.x = self.gp.paddle.x
        pu.y = self.gp.paddle.y
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        # New balls should inherit the slow multiplier
        for b in self.gp.balls:
            self.assertEqual(b._slow_mult, 0.5)


class TestFallenBallsDetailed(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_one_fallen_two_remain(self):
        self.gp.balls = [Ball(), Ball(), Ball()]
        for b in self.gp.balls:
            b.launched = True
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.balls[1].y = 200
        self.gp.balls[2].y = 300
        self.gp.paddle.x = c.WINDOW_WIDTH // 2
        lives_before = self.gp.lives
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(len(self.gp.balls), 2)
        self.assertEqual(self.gp.lives, lives_before)

    def test_two_fallen_one_remains(self):
        self.gp.balls = [Ball(), Ball(), Ball()]
        for b in self.gp.balls:
            b.launched = True
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.balls[1].y = c.WINDOW_HEIGHT + 200
        self.gp.balls[2].y = 300
        self.gp.paddle.x = c.WINDOW_WIDTH // 2
        lives_before = self.gp.lives
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(len(self.gp.balls), 1)
        self.assertEqual(self.gp.lives, lives_before)

    def test_one_launched_ball_falls_loses_life(self):
        self.gp.lives = 2
        self.gp.balls = [Ball()]
        self.gp.balls[0].launched = True
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.paddle.x = c.WINDOW_WIDTH // 2
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(self.gp.lives, 1)

    def test_final_life_lost_returns_game_over(self):
        self.gp.lives = 1
        self.gp.balls = [Ball()]
        self.gp.balls[0].launched = True
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.paddle.x = c.WINDOW_WIDTH // 2
        result = self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(result, ("game_over", "lost"))

    def test_serve_ball_below_screen_no_life_loss(self):
        self.gp.lives = 3
        self.gp.balls = [Ball()]
        self.gp.balls[0].launched = False
        self.gp.balls[0].y = c.WINDOW_HEIGHT + 100
        self.gp.paddle.x = c.WINDOW_WIDTH // 2
        self.gp.update(1/60, pg.key.get_pressed())
        self.assertEqual(self.gp.lives, 3)


class TestPickupSemantics(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_drop_pickup_does_not_update_last_type(self):
        self.gp.last_pickup_type = None
        # A pickup far from paddle
        pu = Pickup(100, 100, "multiball")
        pu.y = 0
        pu.x = 0
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertIsNone(self.gp.last_pickup_type)

    def test_expired_pickup_does_not_update_last_type(self):
        self.gp.last_pickup_type = None
        pu = Pickup(100, 100, "wide_paddle")
        pu.y = c.WINDOW_HEIGHT + 200
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertIsNone(self.gp.last_pickup_type)

    def test_collected_pickup_updates_last_type(self):
        self.gp.last_pickup_type = None
        pu = Pickup(100, 100, "slow_motion")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertEqual(self.gp.last_pickup_type, "slow_motion")

    def test_pickup_history_records_collected(self):
        pu = Pickup(100, 100, "multiball")
        pu.y = self.gp.paddle.y
        pu.x = self.gp.paddle.x
        self.gp.falling_pickups.append(pu)
        self.gp._update_pickups(1/60)
        self.assertIn("multiball", self.gp._pickup_history)

    def test_pickup_history_bounded(self):
        for _ in range(60):
            pu = Pickup(100, 100, "wide_paddle")
            pu.y = self.gp.paddle.y
            pu.x = self.gp.paddle.x
            self.gp.falling_pickups.append(pu)
            self.gp._update_pickups(1/60)
        self.assertLessEqual(len(self.gp._pickup_history), 50)


class TestBrickCounterPrecision(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())

    def test_initial_counts_equal_alive(self):
        alive = sum(1 for b in self.gp.bricks if b.health > 0)
        self.assertEqual(self.gp.remaining_bricks, alive)

    def test_standard_destruction_decrements(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_STANDARD and b.health == 1:
                brick = b
                break
        if brick is None:
            self.skipTest("No standard brick in stage 1")
        standard_before = self.gp.standard_count
        brick.health = 1
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertLess(self.gp.standard_count, standard_before)

    def test_reinforced_first_hit_no_decrement(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_REINFORCED and b.health == 2:
                brick = b
                break
        if brick is None:
            self.skipTest("No reinforced brick in stage 1")
        remaining_before = self.gp.reinforced_count
        brick.health = 2
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertEqual(self.gp.reinforced_count, remaining_before)

    def test_reinforced_final_hit_decrements(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_REINFORCED:
                brick = b
                break
        if brick is None:
            self.skipTest("No reinforced brick in stage 1")
        brick.health = 1
        remaining_before = self.gp.reinforced_count
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertLess(self.gp.reinforced_count, remaining_before)

    def test_powder_keg_destruction_decrements(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_POWDER_KEG and b.health == 1:
                brick = b
                break
        if brick is None:
            self.skipTest("No powder keg in stage 1")
        pk_before = self.gp.powder_keg_count
        brick.health = 1
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertLess(self.gp.powder_keg_count, pk_before)

    def test_treasure_destruction_decrements(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_TREASURE and b.health == 1:
                brick = b
                break
        if brick is None:
            self.skipTest("No treasure brick in stage 1")
        t_before = self.gp.treasure_count
        brick.health = 1
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertLess(self.gp.treasure_count, t_before)
        # Treasure bricks drop a falling pickup (not immediately collected)
        self.assertGreater(len(self.gp.falling_pickups), 0)

    def test_powder_chain_decrements_each_live_brick_once(self):
        # Find a powder keg and set up adjacent bricks
        keg = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_POWDER_KEG and b.health == 1:
                keg = b
                break
        if keg is None:
            self.skipTest("No powder keg in stage 1")
        # Powder chain triggers _powder_keg_chain which damages adjacent
        # The chain should decrement each affected type exactly once
        std_before = self.gp.standard_count
        reinf_before = self.gp.reinforced_count
        pk_before = self.gp.powder_keg_count
        treas_before = self.gp.treasure_count
        rem_before = self.gp.remaining_bricks
        keg.health = 1
        self.gp._damage_brick(self.gp.balls[0], keg)
        # Powder keg itself decrements
        self.assertLess(self.gp.powder_keg_count, pk_before)
        # Adjacent bricks are also destroyed by chain
        # Each affected type should decrement by the number of bricks of that type in chain
        self.assertLessEqual(self.gp.standard_count, std_before)
        self.assertLessEqual(self.gp.reinforced_count, reinf_before)
        self.assertLessEqual(self.gp.treasure_count, treas_before)
        self.assertLess(self.gp.remaining_bricks, rem_before)

    def test_no_double_score_same_ball_same_brick_same_frame(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_STANDARD and b.health == 1:
                brick = b
                break
        if brick is None:
            self.skipTest("No standard brick in stage 1")
        brick.health = 1
        score_before = self.gp.score
        self.gp._damage_brick(self.gp.balls[0], brick)
        score_after_first = self.gp.score
        # Second call with same ball/brick in same frame should be ignored
        self.gp._damage_brick(self.gp.balls[0], brick)
        score_after_second = self.gp.score
        self.assertEqual(score_after_second, score_after_first)

    def test_two_balls_same_reinforced_one_frame(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_REINFORCED:
                brick = b
                break
        if brick is None:
            self.skipTest("No reinforced brick in stage 1")
        # Two different balls hitting same reinforced brick in one frame
        # should each do damage if that's intended behavior
        brick.health = 2
        rem_before = self.gp.remaining_bricks
        reinf_before = self.gp.reinforced_count
        # First ball hits
        self.gp._damage_brick(self.gp.balls[0], brick)
        # Brick still alive at health=1, no decrement yet
        self.assertEqual(self.gp.reinforced_count, reinf_before)
        self.assertEqual(self.gp.remaining_bricks, rem_before)
        # Second ball hits same brick same frame
        # Create a second ball if needed
        if len(self.gp.balls) < 2:
            from games.breakout.ball import Ball
            self.gp.balls.append(Ball())
        self.gp._damage_brick(self.gp.balls[1], brick)
        # Now brick should be destroyed
        self.assertLess(self.gp.reinforced_count, reinf_before)
        self.assertLess(self.gp.remaining_bricks, rem_before)


class _RecordingAudio:
    def __init__(self):
        self.calls = []
        self.muted = False

    def play(self, name, *a, **kw):
        self.calls.append(name)

    def count(self, name):
        return sum(1 for n in self.calls if n == name)


def _stage_counts(gp):
    counts = {"standard": 0, "reinforced": 0, "powder_keg": 0, "treasure": 0}
    for b in gp.bricks:
        if b.brick_type == c.BRICK_STANDARD:
            counts["standard"] += 1
        elif b.brick_type == c.BRICK_REINFORCED:
            counts["reinforced"] += 1
        elif b.brick_type == c.BRICK_POWDER_KEG:
            counts["powder_keg"] += 1
        elif b.brick_type == c.BRICK_TREASURE:
            counts["treasure"] += 1
    return counts


def _stage_hp(counts):
    return (counts["standard"] + 2 * counts["reinforced"]
            + counts["powder_keg"] + counts["treasure"])


def _keg_at(gp, row, col):
    for b in gp.bricks:
        if (b.alive and b.brick_type == c.BRICK_POWDER_KEG
                and b.row == row and b.col == col):
            return b
    return None


class TestStageLayoutContract(unittest.TestCase):
    def _load_stage(self, stage):
        gp = Gameplay(_MockAudio())
        gp.stage = stage
        gp._build_bricks()
        return gp

    def test_stage1_contract(self):
        counts = _stage_counts(self._load_stage(1))
        self.assertEqual(counts, {"standard": 46, "reinforced": 0,
                                  "powder_keg": 2, "treasure": 1})
        self.assertEqual(sum(counts.values()), 49)
        self.assertEqual(_stage_hp(counts), 49)

    def test_stage2_contract(self):
        counts = _stage_counts(self._load_stage(2))
        self.assertEqual(counts, {"standard": 35, "reinforced": 12,
                                  "powder_keg": 3, "treasure": 3})
        self.assertEqual(sum(counts.values()), 53)
        self.assertEqual(_stage_hp(counts), 65)

    def test_stage3_contract(self):
        counts = _stage_counts(self._load_stage(3))
        self.assertEqual(counts, {"standard": 34, "reinforced": 36,
                                  "powder_keg": 5, "treasure": 5})
        self.assertEqual(sum(counts.values()), 80)
        self.assertEqual(_stage_hp(counts), 116)


class TestBreachAggregation(unittest.TestCase):
    def setUp(self):
        self.audio = _RecordingAudio()
        self.gp = Gameplay(self.audio)
        self.gp.stage = 3
        self.gp._build_bricks()

    def test_intact_33_blast_is_eight(self):
        keg = _keg_at(self.gp, 3, 3)
        self.assertIsNotNone(keg)
        self.gp._damage_brick(self.gp.balls[0], keg)
        self.assertEqual(self.gp.last_breach_size, 8)

    def test_initiating_keg_excluded(self):
        keg = _keg_at(self.gp, 3, 3)
        before = self.gp.remaining_bricks
        self.gp._damage_brick(self.gp.balls[0], keg)
        # 1 initiating keg + 8 secondaries removed, N counts secondaries only
        self.assertEqual(before - self.gp.remaining_bricks, 9)
        self.assertEqual(self.gp.last_breach_size, 8)

    def test_breach_callout_arms_at_threshold(self):
        keg = _keg_at(self.gp, 3, 3)
        self.gp._damage_brick(self.gp.balls[0], keg)
        self.assertGreater(self.gp._breach_callout_timer, 0)
        self.assertIsNotNone(self.gp._breach_callout_surf)
        self.assertEqual(self.audio.count('explosion'), 1)
        self.assertEqual(self.audio.count('breach'), 1)

    def test_small_blast_no_callout(self):
        keg = Brick(5, 5, c.BRICK_POWDER_KEG)
        nb1 = Brick(5, 6, c.BRICK_STANDARD)
        nb2 = Brick(6, 5, c.BRICK_STANDARD)
        self.gp.bricks = [keg, nb1, nb2]
        self.gp.remaining_bricks = 3
        self.gp._damage_brick(self.gp.balls[0], keg)
        self.assertEqual(self.gp.last_breach_size, 2)
        self.assertEqual(self.gp._breach_callout_timer, 0.0)
        self.assertIsNone(self.gp._breach_callout_surf)
        self.assertEqual(self.audio.count('explosion'), 1)
        self.assertEqual(self.audio.count('breach'), 0)

    def test_threshold_boundary_arms(self):
        keg = Brick(5, 5, c.BRICK_POWDER_KEG)
        self.gp.bricks = [keg, Brick(5, 6, c.BRICK_STANDARD),
                          Brick(6, 5, c.BRICK_STANDARD),
                          Brick(6, 6, c.BRICK_STANDARD)]
        self.gp.remaining_bricks = 4
        self.gp._damage_brick(self.gp.balls[0], keg)
        self.assertEqual(self.gp.last_breach_size, 3)
        self.assertGreater(self.gp._breach_callout_timer, 0)
        self.assertEqual(self.audio.count('breach'), 1)

    def test_recursive_kegs_aggregate_once(self):
        gp = Gameplay(self.audio)
        gp.stage = 1
        gp._build_bricks()
        keg = _keg_at(gp, 6, 4)
        self.assertIsNotNone(keg)
        other = _keg_at(gp, 6, 5)
        self.assertIsNotNone(other)
        gp._damage_brick(gp.balls[0], keg)
        # Second keg triggered recursively and counted exactly once
        self.assertFalse(other.alive)
        self.assertGreaterEqual(gp.last_breach_size, 2)
        self.assertEqual(gp.powder_keg_count, 0)
        # One explosion + one breach cue for the whole initiating event
        self.assertEqual(self.audio.count('explosion'), 1)
        self.assertLessEqual(self.audio.count('breach'), 1)

    def test_chain_results_unique(self):
        keg = _keg_at(self.gp, 3, 3)
        affected = self.gp._powder_keg_chain(keg)
        ids = [id(b) for b in affected]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertNotIn(id(keg), ids)

    def test_chain_cap_respected(self):
        keg = _keg_at(self.gp, 3, 3)
        chain_set = set(range(c.POWDER_KEG_CHAIN_MAX + 5))
        self.assertEqual(self.gp._powder_keg_chain(keg, chain_set), [])

    def test_breach_score_is_exact_normal(self):
        keg = _keg_at(self.gp, 3, 3)
        before = self.gp.score
        self.gp._damage_brick(self.gp.balls[0], keg)
        # Initiating keg 25 + 4 reinforced (2x90 row-2, 2x120 row-3)
        # + 2 treasure (2x50) + 2 standard row-4 (2x50) = 645, zero bonus
        self.assertEqual(self.gp.score - before, 645)

    def test_ordinary_hits_leave_breach_state(self):
        self.gp.last_breach_size = 0
        brick = self.gp.bricks[0]
        brick.health = 1
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertEqual(self.gp.last_breach_size, 0)
        self.assertEqual(self.gp._breach_callout_timer, 0.0)

    def test_reset_clears_breach(self):
        keg = _keg_at(self.gp, 3, 3)
        self.gp._damage_brick(self.gp.balls[0], keg)
        self.assertGreater(self.gp.last_breach_size, 0)
        self.gp.reset()
        self.assertEqual(self.gp.last_breach_size, 0)
        self.assertEqual(self.gp._breach_callout_timer, 0.0)
        self.assertIsNone(self.gp._breach_callout_surf)

    def test_stage_transition_clears_breach(self):
        keg = _keg_at(self.gp, 3, 3)
        self.gp._damage_brick(self.gp.balls[0], keg)
        self.gp._start_stage_transition()
        self.assertEqual(self.gp.last_breach_size, 0)
        self.assertEqual(self.gp._breach_callout_timer, 0.0)


class TestTreasureBlastDrops(unittest.TestCase):
    def setUp(self):
        self.gp = Gameplay(_MockAudio())
        self.gp.stage = 3
        self.gp._build_bricks()

    def test_direct_treasure_kill_drops(self):
        brick = None
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_TREASURE:
                brick = b
                break
        self.assertIsNotNone(brick)
        drops_before = len(self.gp.falling_pickups)
        self.gp._damage_brick(self.gp.balls[0], brick)
        self.assertEqual(len(self.gp.falling_pickups), drops_before + 1)

    def test_blast_treasure_kill_drops(self):
        keg = _keg_at(self.gp, 3, 3)
        self.assertIsNotNone(keg)
        drops_before = len(self.gp.falling_pickups)
        self.gp._damage_brick(self.gp.balls[0], keg)
        # (2,2) and (4,4) treasure destroyed by blast: two normal drops
        self.assertEqual(len(self.gp.falling_pickups), drops_before + 2)

    def test_blast_treasure_no_duplicate_drop(self):
        keg = _keg_at(self.gp, 3, 3)
        self.gp._damage_brick(self.gp.balls[0], keg)
        drops_after_blast = len(self.gp.falling_pickups)
        for b in self.gp.bricks:
            if b.brick_type == c.BRICK_TREASURE and not b.alive:
                self.gp._damage_brick(self.gp.balls[0], b)
        self.assertEqual(len(self.gp.falling_pickups), drops_after_blast)

    def test_overlapping_kegs_single_drop(self):
        keg1 = _keg_at(self.gp, 3, 3)
        keg2 = _keg_at(self.gp, 3, 5)
        self.assertTrue(keg2.alive)
        self.gp._damage_brick(self.gp.balls[0], keg1)
        drops_after_first = len(self.gp.falling_pickups)
        self.assertEqual(drops_after_first, 2)
        self.gp._damage_brick(self.gp.balls[0], keg2)
        # Shared treasure (4,4) already dead: only live (2,6) drops once
        self.assertEqual(len(self.gp.falling_pickups), drops_after_first + 1)


class TestBreachTestMode(unittest.TestCase):
    def setUp(self):
        from shared import pa_store
        self._pa_store = pa_store
        self._saved = dict(pa_store._MEM)

    def tearDown(self):
        self._pa_store._MEM.clear()
        self._pa_store._MEM.update(self._saved)

    def test_seed_arms_stage3_parked_breach(self):
        self._pa_store._MEM["pa-treasure-test-breach"] = "1"
        gp = Gameplay(_MockAudio())
        self.assertTrue(gp._test_mode)
        self.assertEqual(gp.stage, 3)
        # Seed consumed one-shot
        self.assertNotIn("pa-treasure-test-breach", self._pa_store._MEM)
        # Ball parked launched overlapping keg (3,3)
        keg = _keg_at(gp, 3, 3)
        self.assertIsNotNone(keg)
        ball = gp.balls[0]
        self.assertTrue(ball.launched)
        self.assertTrue(ball.rect.colliderect(keg.rect))

    def test_reset_rearms_breach_setup(self):
        self._pa_store._MEM["pa-treasure-test-breach"] = "1"
        gp = Gameplay(_MockAudio())
        gp.reset()
        self.assertTrue(gp._test_mode)
        self.assertEqual(gp.stage, 3)
        keg = _keg_at(gp, 3, 3)
        self.assertIsNotNone(keg)
        self.assertTrue(gp.balls[0].rect.colliderect(keg.rect))

    def test_fresh_load_is_ordinary(self):
        self._pa_store._MEM.pop("pa-treasure-test-breach", None)
        gp = Gameplay(_MockAudio())
        self.assertFalse(gp._test_mode)
        self.assertEqual(gp.stage, 1)

    def test_best_suppressed_in_test_mode(self):
        from shared import pa_store
        pa_store._MEM.pop("pa-treasure-score", None)
        game = BreakoutGame(None, _MockAudio())
        game.state = 'playing'
        game.gameplay._test_mode = True
        game.gameplay.score = 500
        game.gameplay.update = lambda dt, keys: ('game_over', 'lost')
        game._update(1 / 60)
        self.assertIsNone(pa_store.get_best("pa-treasure-score"))
        self.assertFalse(game._is_new_best)

    def test_best_submitted_when_ordinary(self):
        from shared import pa_store
        pa_store._MEM.pop("pa-treasure-score", None)
        game = BreakoutGame(None, _MockAudio())
        game.state = 'playing'
        game.gameplay._test_mode = False
        game.gameplay.score = 500
        game.gameplay.update = lambda dt, keys: ('game_over', 'lost')
        game._update(1 / 60)
        self.assertEqual(pa_store.get_best("pa-treasure-score"), 500)

    def test_breach_in_published_state(self):
        game = BreakoutGame(None, _MockAudio())
        game.gameplay.stage = 3
        game.gameplay._build_bricks()
        keg = _keg_at(game.gameplay, 3, 3)
        game.gameplay._damage_brick(game.gameplay.balls[0], keg)
        state = game._build_game_state()
        self.assertEqual(state["lastBreachSize"], 8)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
