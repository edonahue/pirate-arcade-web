import pygame
import numpy as np

class Audio:
    def __init__(self):
        pygame.mixer.quit()
        pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=1024)
        pygame.mixer.set_num_channels(16)
        self.sounds = {}
        self.muted = False

    def _make_tone(self, freq, duration, volume=0.5):
        sample_rate = 44100
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = np.sin(freq * t * 2 * np.pi) * volume
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_victory_tone(self):
        sample_rate = 44100
        duration = 0.5
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = np.sin(523 * t * 2 * np.pi) * 0.4
        tone += np.sin(659 * t * 2 * np.pi) * 0.3
        tone += np.sin(784 * t * 2 * np.pi) * 0.3
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_brick_break_tone(self):
        sample_rate = 44100
        duration = 0.12
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = np.sin(600 * t * 2 * np.pi) * 0.3
        tone += np.sin(900 * t * 2 * np.pi) * 0.2
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_life_lost_tone(self):
        sample_rate = 44100
        duration = 0.3
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = np.sin(200 * t * 2 * np.pi) * 0.4
        tone += np.sin(150 * t * 2 * np.pi) * 0.3
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_cannon_tone(self):
        sample_rate = 44100
        duration = 0.15
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = np.sin(180 * t * 2 * np.pi) * 0.5
        tone += np.sin(300 * t * 2 * np.pi) * 0.3
        tone += np.random.normal(0, 0.1, frames) * 0.5
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_explosion_tone(self):
        sample_rate = 44100
        duration = 0.2
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = np.sin(100 * t * 2 * np.pi) * 0.4
        tone += np.sin(200 * t * 2 * np.pi) * 0.3
        tone += np.random.normal(0, 0.15, frames) * 0.6
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_treasure_tone(self):
        sample_rate = 44100
        duration = 0.2
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = np.sin(880 * t * 2 * np.pi) * 0.3
        tone += np.sin(1100 * t * 2 * np.pi) * 0.2
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_dice_roll(self):
        sample_rate = 44100
        duration = 0.25
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        clicks = np.zeros(frames)
        for i in range(8):
            pos = int(frames * (0.05 + i * 0.1))
            if pos < frames:
                clicks[pos] = 1.0
        noise = np.random.normal(0, 0.08, frames)
        tone = (clicks * 0.5 + np.sin(300 * t * 2 * np.pi) * 0.15 + noise) * 0.5
        fade = np.linspace(1.0, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_coin_jingle(self):
        sample_rate = 44100
        duration = 0.3
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = (np.sin(1800 * t * 2 * np.pi) * 0.2 +
                np.sin(2200 * t * 2 * np.pi) * 0.15 +
                np.sin(2600 * t * 2 * np.pi) * 0.1)
        fade = np.linspace(0.2, 0.0, frames)
        tone = (tone * fade * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_ship_horn(self):
        sample_rate = 44100
        duration = 0.5
        frames = int(sample_rate * duration)
        t = np.linspace(0, duration, frames, False)
        tone = (np.sin(120 * t * 2 * np.pi) * 0.35 +
                np.sin(180 * t * 2 * np.pi) * 0.25)
        env = np.minimum(t * 4, 1.0) * np.linspace(1.0, 0.0, frames)
        tone = (tone * env * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def _make_card_shuffle(self):
        sample_rate = 44100
        duration = 0.15
        frames = int(sample_rate * duration)
        noise = np.random.normal(0, 0.2, frames) * np.linspace(1.0, 0.0, frames)
        tone = (noise * 32767).astype(np.int16)
        return pygame.sndarray.make_sound(tone)

    def load(self):
        self.sounds['paddle_hit'] = self._make_tone(440, 0.1)
        self.sounds['wall_hit'] = self._make_tone(220, 0.08)
        self.sounds['score'] = self._make_tone(180, 0.3)
        self.sounds['powerup'] = self._make_tone(660, 0.15)
        victory = self._make_victory_tone()
        self.sounds['victory'] = victory
        self.sounds['brick_break'] = self._make_brick_break_tone()
        self.sounds['life_lost'] = self._make_life_lost_tone()
        self.sounds['level_win'] = victory
        self.sounds['cannon_fire'] = self._make_cannon_tone()
        self.sounds['barrel_break'] = self._make_explosion_tone()
        self.sounds['treasure'] = self._make_treasure_tone()
        self.sounds['dice_roll'] = self._make_dice_roll()
        self.sounds['coin_jingle'] = self._make_coin_jingle()
        self.sounds['ship_horn'] = self._make_ship_horn()
        self.sounds['card_shuffle'] = self._make_card_shuffle()

    def play(self, name):
        if not self.muted and name in self.sounds:
            ch = pygame.mixer.find_channel()
            if ch:
                ch.play(self.sounds[name])
