import constants as c
import random

class AI:
    def __init__(self, difficulty='medium'):
        self.offset = 0
        self.offset_timer = 0
        self.set_difficulty(difficulty)

    def set_difficulty(self, difficulty):
        config = c.AI_DIFFICULTIES.get(difficulty, c.AI_DIFFICULTIES['medium'])
        self.speed_factor = config['speed_factor']
        self.offset_range = config['offset_range']

    def update(self, paddle, ball, dt):
        self.offset_timer -= dt
        if self.offset_timer <= 0:
            self.offset = random.uniform(-self.offset_range, self.offset_range)
            self.offset_timer = random.uniform(0.5, 1.5)
        target_y = ball.y + self.offset
        diff = target_y - paddle.y
        max_speed = c.BALL_SPEED_INITIAL * self.speed_factor
        if abs(diff) > 10:
            paddle.vy = max(-max_speed, min(max_speed, diff / 0.3))
        else:
            paddle.vy = 0
