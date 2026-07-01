import asyncio
import pygame as pg
import constants as c
import highscores as hs
from games.pong.menu import Menu
from games.pong.gameplay import Gameplay
from renderer import draw_pause_overlay, draw_game_over, WinParticles, _VIGNETTE
from shared.pa_state import StatePublisher
from shared.pa_loop import should_draw


class PongGame:
    def __init__(self, surface, audio):
        self.surface = surface
        self.audio = audio
        self.menu = Menu()
        self.gameplay = Gameplay(audio)
        self.state = 'menu'
        self.paused = False
        self.game_over_state = None
        self.pause_selection = 0
        self.menu_selection = 0
        self.sound_enabled = True
        self.ai_difficulty = 'medium'
        self.game_over_timer = 0
        self.particles = WinParticles()
        self._state_pub = StatePublisher()
        self._last_draw_key = None

    async def run(self):
        while True:
            for event in pg.event.get():
                if event.type == pg.QUIT:
                    return
                if event.type == pg.KEYDOWN:
                    result = self._handle_key(event.key)
                    if result == 'quit':
                        return

            dt = 1 / 60
            self._update(dt)
            draw_key = (self.state, self.paused, self.menu_selection, self.pause_selection, self.sound_enabled)
            _should_draw, self._last_draw_key = should_draw(draw_key, self._last_draw_key)
            if self.state == 'playing' and not self.paused:
                _should_draw = True
            if _should_draw:
                self._draw(60)
                self._state_pub._stats["draws"] += 1
            pg.display.flip()
            self._state_pub._stats["presentations"] += 1
            await asyncio.sleep(0)

    def _handle_key(self, key):
        if self.state == 'menu':
            if key in (pg.K_w, pg.K_UP):
                self.menu_selection = (self.menu_selection - 1) % 2
                return
            if key in (pg.K_s, pg.K_DOWN):
                self.menu_selection = (self.menu_selection + 1) % 2
                return
            if key in (pg.K_SPACE, pg.K_RETURN):
                if self.menu_selection == 1:
                    return 'quit'
                self.state = 'playing'
                self.gameplay.reset()
                self.paused = False
                self.game_over_state = None
                self.game_over_timer = 0
                self.particles.reset()
                return

        if self.state == 'playing' and self.paused:
            if key in (pg.K_ESCAPE, pg.K_p):
                self.paused = False
                return
            if key in (pg.K_w, pg.K_UP):
                self.pause_selection = (self.pause_selection - 1) % 6
                return
            if key in (pg.K_s, pg.K_DOWN):
                self.pause_selection = (self.pause_selection + 1) % 6
                return
            if key in (pg.K_SPACE, pg.K_RETURN):
                if self.pause_selection == 0:
                    self.paused = False
                elif self.pause_selection == 1:
                    self.gameplay.reset()
                    self.paused = False
                    self.game_over_state = None
                    self.game_over_timer = 0
                    self.particles.reset()
                elif self.pause_selection == 2:
                    self.sound_enabled = not self.sound_enabled
                    self.audio.muted = not self.sound_enabled
                elif self.pause_selection == 3:
                    self.gameplay.show_fps = not self.gameplay.show_fps
                elif self.pause_selection == 4:
                    idx = c.AI_DIFFICULTY_ORDER.index(self.ai_difficulty)
                    idx = (idx + 1) % len(c.AI_DIFFICULTY_ORDER)
                    self.ai_difficulty = c.AI_DIFFICULTY_ORDER[idx]
                    self.gameplay.set_difficulty(self.ai_difficulty)
                elif self.pause_selection == 5:
                    self.state = 'menu'
                    self.paused = False
                    self.gameplay.reset()
                    self.particles.reset()
                return

        if key == pg.K_ESCAPE:
            if self.state == 'playing' and not self.paused:
                self.paused = True
                return
            elif self.state in ('game_over', 'menu'):
                return 'quit'
        if key in (pg.K_SPACE, pg.K_RETURN):
            if self.state == 'game_over':
                self.state = 'playing'
                self.gameplay.reset()
                self.paused = False
                self.game_over_state = None
                self.game_over_timer = 0
                self.particles.reset()
                return
        if self.state == 'playing' and not self.paused:
            if key == pg.K_f:
                self.gameplay.show_fps = not self.gameplay.show_fps
            if key == pg.K_p:
                self.paused = not self.paused

    def _state_event_key(self):
        return (
            self.state,
            self.paused,
            self.gameplay.player_score,
            self.gameplay.ai_score,
            self.state == "menu",
            getattr(self.gameplay, 'rally_tier', 0),
            None if self.gameplay.powerup is None else ("large_paddle" if self.gameplay.powerup.powerup_type == c.POWERUP_TYPE_LARGE_PADDLE else "cursed_powder"),
            getattr(self.gameplay, 'ai_shrink_timer', 0) > 0,
        )

    def _build_game_state(self):
        return {
            "gameId": "cannonball-clash",
            "phase": (
                "game-over" if self.state == "game_over"
                else "paused" if self.paused
                else self.state
            ),
            "score": self.gameplay.player_score,
            "secondaryScore": self.gameplay.ai_score,
            "playerPosition": self.gameplay.player_paddle.y,
            "actionReady": self.state == "menu",
            "ballSpeed": self.gameplay.ball.speed,
            "initialBallSpeed": c.BALL_SPEED_INITIAL,
            "maxBallSpeed": c.BALL_MAX_SPEED,
            "rallyCount": getattr(self.gameplay, 'rally_count', 0),
            "currentRally": getattr(self.gameplay, 'rally_count', 0),
            "longestRally": getattr(self.gameplay, 'longest_rally', 0),
            "rallyTier": getattr(self.gameplay, 'rally_tier', 0),
            "powerupType": None if self.gameplay.powerup is None else ("large_paddle" if self.gameplay.powerup.powerup_type == c.POWERUP_TYPE_LARGE_PADDLE else "cursed_powder"),
            "aiShrinkActive": getattr(self.gameplay, 'ai_shrink_timer', 0) > 0,
            "aiShrinkRemainingMs": int(getattr(self.gameplay, 'ai_shrink_timer', 0) * 1000),
            "aiDifficulty": self.gameplay.ai.speed_factor if hasattr(self.gameplay.ai, 'speed_factor') else 0.6,
        }

    def _update(self, dt):
        keys = pg.key.get_pressed()
        if self.state == 'playing' and not self.paused:
            result = self.gameplay.update(dt, keys)
            if result[0] == 'game_over':
                self.state = 'game_over'
                self.game_over_state = result[1]
                self.game_over_timer = 0
                if result[1] == 'player':
                    self.particles.reset()
                    self.audio.play('victory')
                    hs.submit_pong(
                        self.gameplay.player_score,
                        self.gameplay.ai_score,
                        self.ai_difficulty)
        elif self.state == 'game_over':
            self.game_over_timer += dt
            if self.game_over_state == 'player':
                self.particles.update(dt)
        active = self.state == 'playing' and not self.paused
        self._state_pub.tick(
            dt,
            event_key=self._state_event_key(),
            state_factory=self._build_game_state,
            active=active,
        )

    def _draw(self, fps):
        if self.state == 'menu':
            self.menu.draw(self.surface, self.menu_selection)
        elif self.state == 'playing':
            self.gameplay.draw(self.surface, fps=fps)
            if self.paused:
                draw_pause_overlay(
                    self.surface, self.menu.title_font,
                    self.pause_selection, self.sound_enabled,
                    self.gameplay.show_fps, self.ai_difficulty)
        elif self.state == 'game_over':
            self.gameplay.draw(self.surface, fps=fps)
            player_won = (self.game_over_state == 'player')
            draw_game_over(
                self.surface, self.menu.title_font,
                self.gameplay.score_font, self.menu.inst_font,
                self.gameplay.player_score, self.gameplay.ai_score,
                player_won, self.game_over_timer, self.particles)
        self.surface.blit(_VIGNETTE, (0, 0))
