import pygame as pg
import constants as c
from games.breakout.paddle import Paddle
from games.breakout.ball import Ball
from games.breakout.brick import Brick
from games.breakout.pickup import Pickup
from renderer import draw_fps, draw_flash, HitParticle, ExplosionParticle
import random
import math
import builtins

_BRICK_FLASH_SURFS = []
for ai in range(8):
    s = pg.Surface((c.BRICK_WIDTH, c.BRICK_HEIGHT), pg.SRCALPHA)
    alpha = int(200 * ai / 7)
    s.fill((255, 255, 255, alpha))
    _BRICK_FLASH_SURFS.append(s)

STAGE_LAYOUTS = {
    1: [
        [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [ 0, 0, 0,-1,-1,-1,-1, 0, 0, 0],
        [ 0, 0,-1,-1,-1,-1,-1,-1, 0, 0],
        [ 0,-1,-1,-1, 3,-1,-1,-1,-1, 0],
        [ 0,-1,-1,-1,-1,-1,-1,-1,-1, 0],
        [ 0, 0,-1,-1,-1,-1,-1,-1, 0, 0],
        [ 0, 0, 0, 0, 2, 2, 0, 0, 0, 0],
        [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    2: [
        [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [ 1, 0, 0,-1,-1,-1,-1, 0, 0, 1],
        [ 0, 0, 3,-1,-1,-1,-1, 3, 0, 0],
        [ 0,-1,-1,-1, 2,-1,-1,-1,-1, 0],
        [ 0,-1,-1,-1,-1,-1,-1,-1,-1, 0],
        [ 0, 0, 2,-1,-1,-1,-1, 2, 0, 0],
        [ 0, 0, 0, 0, 3, 0, 0, 0, 0, 0],
        [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    3: [
        [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [ 1, 1, 3, 1, 1, 1, 3, 1, 1, 1],
        [ 1, 1, 1, 2, 1, 2, 1, 1, 1, 1],
        [ 0, 0, 0, 0, 3, 0, 0, 0, 0, 0],
        [ 0, 2, 0, 0, 0, 0, 0, 2, 0, 0],
        [ 0, 0, 0, 3, 0, 3, 0, 0, 0, 0],
        [ 0, 0, 0, 0, 2, 0, 0, 0, 0, 0],
    ],
}

STAGE_NAMES = {
    1: "Outer Wall",
    2: "Inner Fortress",
    3: "Treasure Vault",
}

LEGEND = {
    -1: c.BRICK_EMPTY,
    0: c.BRICK_STANDARD,
    1: c.BRICK_REINFORCED,
    2: c.BRICK_POWDER_KEG,
    3: c.BRICK_TREASURE,
}


class Gameplay:
    def __init__(self, audio):
        self.audio = audio
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.inst_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_INSTRUCTIONS)
        self.lives_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.stage_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_TITLE)
        self.small_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SMALL)

        self.paddle = Paddle()
        self.balls = [Ball()]
        self.bricks = []
        self.falling_pickups = []
        self.score = 0
        self.lives = c.PLAYER_LIVES
        self.stage = 1
        self.max_stage = c.MAX_STAGES
        self.show_fps = False
        self.hit_particles = []
        self.explosion_particles = []
        self.brick_flashes = []
        self.flash_timer = 0.0
        self.stage_transition_timer = 0.0
        self.stage_transition_phase = None
        self.wide_paddle_timer = 0.0
        self.slow_motion_timer = 0.0
        self.slow_motion_factor = c.BALL_BREAKOUT_SLOW_FACTOR
        self.run_complete = False
        self.last_pickup_type = None
        self._pickup_label_timer = 0.0
        self._pickup_label = None

        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._stage_banner_timer = 0.0
        self._stage_banner_surf = None

        self._build_bricks()

    def _get_stage_speed(self):
        return c.STAGE_START_SPEEDS.get(self.stage, c.BALL_BREAKOUT_SPEED)

    def _build_bricks(self):
        self.bricks = []
        layout = STAGE_LAYOUTS.get(self.stage, STAGE_LAYOUTS[1])
        for row in range(c.BRICK_ROWS):
            if row >= len(layout):
                break
            for col in range(c.BRICK_COLS):
                if col >= len(layout[row]):
                    break
                cell = layout[row][col]
                brick_type = LEGEND.get(cell, c.BRICK_EMPTY)
                if brick_type == c.BRICK_EMPTY:
                    continue
                self.bricks.append(Brick(col, row, brick_type))
        self.remaining_bricks = sum(1 for b in self.bricks if b.alive)
        self._count_brick_types()

    def _count_brick_types(self):
        self.standard_count = sum(1 for b in self.bricks if b.alive and b.brick_type == c.BRICK_STANDARD)
        self.reinforced_count = sum(1 for b in self.bricks if b.alive and b.brick_type == c.BRICK_REINFORCED)
        self.powder_keg_count = sum(1 for b in self.bricks if b.alive and b.brick_type == c.BRICK_POWDER_KEG)
        self.treasure_count = sum(1 for b in self.bricks if b.alive and b.brick_type == c.BRICK_TREASURE)

    def _spawn_brick_particles(self, brick):
        cx = brick.x + brick.width // 2
        cy = brick.y + brick.height // 2
        for _ in range(random.randint(6, 10)):
            self.hit_particles.append(HitParticle(cx, cy, color=brick.color))

    def _spawn_explosion_particles(self, brick):
        cx = brick.x + brick.width // 2
        cy = brick.y + brick.height // 2
        for _ in range(random.randint(15, 25)):
            self.explosion_particles.append(ExplosionParticle(cx, cy))

    def reset_round(self):
        self.paddle.reset()
        self.balls = [Ball()]
        primary = self.balls[0]
        primary.reset(self.paddle, speed=self._get_stage_speed())
        self.hit_particles = []
        self.explosion_particles = []
        self.brick_flashes = []
        self.falling_pickups = []
        self._pickup_label_timer = 0.0
        self._pickup_label = None

    def reset(self):
        self.score = 0
        self.lives = c.PLAYER_LIVES
        self.stage = 1
        self.hit_particles = []
        self.explosion_particles = []
        self.brick_flashes = []
        self.flash_timer = 0.0
        self.wide_paddle_timer = 0.0
        self.slow_motion_timer = 0.0
        self.run_complete = False
        self.stage_transition_timer = 0.0
        self.stage_transition_phase = None
        self._stage_banner_timer = 0.0
        self.last_pickup_type = None
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._build_bricks()
        self.reset_round()

    def _start_stage_transition(self):
        self.stage_transition_phase = "breached"
        self.stage_transition_timer = 2.0
        self.falling_pickups = []
        self._pickup_label_timer = 0.0
        self._pickup_label = None
        self.wide_paddle_timer = 0.0
        self.slow_motion_timer = 0.0
        self.paddle.wide_timer = 0.0
        if self.paddle.is_wide:
            self.paddle.width = self.paddle.base_width
            self.paddle._built = False
        for ball in self.balls:
            ball.trail.clear()
        self._remove_all_slow()

    def _remove_all_slow(self):
        for ball in self.balls:
            if hasattr(ball, '_slow_mult'):
                del ball._slow_mult

    def _apply_slow_to_all_balls(self):
        for ball in self.balls:
            ball.apply_slow(self.slow_motion_factor)

    def _remove_slow_from_all_balls(self):
        for ball in self.balls:
            ball.remove_slow()

    def _powder_keg_chain(self, start_brick, chain_set=None):
        if chain_set is None:
            chain_set = set()
        if len(chain_set) > c.POWDER_KEG_CHAIN_MAX:
            return
        affected = []
        cx = start_brick.x + start_brick.width // 2
        cy = start_brick.y + start_brick.height // 2
        for brick in self.bricks:
            if not brick.alive:
                continue
            if id(brick) in chain_set:
                continue
            bx = brick.x + brick.width // 2
            by = brick.y + brick.height // 2
            dx = abs(cx - bx)
            dy = abs(cy - by)
            if dx <= start_brick.width * 1.5 and dy <= start_brick.height * 1.5:
                chain_set.add(id(brick))
                self._spawn_brick_particles(brick)
                self._spawn_explosion_particles(brick)
                self.brick_flashes.append([brick.rect.copy(), 0.2])
                was_alive = brick.alive
                brick.health = 0
                if was_alive:
                    self.remaining_bricks -= 1
                    self.score += brick.points
                affected.append(brick)
                if brick.brick_type == c.BRICK_POWDER_KEG and brick is not start_brick:
                    self._powder_keg_chain(brick, chain_set)
        return affected

    def _drop_pickup(self, brick):
        pickup_types = c.PICKUP_TYPES
        pickup_type = random.choice(pickup_types)
        self.last_pickup_type = pickup_type
        pu = Pickup(brick.x + brick.width // 2, brick.y + brick.height, pickup_type)
        self.falling_pickups.append(pu)

    def _collect_pickup(self, pickup):
        if pickup.pickup_type == "multiball":
            if len(self.balls) >= c.MAX_BALLS:
                self.score += c.PICKUP_COLLECT_BONUS
            else:
                new_balls = []
                for ball in self.balls:
                    if len(self.balls) + len(new_balls) >= c.MAX_BALLS:
                        break
                    nb = ball.clone(self.paddle)
                    new_balls.append(nb)
                self.balls.extend(new_balls)
                if self.slow_motion_timer > 0:
                    for nb in new_balls:
                        nb.apply_slow(self.slow_motion_factor)
        elif pickup.pickup_type == "wide_paddle":
            self.paddle.activate_wide()
            self.wide_paddle_timer = self.paddle.wide_timer
        elif pickup.pickup_type == "slow_motion":
            self.slow_motion_timer = c.BALL_BREAKOUT_SLOW_DURATION
            self._apply_slow_to_all_balls()

        self._pickup_label = pickup.label
        self._pickup_label_timer = 1.5
        self.audio.play('powerup')

    def update(self, dt, keys):
        if keys is None:
            return ('playing', None)

        if self.stage_transition_phase:
            self.stage_transition_timer -= dt
            if self.stage_transition_timer <= 0:
                if self.stage_transition_phase == "breached":
                    if self.stage >= self.max_stage:
                        self.run_complete = True
                        return ('game_over', 'won')
                    self.stage += 1
                    self._build_bricks()
                    self.reset_round()
                    self.stage_transition_phase = "enter"
                    self.stage_transition_timer = 1.5
                    self._stage_banner_timer = 1.5
                    stage_name = STAGE_NAMES.get(self.stage, f"Stage {self.stage}")
                    self._stage_banner_surf = self.stage_font.render(
                        f"Stage {self.stage}: {stage_name}", True, c.PIRATE_GOLD)
                elif self.stage_transition_phase == "enter":
                    self.stage_transition_phase = None
                    self.stage_transition_timer = 0.0

            for p in self.hit_particles:
                p.update(dt)
            self.hit_particles = [p for p in self.hit_particles if not p.dead]
            for p in self.explosion_particles:
                p.update(dt)
            self.explosion_particles = [p for p in self.explosion_particles if not p.dead]
            return ('stage_transition', None)

        target_active = bool(getattr(builtins, "__pa_touch_active__", False))
        target_axis = getattr(builtins, "__pa_touch_axis__", None)
        target_value = getattr(builtins, "__pa_touch_value__", None)
        if target_active and target_axis == "x" and target_value is not None:
            half = self.paddle.width // 2
            target_x = float(target_value)
            target_x = max(half, min(c.WINDOW_WIDTH - half, target_x))
            diff = target_x - self.paddle.x
            max_step = c.PADDLE_BREAKOUT_SPEED * dt * 1.5
            if abs(diff) > max_step:
                self.paddle.x += max(-max_step, min(max_step, diff))
            else:
                self.paddle.x = target_x
            self.paddle.vx = 0
        else:
            self.paddle.vx = 0
            if keys[pg.K_a] or keys[pg.K_LEFT]:
                self.paddle.vx = -c.PADDLE_BREAKOUT_SPEED
            if keys[pg.K_d] or keys[pg.K_RIGHT]:
                self.paddle.vx = c.PADDLE_BREAKOUT_SPEED

        self.paddle.update(dt)

        for ball in self.balls:
            if not ball.launched:
                ball.stick_to_paddle(self.paddle)
                if keys[pg.K_SPACE]:
                    ball.launch()
                    self.audio.play('paddle_hit')
            else:
                ball.update(dt)

        for ball in self.balls:
            if not ball.launched:
                continue
            if ball.y - ball.radius <= 0:
                ball.y = ball.radius
                ball.vy = -ball.vy
                self.audio.play('wall_hit')
            if ball.x - ball.radius <= 0:
                ball.x = ball.radius
                ball.vx = -ball.vx
                self.audio.play('wall_hit')
            if ball.x + ball.radius >= c.WINDOW_WIDTH:
                ball.x = c.WINDOW_WIDTH - ball.radius
                ball.vx = -ball.vx
                self.audio.play('wall_hit')

            if ball.rect.colliderect(self.paddle.rect):
                offset = (ball.x - self.paddle.x) / (self.paddle.width / 2)
                offset = max(-1, min(1, offset))
                angle = offset * 60
                speed = ball.speed
                ball.vx = math.cos(math.radians(angle)) * speed
                ball.vy = -abs(math.sin(math.radians(angle)) * speed)
                ball.y = self.paddle.y - self.paddle.height // 2 - ball.radius
                ball.bump_speed()
                self.audio.play('paddle_hit')

            ball_rect = ball.rect
            for brick in self.bricks:
                if not brick.alive:
                    continue
                if ball_rect.colliderect(brick.rect):
                    self._resolve_brick_collision(ball, brick)
                    break

        falling_balls = 0
        launched_balls = 0
        for ball in self.balls:
            if ball.launched and ball.y + ball.radius > c.WINDOW_HEIGHT:
                falling_balls += 1
            elif ball.launched:
                launched_balls += 1

        if falling_balls > 0 and launched_balls == 0:
            if falling_balls >= len(self.balls):
                self.lives -= 1
                self.flash_timer = 0.3
                self.audio.play('life_lost')
                if self.lives <= 0:
                    return ('game_over', 'lost')
                self.reset_round()
                self.wide_paddle_timer = 0.0
                self.slow_motion_timer = 0.0
                self.paddle.wide_timer = 0.0
                if self.paddle.is_wide:
                    self.paddle.width = self.paddle.base_width
                    self.paddle._built = False
                self._remove_all_slow()
                return ('playing', None)
            else:
                self.balls = [b for b in self.balls if not (b.launched and b.y + b.radius > c.WINDOW_HEIGHT)]

        any_launched = any(b.launched for b in self.balls)
        if self.remaining_bricks == 0 and not self.stage_transition_phase and any_launched:
            self.audio.play('level_win')
            self._start_stage_transition()
            return ('stage_transition', None)

        self._update_pickups(dt)
        self._update_timers(dt)
        self._update_particles(dt)

        return ('playing', None)

    def _update_pickups(self, dt):
        for pickup in self.falling_pickups[:]:
            pickup.update(dt)
            if pickup.expired:
                self.falling_pickups.remove(pickup)
            elif pickup.rect.colliderect(self.paddle.rect):
                self._collect_pickup(pickup)
                self.falling_pickups.remove(pickup)
        if self._pickup_label_timer > 0:
            self._pickup_label_timer -= dt

    def _update_timers(self, dt):
        if self.wide_paddle_timer > 0:
            self.wide_paddle_timer -= dt
            if self.wide_paddle_timer <= 0:
                self.wide_paddle_timer = 0.0
                if not self.paddle.is_wide:
                    self.paddle.width = self.paddle.base_width
                    self.paddle._built = False

        if self.slow_motion_timer > 0:
            self.slow_motion_timer -= dt
            if self.slow_motion_timer <= 0:
                self.slow_motion_timer = 0.0
                self._remove_slow_from_all_balls()

        if self._stage_banner_timer > 0:
            self._stage_banner_timer -= dt

        if self.flash_timer > 0:
            self.flash_timer -= dt

    def _update_particles(self, dt):
        self.hit_particles = [p for p in self.hit_particles if not p.dead]
        for p in self.hit_particles:
            p.update(dt)
        self.explosion_particles = [p for p in self.explosion_particles if not p.dead]
        for p in self.explosion_particles:
            p.update(dt)
        for f in self.brick_flashes[:]:
            f[1] -= dt
            if f[1] <= 0:
                self.brick_flashes.remove(f)

    def _resolve_brick_collision(self, ball, brick):
        ball_rect = ball.rect
        brick_rect = brick.rect

        overlap_left = ball_rect.right - brick_rect.left
        overlap_right = brick_rect.right - ball_rect.left
        overlap_top = ball_rect.bottom - brick_rect.top
        overlap_bottom = brick_rect.bottom - ball_rect.top

        min_overlap = min(overlap_left, overlap_right, overlap_top, overlap_bottom)

        if min_overlap == overlap_left or min_overlap == overlap_right:
            ball.vx = -ball.vx
        else:
            ball.vy = -ball.vy

        self.score += brick.points
        self._spawn_brick_particles(brick)
        self.flash_timer = 0.15
        self.brick_flashes.append([brick.rect.copy(), 0.15])

        was_alive = brick.alive
        brick_type = brick.brick_type

        if brick_type == c.BRICK_POWDER_KEG and was_alive:
            self._spawn_explosion_particles(brick)
            self.brick_flashes.append([brick.rect.copy(), 0.3])
            brick.health = 0
            if was_alive:
                self.remaining_bricks -= 1
                self.score += brick.points
            self._powder_keg_chain(brick)
            self.audio.play('explosion')
            return

        brick.hit()
        if was_alive and not brick.alive:
            self.remaining_bricks -= 1
            if brick_type == c.BRICK_TREASURE:
                self._drop_pickup(brick)

        if brick_type == c.BRICK_REINFORCED and brick.health > 0:
            self.audio.play('wall_hit')
        else:
            self.audio.play('brick_break')

    def _handle_debug_hooks(self):
        pass

    def draw(self, surface, fps=0):
        surface.fill(c.PIRATE_NAVY)

        for rect, timer in self.brick_flashes:
            idx = int(timer / 0.3 * 7) if timer <= 0.3 else 7
            idx = max(0, min(7, idx))
            surface.blit(_BRICK_FLASH_SURFS[idx], rect)

        for brick in self.bricks:
            if brick.alive:
                brick.draw(surface)

        for ball in self.balls:
            ball.draw(surface)

        self.paddle.draw(surface)

        for pickup in self.falling_pickups:
            pickup.draw(surface)

        for p in self.hit_particles:
            p.draw(surface)
        for p in self.explosion_particles:
            p.draw(surface)

        if self._pickup_label and self._pickup_label_timer > 0:
            label_surf = self.hud_font.render(self._pickup_label, True, c.PIRATE_GOLD)
            lx = c.WINDOW_WIDTH // 2 - label_surf.get_width() // 2
            ly = c.WINDOW_HEIGHT // 2 - 40
            surface.blit(label_surf, (lx, ly))

        if self._stage_banner_timer > 0 and self._stage_banner_surf:
            bx = c.WINDOW_WIDTH // 2 - self._stage_banner_surf.get_width() // 2
            by = c.WINDOW_HEIGHT // 2 - 80
            surface.blit(self._stage_banner_surf, (bx, by))

            sub_label = self.hud_font.render("FORTRESS BREACHED!", True, c.PIRATE_GOLD)
            sx = c.WINDOW_WIDTH // 2 - sub_label.get_width() // 2
            sy = by + self._stage_banner_surf.get_height() + 10
            surface.blit(sub_label, (sx, sy))

        if self.score != self._cached_score:
            self._cached_score = self.score
            self._cached_score_surf = self.score_font.render(str(self.score), True, c.PIRATE_GOLD)
        sx = c.WINDOW_WIDTH // 2 - self._cached_score_surf.get_width() // 2
        surface.blit(self._cached_score_surf, (sx, 15))

        if self.lives != self._cached_lives:
            self._cached_lives = self.lives
            self._cached_lives_surf = self.lives_font.render(
                "CREW: " + "♠ " * self.lives, True, c.PIRATE_TEAL)
        lx = c.WINDOW_WIDTH - self._cached_lives_surf.get_width() - 20
        surface.blit(self._cached_lives_surf, (lx, 20))

        stage_text = f"STAGE {self.stage}/{self.max_stage}"
        stage_surf = self.small_font.render(stage_text, True, c.PIRATE_GOLD)
        surface.blit(stage_surf, (20, 20))

        balls_text = ""
        if len(self.balls) > 1:
            active = sum(1 for b in self.balls if b.launched and b.y + b.radius <= c.WINDOW_HEIGHT)
            balls_text = f"BALLS: {active}"
            balls_surf = self.small_font.render(balls_text, True, c.PIRATE_TAN)
            surface.blit(balls_surf, (20, 45))

        if self.wide_paddle_timer > 0:
            remaining = int(self.wide_paddle_timer)
            wp_text = f"WIDE: {remaining}s"
            wp_surf = self.small_font.render(wp_text, True, c.PIRATE_TEAL)
            wp_rect = wp_surf.get_rect()
            if balls_text:
                wp_rect.topleft = (20, 65)
            else:
                wp_rect.topleft = (20, 45)
            surface.blit(wp_surf, wp_rect)

        if self.slow_motion_timer > 0:
            remaining = int(self.slow_motion_timer)
            sm_text = f"SLOW: {remaining}s"
            sm_surf = self.small_font.render(sm_text, True, (100, 255, 100))
            sm_rect = sm_surf.get_rect()
            y_offset = 45 if not balls_text and self.wide_paddle_timer <= 0 else 65 if balls_text and self.wide_paddle_timer <= 0 else 85
            sm_rect.topleft = (20, y_offset)
            surface.blit(sm_surf, sm_rect)

        if self.flash_timer > 0:
            draw_flash(surface, self.flash_timer)

        if self.show_fps:
            draw_fps(surface, self.hud_font, fps)
