import unittest
import sys
import os

_BASE = os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port")
sys.path.insert(0, os.path.join(_BASE, "krakens-wake"))
sys.path.insert(0, _BASE)
os.environ["SDL_VIDEODRIVER"] = "dummy"

import pygame as pg
import constants as c
from games.asteroids.game import AsteroidsGame
import builtins

builtins.__dict__["__pa_page_visible__"] = True


class _MockAudio:
    def play(self, *a, **kw):
        pass
    def muted(self):
        return False


class TestKrakenStress(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pg.init()
        cls.surface = pg.Surface((c.WINDOW_WIDTH, c.WINDOW_HEIGHT))

    @classmethod
    def tearDownClass(cls):
        pg.quit()

    def setUp(self):
        self.game = AsteroidsGame(self.surface, _MockAudio())
        self.game.state = "playing"
        self.game.paused = False

    def _spawn_barrels(self, count):
        for _ in range(count):
            from games.asteroids.barrel import Barrel
            b = Barrel(
                x=400, y=300,
                vx=50, vy=-30,
            )
            self.game.gameplay.barrels.append(b)

    def _run_steps(self, n, dt=1/60):
        for _ in range(n):
            self.game._update(dt)

    def test_no_crash_under_normal_load(self):
        self._spawn_barrels(10)
        self._run_steps(600)
        self.assertTrue(self.game.gameplay.ship.alive)
        for b in self.game.gameplay.barrels:
            self.assertTrue(b.alive)

    def test_no_crash_under_heavy_load(self):
        self._spawn_barrels(80)
        self._run_steps(600)
        ship = self.game.gameplay.ship
        self.assertFalse(
            any((b.x != b.x or b.y != b.y) for b in self.game.gameplay.barrels),
            "barrel NaN",
        )

    def test_ship_no_nan_after_stress(self):
        self._spawn_barrels(40)
        self._run_steps(1200)
        ship = self.game.gameplay.ship
        self.assertFalse(ship.x != ship.x, "ship x is NaN")
        self.assertFalse(ship.y != ship.y, "ship y is NaN")
        self.assertFalse(ship.vx != ship.vx, "ship vx is NaN")
        self.assertFalse(ship.vy != ship.vy, "ship vy is NaN")

    def test_ship_returns_to_center_after_wrap(self):
        self._spawn_barrels(30)
        ship = self.game.gameplay.ship
        ship.x = c.WINDOW_WIDTH // 2
        ship.y = c.WINDOW_HEIGHT // 2
        ship.vx = 5000
        ship.vy = 0
        self._run_steps(300)
        self.assertTrue(self.game.gameplay.ship.alive)

    def test_switching_phases_does_not_crash(self):
        self._spawn_barrels(20)
        for i in range(200):
            if i % 60 == 0:
                self.game.state = "menu"
            elif i % 60 == 30:
                self.game.state = "playing"
            self.game._update(1/60)

    def test_fixed_timer_integration_no_spiral(self):
        from shared.pa_loop import FixedStepTimer
        clock = iter([i * (1/60) for i in range(-1, 3000)])
        timer = FixedStepTimer(clock=lambda: next(clock))
        self._spawn_barrels(20)
        for _ in range(1200):
            frame = timer.begin_frame(active=True)
            for _ in range(frame.steps):
                self.game._update(frame.step_seconds)
                timer.metrics().record_step()
        m = timer.metrics().snapshot()
        self.assertGreaterEqual(m["simSteps"], 1100)
        self.assertLessEqual(m["cappedSteps"], 200)

    def test_empty_barrel_list_no_crash(self):
        self.game.gameplay.barrels.clear()
        self._run_steps(120)
        self.assertTrue(self.game.gameplay.ship.alive)

    def test_barrel_split_no_infinite_loop(self):
        from games.asteroids.barrel import Barrel
        b = Barrel(x=400, y=300, radius=Barrel.LARGE, vx=0, vy=0)
        children = b.split()
        self.assertLessEqual(len(children), 3)
        for child in children:
            grandchildren = child.split()
            self.assertLessEqual(len(grandchildren), 3)
            for gc in grandchildren:
                greats = gc.split()
                self.assertEqual(len(greats), 0)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
