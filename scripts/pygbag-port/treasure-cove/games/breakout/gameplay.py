import pygame as pg
import constants as c
from games.breakout.paddle import Paddle
from games.breakout.ball import Ball
from games.breakout.brick import Brick
from renderer import draw_fps, draw_flash, HitParticle
import random
import math
import builtins

_BRICK_FLASH_SURFS = []
for ai in range(8):
    s = pg.Surface((c.BRICK_WIDTH, c.BRICK_HEIGHT), pg.SRCALPHA)
    alpha = int(200 * ai / 7)
    s.fill((255, 255, 255, alpha))
    _BRICK_FLASH_SURFS.append(s)

class Gameplay:
    def __init__(self, audio):
        self.audio = audio
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.lives_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.paddle = Paddle()
        self.ball = Ball()
        self.bricks = []
        self.score = 0
        self.lives = c.PLAYER_LIVES
        self.show_fps = False
        self.hit_particles = []
        self.brick_flashes = []
        self.flash_timer = 0.0
        self.remaining_bricks = 0
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._build_bricks()

    def _build_bricks(self):
        self.bricks = []
        for row in range(c.BRICK_ROWS):
            for col in range(c.BRICK_COLS):
                self.bricks.append(Brick(col, row))
        self.remaining_bricks = len(self.bricks)

    def _spawn_brick_particles(self, brick):
        cx = brick.x + brick.width // 2
        cy = brick.y + brick.height // 2
        for _ in range(random.randint(6, 10)):
            self.hit_particles.append(HitParticle(cx, cy, color=brick.color))

    def reset_round(self):
        self.paddle.reset()
        self.ball.reset(self.paddle)
        self.hit_particles = []
        self.brick_flashes = []

    def reset(self):
        self.score = 0
        self.lives = c.PLAYER_LIVES
        self.hit_particles = []
        self.brick_flashes = []
        self.flash_timer = 0.0
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._build_bricks()
        self.reset_round()

    def update(self, dt, keys):
        if keys is None:
            return ('playing', None)
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

        if not self.ball.launched:
            self.ball.stick_to_paddle(self.paddle)
            if keys[pg.K_SPACE]:
                self.ball.launch()
                self.audio.play('paddle_hit')
        else:
            self.ball.update(dt)

            if self.ball.y - self.ball.radius <= 0:
                self.ball.y = self.ball.radius
                self.ball.vy = -self.ball.vy
                self.audio.play('wall_hit')
            if self.ball.x - self.ball.radius <= 0:
                self.ball.x = self.ball.radius
                self.ball.vx = -self.ball.vx
                self.audio.play('wall_hit')
            if self.ball.x + self.ball.radius >= c.WINDOW_WIDTH:
                self.ball.x = c.WINDOW_WIDTH - self.ball.radius
                self.ball.vx = -self.ball.vx
                self.audio.play('wall_hit')

            if self.ball.rect.colliderect(self.paddle.rect):
                offset = (self.ball.x - self.paddle.x) / (self.paddle.width / 2)
                offset = max(-1, min(1, offset))
                angle = offset * 60
                speed = self.ball.speed
                self.ball.vx = math.cos(math.radians(angle)) * speed
                self.ball.vy = -abs(math.sin(math.radians(angle)) * speed)
                self.ball.y = self.paddle.y - self.paddle.height // 2 - self.ball.radius
                self.ball.bump_speed()
                self.audio.play('paddle_hit')

            ball_rect = self.ball.rect
            for brick in self.bricks:
                if not brick.alive:
                    continue
                if ball_rect.colliderect(brick.rect):
                    self._resolve_brick_collision(brick)
                    break

            if self.ball.y + self.ball.radius > c.WINDOW_HEIGHT:
                self.lives -= 1
                self.flash_timer = 0.3
                self.audio.play('life_lost')
                if self.lives <= 0:
                    return ('game_over', 'lost')
                self.reset_round()
                return ('playing', None)

            if self.remaining_bricks == 0:
                self.audio.play('level_win')
                return ('game_over', 'won')

        self.hit_particles = [p for p in self.hit_particles if not p.dead]
        for p in self.hit_particles:
            p.update(dt)
        for f in self.brick_flashes[:]:
            f[1] -= dt
            if f[1] <= 0:
                self.brick_flashes.remove(f)
        if self.flash_timer > 0:
            self.flash_timer -= dt

        return ('playing', None)

    def _resolve_brick_collision(self, brick):
        ball_rect = self.ball.rect
        brick_rect = brick.rect

        overlap_left = ball_rect.right - brick_rect.left
        overlap_right = brick_rect.right - ball_rect.left
        overlap_top = ball_rect.bottom - brick_rect.top
        overlap_bottom = brick_rect.bottom - ball_rect.top

        min_overlap = min(overlap_left, overlap_right, overlap_top, overlap_bottom)

        if min_overlap == overlap_left or min_overlap == overlap_right:
            self.ball.vx = -self.ball.vx
        else:
            self.ball.vy = -self.ball.vy

        self.score += brick.points
        self._spawn_brick_particles(brick)
        self.flash_timer = 0.15
        self.brick_flashes.append([brick.rect.copy(), 0.15])
        was_alive = brick.alive
        brick.hit()
        if was_alive and not brick.alive:
            self.remaining_bricks -= 1
        self.audio.play('brick_break')

    def draw(self, surface, fps=0):
        surface.fill(c.PIRATE_NAVY)

        for rect, timer in self.brick_flashes:
            idx = int(timer / 0.15 * 7)
            idx = max(0, min(7, idx))
            surface.blit(_BRICK_FLASH_SURFS[idx], rect)

        for brick in self.bricks:
            if brick.alive:
                brick.draw(surface)

        self.ball.draw(surface)
        self.paddle.draw(surface)

        for p in self.hit_particles:
            p.draw(surface)

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

        if self.flash_timer > 0:
            draw_flash(surface, self.flash_timer)

        if self.show_fps:
            draw_fps(surface, self.hud_font, fps)
