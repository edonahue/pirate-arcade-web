import pygame as pg
import constants as c
from games.pong.paddle import Paddle
from games.pong.ball import Ball
from games.pong.powerup import PowerUp
from games.pong.ai import AI
from renderer import draw_center_line, draw_fps, draw_flash, HitParticle
import random
import math
import builtins


def _segment_intersects_rect(x1, y1, x2, y2, rect):
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return rect.collidepoint(x1, y1)
    tmin, tmax = 0.0, 1.0
    if dx != 0:
        tx1 = (rect.left - x1) / dx
        tx2 = (rect.right - x1) / dx
        tmin = max(tmin, min(tx1, tx2))
        tmax = min(tmax, max(tx1, tx2))
    elif x1 < rect.left or x1 > rect.right:
        return False
    if dy != 0:
        ty1 = (rect.top - y1) / dy
        ty2 = (rect.bottom - y1) / dy
        tmin = max(tmin, min(ty1, ty2))
        tmax = min(tmax, max(ty1, ty2))
    elif y1 < rect.top or y1 > rect.bottom:
        return False
    return tmin <= tmax

class Gameplay:
    def __init__(self, audio):
        self.audio = audio
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.small_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SMALL)
        self.player_paddle = Paddle(c.PADDLE_MARGIN, c.WINDOW_HEIGHT // 2, side='left')
        self.ai_paddle = Paddle(c.WINDOW_WIDTH - c.PADDLE_MARGIN, c.WINDOW_HEIGHT // 2, side='right')
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
        self.rally_count = 0
        self.longest_rally = 0
        self.rally_tier = 0
        self.rally_callout_timer = 0.0
        self.rally_callout_text = None
        self.rally_callout_surf = None
        self.ai_shrink_timer = 0.0
        self.ai_base_height = c.PADDLE_HEIGHT
        self._cached_rally_surf = (None, None)
        self._cached_cursed_surf = (None, None)
        self.point_transition_timer = 0.0
        self.point_callout = None
        self._point_callout_surf = None
        self._tier_overlays = {}
        self._build_tier_overlays()

    def _build_tier_overlays(self):
        for tier, color in c.RALLY_GLOW_TIERS.items():
            surf = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT), pg.SRCALPHA)
            border_w = 30 + tier * 2
            alpha = min(60, 20 + tier * 2)
            pg.draw.rect(surf, (*color, alpha), (0, 0, c.WINDOW_WIDTH, border_w))
            pg.draw.rect(surf, (*color, alpha), (0, c.WINDOW_HEIGHT - border_w, c.WINDOW_WIDTH, border_w))
            pg.draw.rect(surf, (*color, alpha), (0, 0, border_w, c.WINDOW_HEIGHT))
            pg.draw.rect(surf, (*color, alpha), (c.WINDOW_WIDTH - border_w, 0, border_w, c.WINDOW_HEIGHT))
            self._tier_overlays[tier] = surf

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
        self.rally_count = 0
        self.rally_tier = 0
        self.rally_callout_timer = 0.0
        self.rally_callout_text = None
        self.rally_callout_surf = None
        self.ai_shrink_timer = 0.0
        self.ai_paddle.height = self.ai_base_height
        self.ai_paddle._built = False
        self.point_transition_timer = 0.0
        self.point_callout = None
        self._point_callout_surf = None

    def reset(self):
        self.player_score = 0
        self.ai_score = 0
        self.longest_rally = 0
        self.rally_tier = 0
        self.powerup = None
        self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL
        self.hit_particles = []
        self.flash_timer = 0.0
        self.ai_shrink_timer = 0.0
        self.ai_paddle.height = self.ai_base_height
        self.ai_paddle._built = False
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

        if self.point_transition_timer > 0:
            self.point_transition_timer -= dt
            if self.point_transition_timer <= 0:
                self.reset_round()
                self.ball.launch()
                self.point_callout = None
                self._point_callout_surf = None
            self.hit_particles = [p for p in self.hit_particles if not p.dead]
            for p in self.hit_particles:
                p.update(dt)
            if self.flash_timer > 0:
                self.flash_timer -= dt
            return ('playing', None)

        target_active = bool(getattr(builtins, "__pa_touch_active__", False))
        target_axis = getattr(builtins, "__pa_touch_axis__", None)
        target_value = getattr(builtins, "__pa_touch_value__", None)
        if target_active and target_axis == "y" and target_value is not None:
            half = self.player_paddle.height // 2
            target_y = float(target_value)
            target_y = max(half, min(c.WINDOW_HEIGHT - half, target_y))
            diff = target_y - self.player_paddle.y
            max_step = c.PADDLE_SPEED * dt * 1.5
            if abs(diff) > max_step:
                self.player_paddle.y += max(-max_step, min(max_step, diff))
            else:
                self.player_paddle.y = target_y
            self.player_paddle.vy = 0
        else:
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
            hit = self.ball.rect.colliderect(paddle.rect)
            if not hit:
                pr = paddle.rect
                r = c.BALL_SIZE // 2
                exp_rect = pr.inflate(r * 2, r * 2)
                hit = _segment_intersects_rect(self.ball.px, self.ball.py,
                                               self.ball.x, self.ball.y, exp_rect)
            if hit:
                is_player = paddle is self.player_paddle
                self.ball.last_hit_by = 'player' if is_player else 'ai'
                offset = (self.ball.y - paddle.y) / (paddle.height / 2)
                offset = max(-1, min(1, offset))
                angle = offset * 60
                direction = 1 if is_player else -1
                speed = self.ball.speed
                self.ball.vx = math.cos(math.radians(angle)) * speed * direction
                self.ball.vy = math.sin(math.radians(angle)) * speed
                if is_player:
                    self.ball.x = paddle.x + paddle.width // 2 + c.BALL_SIZE // 2
                else:
                    self.ball.x = paddle.x - paddle.width // 2 - c.BALL_SIZE // 2
                self.ball.bump_speed()
                self.rally_count += 1
                if self.rally_count > self.longest_rally:
                    self.longest_rally = self.rally_count
                new_tier = 0
                for m in sorted(c.RALLY_MILESTONES, reverse=True):
                    if self.rally_count >= m:
                        new_tier = m
                        break
                if new_tier > self.rally_tier:
                    self.rally_tier = new_tier
                    label = c.RALLY_LABELS.get(new_tier, f"RALLY {new_tier}")
                    self.rally_callout_text = label
                    self.rally_callout_surf = self.hud_font.render(label, True, c.PIRATE_GOLD)
                    self.rally_callout_timer = 1.5
                    self.ball.set_rally_tier(self.rally_tier)
                elif self.rally_tier > 0:
                    self.ball.set_rally_tier(self.rally_tier)
                self.audio.play('paddle_hit')
                self._spawn_hit_particles(self.ball.x, self.ball.y)
                paddle.trigger_recoil()
                break

        if self.ball.x < -c.BALL_SIZE:
            self.ai_score += 1
            self.audio.play('score')
            self.flash_timer = 0.4
            win = self._check_win()
            if win:
                return ('game_over', win)
            self.point_transition_timer = c.POINT_PAUSE_DURATION
            self.point_callout = 'ENEMY HIT!'
            self._point_callout_surf = self.hud_font.render(self.point_callout, True, c.PIRATE_RED)
        if self.ball.x > c.WINDOW_WIDTH + c.BALL_SIZE:
            self.player_score += 1
            self.audio.play('score')
            self.flash_timer = 0.4
            win = self._check_win()
            if win:
                return ('game_over', win)
            self.point_transition_timer = c.POINT_PAUSE_DURATION
            self.point_callout = 'HIT!'
            self._point_callout_surf = self.hud_font.render(self.point_callout, True, c.PIRATE_TEAL)

        self.powerup_spawn_timer -= dt
        if self.powerup_spawn_timer <= 0 and self.powerup is None:
            self.powerup = PowerUp()
            self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL

        if self.powerup:
            self.powerup.update(dt)
            if self.powerup.expired:
                self.powerup = None
            elif self.powerup.rect.colliderect(self.player_paddle.rect):
                if self.powerup.powerup_type == c.POWERUP_TYPE_LARGE_PADDLE:
                    self.player_paddle.activate_big()
                elif self.powerup.powerup_type == c.POWERUP_TYPE_CURSED_POWDER:
                    self.ai_shrink_timer = c.CURSED_POWDER_DURATION
                    shrink_h = int(self.ai_base_height * c.CURSED_POWDER_SHRINK)
                    self.ai_paddle.height = shrink_h
                    self.ai_paddle._built = False
                self.audio.play('powerup')
                self.powerup = None
                self.powerup_spawn_timer = c.POWERUP_SPAWN_INTERVAL

        if self.ai_shrink_timer > 0:
            self.ai_shrink_timer -= dt
            if self.ai_shrink_timer <= 0:
                self.ai_paddle.height = self.ai_base_height
                self.ai_paddle._built = False
                self.ai_shrink_timer = 0.0

        if self.rally_callout_timer > 0:
            self.rally_callout_timer -= dt
            if self.rally_callout_timer <= 0:
                self.rally_callout_text = None
                self.rally_callout_surf = None

        self.hit_particles = [p for p in self.hit_particles if not p.dead]
        for p in self.hit_particles:
            p.update(dt)
        if self.flash_timer > 0:
            self.flash_timer -= dt

        return ('playing', None)

    def draw(self, surface, fps=0):
        surface.fill(c.PIRATE_NAVY)
        draw_center_line(surface)
        tier_overlay = self._tier_overlays.get(self.rally_tier)
        if tier_overlay:
            surface.blit(tier_overlay, (0, 0))
        self.player_paddle.draw(surface)
        self.ai_paddle.draw(surface)

        if self.ai_shrink_timer > 0:
            pulse = abs(math.sin(pg.time.get_ticks() * 0.008))
            near_expiry = self.ai_shrink_timer < 2.0
            shrink_color = (180, 40, 180)
            if near_expiry and pulse > 0.7:
                shrink_color = (255, 100, 255)
            pg.draw.rect(surface, shrink_color, self.ai_paddle.rect, 3)

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

        if self.point_callout and self._point_callout_surf:
            cx = c.WINDOW_WIDTH // 2 - self._point_callout_surf.get_width() // 2
            cy = c.WINDOW_HEIGHT // 2 - 120
            surface.blit(self._point_callout_surf, (cx, cy))

        if self.rally_callout_surf and self.rally_callout_timer > 0:
            rx = c.WINDOW_WIDTH // 2 - self.rally_callout_surf.get_width() // 2
            ry = c.WINDOW_HEIGHT // 2 - 60
            surface.blit(self.rally_callout_surf, (rx, ry))

        if self._cached_rally_surf[0] != self.rally_count:
            txt = f"RALLY: {self.rally_count}"
            self._cached_rally_surf = (self.rally_count, self.small_font.render(txt, True, c.PIRATE_TAN))
        surface.blit(self._cached_rally_surf[1], (20, 20))

        cursed_secs = int(self.ai_shrink_timer)
        if self.ai_shrink_timer > 0:
            if self._cached_cursed_surf[0] != cursed_secs:
                txt = f"CURSED: {cursed_secs}s"
                self._cached_cursed_surf = (cursed_secs, self.small_font.render(txt, True, (180, 40, 180)))
            surface.blit(self._cached_cursed_surf[1], (20, 45))

        if self.flash_timer > 0:
            draw_flash(surface, self.flash_timer)
        if self.show_fps:
            draw_fps(surface, self.hud_font, fps)
