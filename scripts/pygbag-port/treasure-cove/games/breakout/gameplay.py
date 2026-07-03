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

STAGE_BACKDROP_COLORS = {
    1: (15, 20, 40),
    2: (25, 15, 35),
    3: (10, 10, 20),
}

LEGEND = {
    -1: c.BRICK_EMPTY,
    0: c.BRICK_STANDARD,
    1: c.BRICK_REINFORCED,
    2: c.BRICK_POWDER_KEG,
    3: c.BRICK_TREASURE,
}

CREW_LOST_HOLD_DURATION = 0.7


class Gameplay:
    def __init__(self, audio):
        self.audio = audio
        self.score_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SCORE)
        self.hud_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.inst_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_INSTRUCTIONS)
        self.lives_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_HUD)
        self.stage_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_TITLE)
        self.small_font = pg.font.Font(c.FONT_NAME, c.FONT_SIZE_SMALL)

        self.paddle = Paddle(c.WINDOW_WIDTH // 2, c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN)
        self.balls = [Ball()]
        self.bricks = []
        self.falling_pickups = []
        self.score = 0
        self.lives = c.PLAYER_LIVES
        self.stage = 1
        self.max_stage = c.MAX_STAGES
        self.round = 1
        self.show_fps = False
        self.hit_particles = []
        self.explosion_particles = []
        self.brick_flashes = []
        self.flash_timer = 0.0
        self.stage_transition_timer = 0.0
        self.stage_transition_phase = None
        self.slow_motion_timer = 0.0
        self.slow_motion_factor = c.BALL_BREAKOUT_SLOW_FACTOR
        self.run_complete = False
        self.last_pickup_type = None
        self._pickup_label_timer = 0.0
        self._pickup_label = None
        self._pickup_label_surf = None
        self._life_lost_timer = 0.0
        self._life_lost_pending_reset = False
        self._brick_destruction_counts = {"standard": 0, "reinforced": 0, "powder_keg": 0, "treasure": 0}
        self.round_phase = "serve"
        self._pickup_history = []
        self._hit_bricks_this_frame = set()

        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._stage_banner_timer = 0.0
        self._stage_banner_surf = None

        self._cached_stage_text = None
        self._cached_stage_surf = None
        self._cached_balls_text = None
        self._cached_balls_surf = None
        self._cached_wide_text = None
        self._cached_wide_surf = None
        self._cached_slow_text = None
        self._cached_slow_surf = None
        self._cached_breached_surf = self.hud_font.render("FORTRESS BREACHED!", True, c.PIRATE_GOLD)

        self._backdrop_surfs = {}
        self._backdrop_stages_built = set()
        self._build_bricks()

    def _build_backdrop_surfs(self):
        for stage, color in STAGE_BACKDROP_COLORS.items():
            if stage in self._backdrop_stages_built:
                continue
            surf = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))
            surf.fill(color)
            stripe_color = (min(255, color[0] + 8), min(255, color[1] + 8), min(255, color[2] + 8))
            for sy in range(60, c.WINDOW_HEIGHT, 80):
                pg.draw.line(surf, stripe_color, (0, sy), (c.WINDOW_WIDTH, sy), 1)
            for sx in range(40, c.WINDOW_WIDTH, 120):
                pg.draw.line(surf, stripe_color, (sx, 0), (sx, c.WINDOW_HEIGHT), 1)
            if stage == 1:
                for i in range(3):
                    ay = 200 + i * 100
                    pts = [(0, ay), (100, ay - 40), (200, ay)]
                    pg.draw.lines(surf, (20, 30, 60), False, pts, 2)
            elif stage == 2:
                for i in range(4):
                    cx = 200 + i * 400
                    pg.draw.circle(surf, (40, 20, 50), (cx, 400), 60, 2)
                    pg.draw.circle(surf, (40, 20, 50), (cx, 400), 40, 1)
            elif stage == 3:
                for i in range(6):
                    gx = 100 + i * 250
                    gsize = 20 + (i * 5) % 31
                    gy = 500 + ((i * 37) % 201) - 100
                    pg.draw.circle(surf, (50, 40, 20, 60), (gx, gy), gsize, 1)
                    pg.draw.circle(surf, (60, 50, 25, 40), (gx, gy), gsize // 2, 1)
            self._backdrop_surfs[stage] = surf
            self._backdrop_stages_built.add(stage)

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
        count = min(random.randint(15, 25), 15)
        for _ in range(count):
            self.explosion_particles.append(ExplosionParticle(cx, cy))

    def reset_ball(self):
        self.paddle.x = c.WINDOW_WIDTH // 2
        self.paddle.y = c.WINDOW_HEIGHT - c.PADDLE_BREAKOUT_MARGIN
        self.paddle.vx = 0
        self.balls = [Ball()]
        primary = self.balls[0]
        primary.x = self.paddle.x
        primary.y = self.paddle.y - self.paddle.height // 2 - primary.radius - 1
        primary._underlying_speed = self._get_stage_speed()
        primary.speed = 0
        primary.launched = False
        primary.px = primary.x
        primary.py = primary.y
        self.hit_particles = []
        self.explosion_particles = []
        self.brick_flashes = []
        self.falling_pickups = []
        self._pickup_label_timer = 0.0
        self._pickup_label = None
        self._pickup_label_surf = None
        self._life_lost_timer = 0.0
        self._life_lost_pending_reset = False
        self.round_phase = "serve"

    def reset_round(self):
        self.reset_ball()

    def reset(self):
        self.score = 0
        self.lives = c.PLAYER_LIVES
        self.stage = 1
        self.round = 1
        self.hit_particles = []
        self.explosion_particles = []
        self.brick_flashes = []
        self.flash_timer = 0.0
        self.slow_motion_timer = 0.0
        self.run_complete = False
        self.stage_transition_timer = 0.0
        self.stage_transition_phase = None
        self._stage_banner_timer = 0.0
        self.last_pickup_type = None
        self._brick_destruction_counts = {"standard": 0, "reinforced": 0, "powder_keg": 0, "treasure": 0}
        self._pickup_history = []
        self._backdrop_stages_built = set()
        self._cached_score = -1
        self._cached_score_surf = None
        self._cached_lives = -1
        self._cached_lives_surf = None
        self._cached_stage_text = None
        self._cached_stage_surf = None
        self._cached_balls_text = None
        self._cached_balls_surf = None
        self._cached_wide_text = None
        self._cached_wide_surf = None
        self._cached_slow_text = None
        self._cached_slow_surf = None
        self._life_lost_timer = 0.0
        self._life_lost_pending_reset = False
        self._pickup_label = None
        self._pickup_label_surf = None
        self._build_bricks()
        self.reset_ball()

    def _start_stage_transition(self):
        self.stage_transition_phase = "breached"
        self.stage_transition_timer = 2.0
        self.falling_pickups = []
        self._pickup_label_timer = 0.0
        self._pickup_label = None
        self._pickup_label_surf = None
        self.slow_motion_timer = 0.0
        self.paddle.wide_timer = 0.0
        self._remove_all_slow()
        self._backdrop_stages_built = set()
        self.round = 1

    def _remove_all_slow(self):
        for ball in self.balls:
            ball.set_slow(False)

    def _apply_slow_to_all_balls(self):
        for ball in self.balls:
            ball.set_slow(True)

    def _remove_slow_from_all_balls(self):
        for ball in self.balls:
            ball.set_slow(False)

    def _powder_keg_chain(self, start_brick, chain_set=None):
        if chain_set is None:
            chain_set = set()
        chain_set.add(id(start_brick))
        if len(chain_set) > c.POWDER_KEG_CHAIN_MAX:
            return []
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
                if len(chain_set) >= c.POWDER_KEG_CHAIN_MAX:
                    continue
                chain_set.add(id(brick))
                self._spawn_brick_particles(brick)
                self._spawn_explosion_particles(brick)
                self.brick_flashes.append([brick.rect.copy(), 0.2])
                was_alive = brick.alive
                brick.health = 0
                if was_alive:
                    self.remaining_bricks -= 1
                    self.score += brick.points
                    self._track_brick_destruction(brick)
                affected.append(brick)
                if brick.brick_type == c.BRICK_POWDER_KEG and brick is not start_brick:
                    self._powder_keg_chain(brick, chain_set)
        return affected

    def _drop_pickup(self, brick):
        pickup_types = c.PICKUP_TYPES
        pickup_type = random.choice(pickup_types)
        pu = Pickup(brick.x + brick.width // 2, brick.y + brick.height, pickup_type)
        self.falling_pickups.append(pu)

    def _collect_pickup(self, pickup):
        if pickup.pickup_type == "multiball":
            target = max(3, len(self.balls))  # at least 3 balls total
            if len(self.balls) >= c.MAX_BALLS:
                self.score += c.PICKUP_COLLECT_BONUS
            else:
                to_add = min(target - len(self.balls), c.MAX_BALLS - len(self.balls))
                for _ in range(to_add):
                    src = random.choice(self.balls) if self.balls else Ball()
                    nb = Ball()
                    nb.x = src.x
                    nb.y = src.y
                    nb.px = src.px
                    nb.py = src.py
                    nb.vx = -src.vx
                    nb.vy = src.vy
                    nb.speed = src.speed
                    nb._underlying_speed = src._underlying_speed
                    nb._slow_mult = src._slow_mult
                    nb.launched = True
                    nb.set_radius(src.radius)
                    self.balls.append(nb)
        elif pickup.pickup_type == "wide_paddle":
            self.paddle.activate_wide()
        elif pickup.pickup_type == "slow_motion":
            self.slow_motion_timer = c.BALL_BREAKOUT_SLOW_DURATION
            self._apply_slow_to_all_balls()

        self.last_pickup_type = pickup.pickup_type
        self._pickup_label = pickup.label
        self._pickup_label_timer = 1.5
        self._pickup_label_surf = self.hud_font.render(pickup.label, True, c.PIRATE_GOLD)
        self.audio.play('powerup')
        self._pickup_history.append(pickup.pickup_type)
        if len(self._pickup_history) > 50:
            self._pickup_history.pop(0)

    def _track_brick_destruction(self, brick):
        bt = brick.brick_type
        if bt == c.BRICK_STANDARD:
            self._brick_destruction_counts["standard"] += 1
            self.standard_count -= 1
        elif bt == c.BRICK_REINFORCED:
            self._brick_destruction_counts["reinforced"] += 1
            self.reinforced_count -= 1
        elif bt == c.BRICK_POWDER_KEG:
            self._brick_destruction_counts["powder_keg"] += 1
            self.powder_keg_count -= 1
        elif bt == c.BRICK_TREASURE:
            self._brick_destruction_counts["treasure"] += 1
            self.treasure_count -= 1

    def _resolve_brick_swept(self, ball, brick):
        brick_rect = brick.rect
        bx1, by1 = ball.px, ball.py
        bx2, by2 = ball.x, ball.y
        dx = bx2 - bx1
        dy = by2 - by1
        if dx == 0 and dy == 0:
            return False
        r = ball.radius
        exp_rect = brick_rect.inflate(r * 2, r * 2)
        tmin, tmax = 0.0, 1.0
        if dx != 0:
            tx1 = (exp_rect.left - bx1) / dx
            tx2 = (exp_rect.right - bx1) / dx
            tmin = max(tmin, min(tx1, tx2))
            tmax = min(tmax, max(tx1, tx2))
        elif bx1 < exp_rect.left or bx1 > exp_rect.right:
            return False
        if dy != 0:
            ty1 = (exp_rect.top - by1) / dy
            ty2 = (exp_rect.bottom - by1) / dy
            tmin = max(tmin, min(ty1, ty2))
            tmax = min(tmax, max(ty1, ty2))
        elif by1 < exp_rect.top or by1 > exp_rect.bottom:
            return False
        if tmin > tmax:
            return False
        hit_x = bx1 + dx * tmin
        hit_y = by1 + dy * tmin
        if dx > 0:
            hit_from_left = hit_x <= brick_rect.centerx
        elif dx < 0:
            hit_from_left = False
        else:
            hit_from_left = True
        if dy > 0:
            hit_from_top = hit_y <= brick_rect.centery
        elif dy < 0:
            hit_from_top = False
        else:
            hit_from_top = True
        overlap_x = abs(hit_x - brick_rect.centerx) / brick_rect.width
        overlap_y = abs(hit_y - brick_rect.centery) / brick_rect.height
        if overlap_x >= overlap_y:
            if hit_from_left:
                ball.vx = -abs(ball.vx)
            else:
                ball.vx = abs(ball.vx)
        else:
            if hit_from_top:
                ball.vy = -abs(ball.vy)
            else:
                ball.vy = abs(ball.vy)
        ball.x = bx1 + dx * max(0.0, min(1.0, tmin - 0.01))
        ball.y = by1 + dy * max(0.0, min(1.0, tmin - 0.01))
        ball.ensure_min_vy()
        self._damage_brick(ball, brick)
        return True

    def update(self, dt, keys):
        if keys is None:
            return ('playing', None)

        if self._life_lost_pending_reset and self._life_lost_timer <= 0:
            self._life_lost_pending_reset = False
            self.reset_ball()
            self.slow_motion_timer = 0.0
            self.paddle.wide_timer = 0.0
            self._remove_all_slow()
            self._pickup_label = None
            self._pickup_label_surf = None
            self._pickup_label_timer = 0.0
            self._life_lost_timer = -1.0
            return ('playing', None)

        if self._life_lost_timer > 0:
            self._life_lost_timer -= dt
            self._update_particles(dt)
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
                    self.reset_ball()
                    self.stage_transition_phase = "enter"
                    self.stage_transition_timer = 1.5
                    self._stage_banner_timer = 1.5
                    stage_name = STAGE_NAMES.get(self.stage, f"Stage {self.stage}")
                    self._stage_banner_surf = self.stage_font.render(
                        f"Stage {self.stage}: {stage_name}", True, c.PIRATE_GOLD)
                elif self.stage_transition_phase == "enter":
                    self.stage_transition_phase = None
                    self.stage_transition_timer = 0.0

            self._update_particles(dt)
            return ('stage_transition', None)

        target_active = bool(getattr(builtins, "__pa_touch_active__", False))
        target_axis = getattr(builtins, "__pa_touch_axis__", None)
        target_value = getattr(builtins, "__pa_touch_value__", None)
        if target_active and target_axis == "x" and target_value is not None:
            half = c.PADDLE_BREAKOUT_WIDTH // 2
            w = c.PADDLE_BREAKOUT_WIDTH
            if self.paddle.wide_timer > 0:
                w = int(c.PADDLE_BREAKOUT_WIDTH * c.PADDLE_BREAKOUT_WIDE_MULTIPLIER)
                half = w // 2
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
                ball.x = self.paddle.x
                ball.y = self.paddle.y - self.paddle.height // 2 - ball.radius - 1
                if keys[pg.K_SPACE]:
                    ball.launch()
                    self.audio.play('paddle_hit')
            else:
                ball.update(dt)

        self._hit_bricks_this_frame = set()

        for ball in self.balls:
            if not ball.launched:
                continue
            if ball.y - ball.radius <= 0:
                ball.y = ball.radius
                ball.vy = -ball.vy
                ball.ensure_min_vy()
                self.audio.play('wall_hit')
            if ball.x - ball.radius <= 0:
                ball.x = ball.radius
                ball.vx = -ball.vx
                self.audio.play('wall_hit')
            if ball.x + ball.radius >= c.WINDOW_WIDTH:
                ball.x = c.WINDOW_WIDTH - ball.radius
                ball.vx = -ball.vx
                self.audio.play('wall_hit')

            if ball.vy > 0 and ball.rect.colliderect(self.paddle.rect):
                offset = (ball.x - self.paddle.x) / (self.paddle.rect.width / 2)
                offset = max(-1, min(1, offset))
                angle = offset * 60
                speed = ball.speed
                ball.vx = math.cos(math.radians(angle)) * speed
                ball.vy = -abs(math.sin(math.radians(angle)) * speed)
                ball.y = self.paddle.rect.top - ball.radius
                ball.bump_speed()
                ball.ensure_min_vy()
                self.audio.play('paddle_hit')

            for brick in self.bricks:
                if not brick.alive:
                    continue
                if ball.rect.colliderect(brick.rect):
                    self._resolve_brick_collision(ball, brick)
                    break
                elif self._resolve_brick_swept(ball, brick):
                    if not brick.alive:
                        break

        falling_balls = 0
        launched_balls = 0
        for ball in self.balls:
            if ball.launched and ball.y + ball.radius > c.WINDOW_HEIGHT:
                falling_balls += 1
            elif ball.launched:
                launched_balls += 1

        if falling_balls > 0 and launched_balls == 0:
            self.lives -= 1
            self.round += 1
            self.flash_timer = 0.3
            self.audio.play('life_lost')
            if self.lives <= 0:
                return ('game_over', 'lost')
            self._life_lost_timer = CREW_LOST_HOLD_DURATION
            self._life_lost_pending_reset = True
            self._pickup_label = "CREW LOST!"
            self._pickup_label_surf = self.hud_font.render("CREW LOST!", True, c.PIRATE_RED)
            self._pickup_label_timer = CREW_LOST_HOLD_DURATION + 0.2
            return ('playing', None)
        elif falling_balls > 0 and launched_balls > 0:
            self.balls = [b for b in self.balls if not (b.launched and b.y + b.radius > c.WINDOW_HEIGHT)]

        any_launched = any(b.launched for b in self.balls)
        if self.remaining_bricks == 0 and not self.stage_transition_phase and any_launched:
            self.audio.play('level_win')
            self._start_stage_transition()
            return ('stage_transition', None)

        self._update_pickups(dt)
        self._update_timers(dt)
        self._update_particles(dt)

        # Round phase
        if self._life_lost_pending_reset:
            self.round_phase = "life-lost-hold"
        elif any(b.launched for b in self.balls):
            self.round_phase = "active"
        else:
            self.round_phase = "serve"

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
        if self.slow_motion_timer > 0:
            self.slow_motion_timer -= dt
            if self.slow_motion_timer <= 0:
                self.slow_motion_timer = 0.0
                self._remove_slow_from_all_balls()

        if self._life_lost_timer > 0:
            self._life_lost_timer -= dt

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

    def _damage_brick(self, ball, brick):
        hit_key = (id(ball), id(brick))
        if hit_key in self._hit_bricks_this_frame:
            return
        self._hit_bricks_this_frame.add(hit_key)

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
                self._track_brick_destruction(brick)
            self._powder_keg_chain(brick)
            self.audio.play('explosion')
            return

        brick.hit()
        if was_alive and not brick.alive:
            self.remaining_bricks -= 1
            self._track_brick_destruction(brick)
            if brick_type == c.BRICK_TREASURE:
                self._drop_pickup(brick)

        if brick_type == c.BRICK_REINFORCED and brick.health > 0:
            self.audio.play('wall_hit')
        else:
            self.audio.play('brick_break')

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

        ball.ensure_min_vy()

        self._damage_brick(ball, brick)

    def _handle_debug_hooks(self):
        pass

    def draw(self, surface, fps=0):
        if not self._backdrop_surfs:
            self._build_backdrop_surfs()
        backdrop = self._backdrop_surfs.get(self.stage)
        if backdrop:
            surface.blit(backdrop, (0, 0))
        else:
            surface.fill(c.PIRATE_NAVY)

        for brick in self.bricks:
            if brick.alive:
                brick.draw(surface)

        for rect, timer in self.brick_flashes:
            idx = int(timer / 0.3 * 7) if timer <= 0.3 else 7
            idx = max(0, min(7, idx))
            surface.blit(_BRICK_FLASH_SURFS[idx], rect)

        for ball in self.balls:
            ball.draw(surface)

        self.paddle.draw(surface)

        for pickup in self.falling_pickups:
            pickup.draw(surface)

        for p in self.hit_particles:
            p.draw(surface)
        for p in self.explosion_particles:
            p.draw(surface)

        if self._pickup_label_surf and self._pickup_label_timer > 0:
            lx = c.WINDOW_WIDTH // 2 - self._pickup_label_surf.get_width() // 2
            ly = c.WINDOW_HEIGHT // 2 - 40
            surface.blit(self._pickup_label_surf, (lx, ly))

        if self._stage_banner_timer > 0 and self._stage_banner_surf:
            bx = c.WINDOW_WIDTH // 2 - self._stage_banner_surf.get_width() // 2
            by = c.WINDOW_HEIGHT // 2 - 80
            surface.blit(self._stage_banner_surf, (bx, by))

            sx = c.WINDOW_WIDTH // 2 - self._cached_breached_surf.get_width() // 2
            sy = by + self._stage_banner_surf.get_height() + 10
            surface.blit(self._cached_breached_surf, (sx, sy))

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
        if stage_text != self._cached_stage_text:
            self._cached_stage_text = stage_text
            self._cached_stage_surf = self.small_font.render(stage_text, True, c.PIRATE_GOLD)
        surface.blit(self._cached_stage_surf, (20, 20))

        balls_text = ""
        if len(self.balls) > 1:
            active = sum(1 for b in self.balls if b.launched and b.y + b.radius <= c.WINDOW_HEIGHT)
            balls_text = f"BALLS: {active}"
            if balls_text != self._cached_balls_text:
                self._cached_balls_text = balls_text
                self._cached_balls_surf = self.small_font.render(balls_text, True, c.PIRATE_TAN)
            surface.blit(self._cached_balls_surf, (20, 45))

        wide_timer = self.paddle.wide_timer
        if wide_timer > 0:
            remaining = int(wide_timer)
            wp_text = f"WIDE: {remaining}s"
            if wp_text != self._cached_wide_text:
                self._cached_wide_text = wp_text
                self._cached_wide_surf = self.small_font.render(wp_text, True, c.PIRATE_TEAL)
            wp_rect = self._cached_wide_surf.get_rect()
            if balls_text:
                wp_rect.topleft = (20, 65)
            else:
                wp_rect.topleft = (20, 45)
            surface.blit(self._cached_wide_surf, wp_rect)

        if self.slow_motion_timer > 0:
            remaining = int(self.slow_motion_timer)
            sm_text = f"SLOW: {remaining}s"
            if sm_text != self._cached_slow_text:
                self._cached_slow_text = sm_text
                self._cached_slow_surf = self.small_font.render(sm_text, True, (100, 255, 100))
            sm_rect = self._cached_slow_surf.get_rect()
            y_base = 45
            if balls_text:
                y_base += 20
            if wide_timer > 0:
                y_base += 20
            sm_rect.topleft = (20, y_base)
            surface.blit(self._cached_slow_surf, sm_rect)

        if self.flash_timer > 0:
            draw_flash(surface, self.flash_timer)

        if self.show_fps:
            draw_fps(surface, self.hud_font, fps)
