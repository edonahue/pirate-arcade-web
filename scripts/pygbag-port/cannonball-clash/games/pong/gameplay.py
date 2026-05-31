import pygame as pg
import constants as c
from games.pong.paddle import Paddle
from games.pong.ball import Ball
from games.pong.powerup import PowerUp
from games.pong.ai import AI
from renderer import draw_center_line, draw_fps, draw_flash, HitParticle
import random
import math

class Gameplay:
    def __init__(self, audio):
        self.audio = audio
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.player_paddle = Paddle(c.PADDLE_MARGIN, c.WINDOW_HEIGHT // 2)
        self.ai_paddle = Paddle(c.WINDOW_WIDTH - c.PADDLE_MARGIN, c.WINDOW_HEIGHT // 2)
        self.ball = Ball()
        self.ai = AI()
        self.player_score = 0
        self.ai_score = 0
        self.powerup = None
        self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL
        self.show_fps = False
        self.hit_particles = []
        self.flash_timer = 0.0
        self._cached_pscore = -1
        self._cached_ascore = -1
        self._cached_psurf = None
        self._cached_asurf = None

    def set_difficulty(self, difficulty):
        self.ai.set_difficulty(difficulty)

    def reset_round(self):
        self.ball.reset()
        self.player_paddle.y = c.WINDOW_HEIGHT // 2
        self.ai_paddle.y = c.WINDOW_HEIGHT // 2
        self.player_paddle.vy = 0
        self.ai_paddle.vy = 0
        self.player_paddle.reset()
        self.ai_paddle.reset()

    def reset(self):
        self.player_score = 0
        self.ai_score = 0
        self.powerup = None
        self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL
        self.hit_particles = []
        self.flash_timer = 0.0
        self.reset_round()

    def _spawn_hit_particles(self, x, y):
        for _ in range(random.randint(8, 12)):
            self.hit_particles.append(HitParticle(x, y))

    def _check_win(self):
        if c.WIN_BY_TWO:
            if self.player_score >= c.WIN_SCORE and self.player_score - self.ai_score >= 2:
                return 'player'
            if self.ai_score >= c.WIN_SCORE and self.ai_score - self.player_score >= 2:
                return 'ai'
        else:
            if self.player_score >= c.WIN_SCORE:
                return 'player'
            if self.ai_score >= c.WIN_SCORE:
                return 'ai'
        return None

    def update(self, dt, keys):
        if keys is None:
            return ('playing', None)
        self.player_paddle.vy = 0
        if keys[pg.K_w] or keys[pg.K_UP]:
            self.player_paddle.vy = -c.PADDLE_SPEED
        if keys[pg.K_s] or keys[pg.K_DOWN]:
            self.player_paddle.vy = c.PADDLE_SPEED

        self.ai.update(self.ai_paddle, self.ball, dt)
        self.player_paddle.update(dt)
        self.ai_paddle.update(dt)

        self.ball.update(dt)

        if self.ball.y - c.BALL_SIZE // 2 <= 0:
            self.ball.y = c.BALL_SIZE // 2
            self.ball.vy = -self.ball.vy
            self.audio.play('wall_hit')
        if self.ball.y + c.BALL_SIZE // 2 >= c.WINDOW_HEIGHT:
            self.ball.y = c.WINDOW_HEIGHT - c.BALL_SIZE // 2
            self.ball.vy = -self.ball.vy
            self.audio.play('wall_hit')

        for paddle in (self.player_paddle, self.ai_paddle):
            if self.ball.rect.colliderect(paddle.rect):
                offset = (self.ball.y - paddle.y) / (paddle.height / 2)
                offset = max(-1, min(1, offset))
                angle = offset * 60
                direction = 1 if paddle is self.player_paddle else -1
                speed = self.ball.speed
                self.ball.vx = math.cos(math.radians(angle)) * speed * direction
                self.ball.vy = math.sin(math.radians(angle)) * speed
                if paddle is self.player_paddle:
                    self.ball.x = paddle.x + paddle.width // 2 + c.BALL_SIZE // 2
                else:
                    self.ball.x = paddle.x - paddle.width // 2 - c.BALL_SIZE // 2
                self.ball.bump_speed()
                self.audio.play('paddle_hit')
                self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL
                self._spawn_hit_particles(self.ball.x, self.ball.y)
                break

        if self.ball.x < -c.BALL_SIZE:
            self.ai_score += 1
            self.audio.play('score')
            self.flash_timer = 0.4
            win = self._check_win()
            if win:
                return ('game_over', win)
            self.reset_round()
        if self.ball.x > c.WINDOW_WIDTH + c.BALL_SIZE:
            self.player_score += 1
            self.audio.play('score')
            self.flash_timer = 0.4
            win = self._check_win()
            if win:
                return ('game_over', win)
            self.reset_round()

        self.powerup_spawn_timer -= dt
        if self.powerup_spawn_timer <= 0 and self.powerup is None:
            self.powerup = PowerUp()
            self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL

        if self.powerup:
            self.powerup.update(dt)
            if self.powerup.expired:
                self.powerup = None
            elif self.powerup.rect.colliderect(self.player_paddle.rect):
                self.player_paddle.activate_big()
                self.audio.play('powerup')
                self.powerup = None
                self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL

        self.hit_particles = [p for p in self.hit_particles if not p.dead]
        for p in self.hit_particles:
            p.update(dt)
        if self.flash_timer > 0:
            self.flash_timer -= dt

        return ('playing', None)

    def draw(self, surface, fps=0):
        surface.fill(c.PIRATE_NAVY)
        draw_center_line(surface)
        self.player_paddle.draw(surface)
        self.ai_paddle.draw(surface)
        self.ball.draw(surface)
        if self.powerup:
            self.powerup.draw(surface)
        for p in self.hit_particles:
            p.draw(surface)
        if self.player_score != self._cached_pscore or self.ai_score != self._cached_ascore:
            self._cached_pscore = self.player_score
            self._cached_ascore = self.ai_score
            self._cached_psurf = self.score_font.render(str(self.player_score), True, c.PIRATE_TEAL)
            self._cached_asurf = self.score_font.render(str(self.ai_score), True, c.PIRATE_TEAL)
        surface.blit(self._cached_psurf, (c.WINDOW_WIDTH // 2 - 120 - self._cached_psurf.get_width() // 2, 20))
        surface.blit(self._cached_asurf, (c.WINDOW_WIDTH // 2 + 120 - self._cached_asurf.get_width() // 2, 20))
        if self.flash_timer > 0:
            draw_flash(surface, self.flash_timer)
        if self.show_fps:
            draw_fps(surface, self.hud_font, fps)
