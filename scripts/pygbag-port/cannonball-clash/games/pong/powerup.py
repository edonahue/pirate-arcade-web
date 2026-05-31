import pygame as pg
import constants as c
import random
import math

class PowerUp:
    def __init__(self):
        self.x = random.uniform(c.WINDOW_WIDTH * c.POWERUP_SPAWN_MIN_X,
                                c.WINDOW_WIDTH * c.POWERUP_SPAWN_MAX_X)
        self.y = random.uniform(c.WINDOW_HEIGHT * 0.2, c.WINDOW_HEIGHT * 0.8)
        self.vy = c.POWERUP_FLOAT_SPEED
        self.vx = -c.POWERUP_DRIFT_SPEED
        self.timer = c.POWERUP_LIFETIME
        self.pulse = 0

    @property
    def rect(self):
        s = c.POWERUP_SIZE
        return pg.Rect(self.x - s // 2, self.y - s // 2, s, s)

    @property
    def expired(self):
        return self.timer <= 0 or self.x < -c.POWERUP_SIZE

    def update(self, dt):
        self.pulse += dt * 4
        self.x += self.vx * dt
        self.y += self.vy * dt
        if self.y < c.POWERUP_SIZE // 2 or self.y > c.WINDOW_HEIGHT - c.POWERUP_SIZE // 2:
            self.vy = -self.vy
        self.timer -= dt

    def draw(self, surface):
        s = c.POWERUP_SIZE
        pulse_extra = int(math.sin(self.pulse) * 4)
        current_size = s + pulse_extra
        rect = pg.Rect(self.x - current_size // 2, self.y - current_size // 2,
                       current_size, current_size)
        pg.draw.rect(surface, c.PIRATE_TREASURE, rect, border_radius=4)
        pg.draw.rect(surface, c.WHITE, rect, 3, border_radius=4)
        inner = current_size - 8
        if inner > 4:
            inner_rect = pg.Rect(self.x - inner // 2, self.y - inner // 2, inner, inner)
            pg.draw.rect(surface, c.WHITE, inner_rect, 1, border_radius=2)
