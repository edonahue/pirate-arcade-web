import sys
import pygame as pg

pg.font.init()

import constants as c  # noqa: E402
from launcher import Launcher  # noqa: E402
from games.pong.game import PongGame  # noqa: E402
from games.breakout.game import BreakoutGame  # noqa: E402
from games.asteroids.game import AsteroidsGame  # noqa: E402
from games.pirate_dominion.game import PirateDominion  # noqa: E402
from audio import Audio  # noqa: E402

def run_game(game_class, surface, audio):
    game = game_class(surface, audio)
    return game.run()

VERSION = "2.0.0"

def main():
    if '--version' in sys.argv:
        print(f"Pirate Arcade {VERSION}")
        return
    pg.display.init()
    pg.font.init()

    flags = pg.SCALED | pg.DOUBLEBUF
    surface = pg.display.set_mode((c.WINDOW_WIDTH, c.WINDOW_HEIGHT), flags, vsync=1)
    pg.display.set_caption("PIRATE ARCADE")
    pg.key.set_repeat(0)

    audio = Audio()
    audio.load()

    launcher = Launcher(surface)

    while True:
        choice = launcher.run()
        launcher.surface = pg.display.get_surface()

        if choice == 'quit':
            break
        elif choice == 'pong':
            pg.display.set_caption("CANNONBALL CLASH")
            result = run_game(PongGame, pg.display.get_surface(), audio)
            pg.display.set_caption("PIRATE ARCADE")
            if result == 'quit':
                break
        elif choice == 'breakout':
            pg.display.set_caption("TREASURE COVE BREAKOUT")
            result = run_game(BreakoutGame, pg.display.get_surface(), audio)
            pg.display.set_caption("PIRATE ARCADE")
            if result == 'quit':
                break
        elif choice == 'asteroids':
            pg.display.set_caption("KRAKEN'S WAKE")
            result = run_game(AsteroidsGame, pg.display.get_surface(), audio)
            pg.display.set_caption("PIRATE ARCADE")
            if result == 'quit':
                break
        elif choice == 'pirate_dominion':
            pg.display.set_caption("PORT ROYALE TYCOON")
            result = run_game(PirateDominion, pg.display.get_surface(), audio)
            pg.display.set_caption("PIRATE ARCADE")
            if result == 'quit':
                break

    pg.quit()

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
    finally:
        pg.quit()
