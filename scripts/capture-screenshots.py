"""Capture real screenshots from all Pirate Arcade games.

Uses SDL_VIDEODRIVER=dummy (no display needed) and each game's internal
rendering API to capture representative frames.

Output: public/images/{game-name}.png at 1280x720

Usage:
    pip install Pillow
    python scripts/capture-screenshots.py
"""

import os
import sys

os.environ["SDL_VIDEODRIVER"] = "dummy"

import pygame as pg

pg.display.init()
pg.font.init()
pg.display.set_mode((1, 1), flags=pg.HIDDEN)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "localgame"))

import constants as c

W = c.WINDOW_WIDTH
H = c.WINDOW_HEIGHT
OUT_W, OUT_H = 1280, 720


class DummyAudio:
    def play(self, *args, **kwargs):
        pass

    def load(self, *args, **kwargs):
        pass


class MockKeys:
    """Mimics pygame.key.get_pressed() but writable.

    The games call e.g. keys[pg.K_UP] which expects a ScancodeWrapper-like
    object supporting __getitem__ with large key constants (SDL key codes).
    """

    def __init__(self):
        self._keys = {}

    def __getitem__(self, key):
        return self._keys.get(key, False)

    def __setitem__(self, key, val):
        self._keys[key] = bool(val)


audio = DummyAudio()


def _resize_and_save(surface, path):
    from PIL import Image

    raw = pg.image.tostring(surface, "RGB")
    img = Image.frombytes("RGB", (W, H), raw)
    img_resized = img.resize((OUT_W, OUT_H), Image.LANCZOS)
    img_resized.save(path, "PNG", optimize=True)
    print(f"  Saved {path} ({OUT_W}x{OUT_H})")


def capture_pong(out_dir):
    print("Cannonball Clash...")
    from games.pong.gameplay import Gameplay

    surface = pg.Surface((W, H))
    gameplay = Gameplay(audio)
    gameplay.reset()

    keys = MockKeys()
    keys[pg.K_UP] = True

    for _ in range(90):
        gameplay.update(1 / 60, keys)
        gameplay.draw(surface)

    _resize_and_save(surface, os.path.join(out_dir, "cannonball-clash.png"))


def capture_breakout(out_dir):
    print("Treasure Cove...")
    from games.breakout.gameplay import Gameplay

    surface = pg.Surface((W, H))
    gameplay = Gameplay(audio)
    gameplay.reset()

    gameplay.ball.launch()

    for b in gameplay.bricks[:12]:
        b.hit()
    gameplay.remaining_bricks = len([b for b in gameplay.bricks if b.alive])

    keys = MockKeys()
    keys[pg.K_LEFT] = True

    for _ in range(60):
        gameplay.update(1 / 60, keys)
        gameplay.draw(surface)

    _resize_and_save(surface, os.path.join(out_dir, "treasure-cove.png"))


def capture_asteroids(out_dir):
    print("Kraken's Wake...")
    from games.asteroids.gameplay import Gameplay

    surface = pg.Surface((W, H))
    gameplay = Gameplay(audio)
    gameplay.reset()

    keys = MockKeys()
    keys[pg.K_UP] = True
    keys[pg.K_RIGHT] = True

    for _ in range(90):
        gameplay.update(1 / 60, keys)
        gameplay.draw(surface)

    _resize_and_save(surface, os.path.join(out_dir, "krakens-wake.png"))


def capture_pirate_dominion(out_dir):
    print("Port Royale Tycoon...")
    from games.pirate_dominion.gameplay import Gameplay
    from games.pirate_dominion.player import Player
    from games.pirate_dominion.board import draw_board

    surface = pg.Surface((W, H))

    players = [
        Player(0, "Captain", "Jolly Roger", is_ai=False),
        Player(1, "First Mate", "Treasure Chest", is_ai=True, difficulty="medium"),
    ]
    properties = [None] * len(c.PD_PROPERTIES)

    gp = Gameplay(players, properties, audio)
    gp.start_game()

    gp.dice = (4, 3)
    gp.current_player.money = 1200
    gp.current_player.position = 3

    draw_board(
        surface,
        properties,
        players,
        gp.property_levels,
        dt=0.016,
        time=0,
        dice=gp.dice,
    )

    _resize_and_save(surface, os.path.join(out_dir, "port-royale-tycoon.png"))


def capture_launcher(out_dir):
    print("Launcher...")
    from launcher import Launcher

    surface = pg.Surface((W, H))
    launcher = Launcher(surface)
    launcher._draw()

    _resize_and_save(surface, os.path.join(out_dir, "launcher.png"))


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.join(script_dir, "..")
    out_dir = os.path.join(repo_root, "public", "images")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Capturing screenshots to {out_dir}")
    print(f"Native resolution: {W}x{H} -> output: {OUT_W}x{OUT_H}\n")

    capture_launcher(out_dir)
    capture_pong(out_dir)
    capture_breakout(out_dir)
    capture_asteroids(out_dir)
    capture_pirate_dominion(out_dir)

    print("\nDone. All screenshots captured.")


if __name__ == "__main__":
    main()
