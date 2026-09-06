import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port/krakens-wake"))

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port"))
import pygame as pg  # noqa: E402

pg.init()

from games.asteroids.kraken import KrakenBoss, DAMAGING_PHASES, VULNERABLE_PHASES  # noqa: E402
import constants as c  # noqa: E402


class FakeShot:
    def __init__(self):
        self.life = 1.5


def make_boss(x=800.0, y=300.0, hp=12):
    boss = KrakenBoss(x, y, hp=hp)
    return boss


def step(boss, n, dt=1.0 / 60, ship=(800.0, 450.0)):
    for _ in range(n):
        boss.update(dt, ship[0], ship[1])


class TestBossCadence(unittest.TestCase):
    def test_boss_waves_display_2_5_8(self):
        # internal wave % 3 == 1  <=>  display wave % 3 == 2
        boss_waves = [w for w in range(0, 12) if KrakenBoss.is_boss_wave(w)]
        self.assertEqual(boss_waves, [1, 4, 7, 10])

    def test_hp_scaling(self):
        self.assertEqual(KrakenBoss.hp_for_wave(1), 12)
        self.assertEqual(KrakenBoss.hp_for_wave(4), 14)
        self.assertEqual(KrakenBoss.hp_for_wave(7), 16)
        self.assertEqual(KrakenBoss.hp_for_wave(28), c.KRAKEN_HP_MAX)
        self.assertEqual(KrakenBoss.hp_for_wave(100), c.KRAKEN_HP_MAX)


class TestBossSpawnContract(unittest.TestCase):
    def test_spawn_offscreen_top_near_ship_x(self):
        boss = make_boss()
        boss.begin_entry(800.0)
        self.assertEqual(boss.x, 800.0)
        self.assertEqual(boss.y, c.KRAKEN_SPAWN_Y)
        self.assertLess(boss.y, 0)
        self.assertEqual(boss.phase, "entering")

    def test_spawn_x_clamped_to_playfield(self):
        boss = make_boss()
        boss.begin_entry(50.0)
        self.assertEqual(boss.x, c.KRAKEN_SPAWN_X_MIN)
        boss.begin_entry(1590.0)
        self.assertEqual(boss.x, c.KRAKEN_SPAWN_X_MAX)

    def test_farthest_anchor_deterministic(self):
        self.assertEqual(KrakenBoss.farthest_anchor(800.0, 450.0), (350, 180))
        self.assertEqual(KrakenBoss.farthest_anchor(350.0, 180.0), (1250, 180))
        twice = KrakenBoss.farthest_anchor(900.0, 700.0)
        self.assertEqual(twice, KrakenBoss.farthest_anchor(900.0, 700.0))

    def test_rect_matches_maw_radius(self):
        boss = make_boss(x=800.0, y=300.0)
        self.assertEqual(boss.rect.width, c.KRAKEN_MAW_RADIUS * 2)
        self.assertEqual(boss.rect.center, (800, 300))


class TestActivationGate(unittest.TestCase):
    def test_no_tracking_while_overlapping_ship(self):
        boss = make_boss()
        boss.begin_entry(800.0)
        # Park the ship exactly on the entry anchor target.
        anchor = boss._entry_anchor
        step(boss, 400, ship=anchor)
        self.assertNotEqual(boss.phase, "tracking")
        self.assertTrue(boss.alive)

    def test_tracking_begins_only_past_threshold(self):
        import math
        boss = make_boss()
        boss.begin_entry(800.0)
        seen_tracking = False
        for _ in range(400):
            boss.update(1.0 / 60, 800.0, 450.0)
            if boss.phase == "tracking":
                seen_tracking = True
                dist = math.hypot(boss.x - 800.0, boss.y - 450.0)
                self.assertGreaterEqual(dist, c.KRAKEN_ACTIVATION_SAFE_RADIUS)
                break
        self.assertTrue(seen_tracking)

    def test_entering_is_non_damaging(self):
        boss = make_boss()
        boss.begin_entry(800.0)
        shot = FakeShot()
        self.assertEqual(boss.hit_by_cannonball(shot), 0)
        self.assertEqual(shot.life, 1.5)
        self.assertEqual(boss.hp, boss.max_hp)
        self.assertNotIn(boss.phase, DAMAGING_PHASES)


class TestVulnerabilityMatrix(unittest.TestCase):
    def _phase_boss(self, phase):
        boss = make_boss()
        boss._set_phase(phase)
        return boss

    def test_tracking_telegraph_recovery_vulnerable(self):
        for phase in ("tracking", "telegraph", "recovery"):
            boss = self._phase_boss(phase)
            shot = FakeShot()
            self.assertEqual(boss.hit_by_cannonball(shot), 1, phase)
            self.assertEqual(shot.life, -1)
            self.assertEqual(boss.hp, boss.max_hp - 1)

    def test_lunge_rejects_damage_without_consuming(self):
        boss = self._phase_boss("lunge")
        shot = FakeShot()
        self.assertEqual(boss.hit_by_cannonball(shot), 0)
        self.assertEqual(shot.life, 1.5)
        self.assertEqual(boss.hp, boss.max_hp)

    def test_positioning_rejects_damage_without_consuming(self):
        boss = self._phase_boss("positioning")
        shot = FakeShot()
        self.assertEqual(boss.hit_by_cannonball(shot), 0)
        self.assertEqual(shot.life, 1.5)

    def test_defeat_at_zero_hp(self):
        boss = make_boss(hp=2)
        boss._set_phase("tracking")
        boss.hit_by_cannonball(FakeShot())
        self.assertTrue(boss.alive)
        boss.hit_by_cannonball(FakeShot())
        self.assertFalse(boss.alive)
        self.assertEqual(boss.phase, "defeated")

    def test_phase_sets(self):
        self.assertIn("tracking", VULNERABLE_PHASES)
        self.assertIn("telegraph", VULNERABLE_PHASES)
        self.assertIn("recovery", VULNERABLE_PHASES)
        self.assertNotIn("lunge", VULNERABLE_PHASES)
        self.assertNotIn("entering", VULNERABLE_PHASES)
        self.assertNotIn("positioning", VULNERABLE_PHASES)
        self.assertNotIn("entering", DAMAGING_PHASES)
        self.assertNotIn("positioning", DAMAGING_PHASES)


class TestPhaseCycle(unittest.TestCase):
    def test_full_cycle_returns_to_tracking(self):
        boss = make_boss()
        boss._set_phase("tracking")
        step(boss, int(c.KRAKEN_TRACK_DURATION * 60) + 5, ship=(800.0, 450.0))
        self.assertEqual(boss.phase, "telegraph")
        step(boss, int(c.KRAKEN_TELEGRAPH_DURATION * 60) + 5, ship=(800.0, 450.0))
        self.assertEqual(boss.phase, "lunge")
        step(boss, int(c.KRAKEN_LUNGE_DURATION * 60) + 5, ship=(800.0, 450.0))
        self.assertEqual(boss.phase, "recovery")
        step(boss, int(c.KRAKEN_RECOVERY_DURATION * 60) + 5, ship=(800.0, 450.0))
        self.assertEqual(boss.phase, "tracking")

    def test_telegraph_locks_direction(self):
        boss = make_boss(x=800.0, y=300.0)
        boss._set_phase("tracking")
        step(boss, int(c.KRAKEN_TRACK_DURATION * 60) + 5, ship=(200.0, 700.0))
        self.assertEqual(boss.phase, "telegraph")
        locked = (boss.lunge_dx, boss.lunge_dy)
        # Ship teleports away mid-telegraph: lunge keeps locked direction.
        step(boss, int(c.KRAKEN_TELEGRAPH_DURATION * 60) + 2, ship=(1400.0, 100.0))
        self.assertEqual(boss.phase, "lunge")
        self.assertEqual((boss.lunge_dx, boss.lunge_dy), locked)

    def test_hit_flash_decays(self):
        boss = make_boss()
        boss._set_phase("tracking")
        boss.hit_by_cannonball(FakeShot())
        self.assertGreater(boss.hit_flash, 0)
        step(boss, 30)
        self.assertEqual(boss.hit_flash, 0.0)


class TestRespawnContract(unittest.TestCase):
    def test_reposition_preserves_hp_and_goes_non_damaging(self):
        boss = make_boss()
        boss._set_phase("tracking")
        for _ in range(7):
            boss.hit_by_cannonball(FakeShot())
        self.assertEqual(boss.hp, boss.max_hp - 7)
        boss.reposition_after_life_loss()
        self.assertEqual(boss.phase, "positioning")
        self.assertEqual(boss.hp, boss.max_hp - 7)
        self.assertTrue(boss.alive)
        shot = FakeShot()
        self.assertEqual(boss.hit_by_cannonball(shot), 0)


class _MockAudio:
    def play(self, *a, **kw):
        pass
    muted = False


_KEYS_PARKED = {
    pg.K_a: False, pg.K_d: False, pg.K_w: False, pg.K_s: False,
    pg.K_LEFT: False, pg.K_RIGHT: False, pg.K_UP: False, pg.K_DOWN: False,
    pg.K_SPACE: False, pg.K_ESCAPE: False, pg.K_p: False, pg.K_f: False,
    pg.K_RETURN: False,
}


def make_gameplay():
    import sys as _sys
    import os as _os
    base = _os.path.join(_os.path.dirname(__file__),
                         "../../scripts/pygbag-port/krakens-wake")
    if base not in _sys.path:
        _sys.path.append(base)
    from games.asteroids.gameplay import Gameplay
    return Gameplay(_MockAudio())


class TestWaveIntegration(unittest.TestCase):
    def test_wave_clear_opens_transition_not_instant_spawn(self):
        gp = make_gameplay()
        gp.barrels = []
        gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertIsNotNone(gp.transition)
        self.assertEqual(gp.transition[0], "cleared")
        self.assertEqual(len(gp.barrels), 0)
        self.assertEqual(gp.wave, 0)

    def test_transition_expiry_spawns_boss_directly(self):
        # Collapsed flow: cleared expiry spawns the boss immediately into
        # non-damaging entering. No separate kraken transition remains.
        gp = make_gameplay()
        gp.barrels = []
        gp.update(1.0 / 60, _KEYS_PARKED)
        steps = int(c.WAVE_TRANSITION_DURATION * 60) + 10
        for _ in range(steps):
            gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertEqual(gp.wave, 1)
        self.assertIsNotNone(gp.boss)
        self.assertTrue(gp.boss.alive)
        self.assertEqual(gp.boss.phase, "entering")
        self.assertIsNone(gp.transition)
        self.assertEqual(len(gp.barrels), 0)

    def test_no_kraken_transition_kind(self):
        gp = make_gameplay()
        gp.barrels = []
        gp.update(1.0 / 60, _KEYS_PARKED)
        kinds = set()
        total = int(c.WAVE_TRANSITION_DURATION * 60) * 2 + 20
        for _ in range(total):
            gp.update(1.0 / 60, _KEYS_PARKED)
            if gp.transition is not None:
                kinds.add(gp.transition[0])
        self.assertNotIn("kraken", kinds)
        self.assertIsNotNone(gp.boss)

    def test_kraken_transition_spawns_boss_only(self):
        gp = make_gameplay()
        gp.barrels = []
        gp.update(1.0 / 60, _KEYS_PARKED)
        total = int(c.WAVE_TRANSITION_DURATION * 60) * 2 + 20
        for _ in range(total):
            gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertIsNotNone(gp.boss)
        self.assertTrue(gp.boss.alive)
        self.assertEqual(len(gp.barrels), 0)

    def test_exactly_one_roar_per_boss_arrival(self):
        import sys as _sys
        import os as _os

        class _RecordingAudio:
            def __init__(self):
                self.calls = []
                self.muted = False

            def play(self, name):
                self.calls.append(name)

        base = _os.path.join(_os.path.dirname(__file__),
                             "../../scripts/pygbag-port/krakens-wake")
        if base not in _sys.path:
            _sys.path.append(base)
        from games.asteroids.gameplay import Gameplay
        gp = Gameplay(_RecordingAudio())
        gp.barrels = []
        gp.update(1.0 / 60, _KEYS_PARKED)
        # Drive through cleared banner, spawn, and full entering.
        total = int((c.WAVE_TRANSITION_DURATION +
                     c.KRAKEN_ENTER_DURATION) * 60) + 30
        for _ in range(total):
            gp.update(1.0 / 60, _KEYS_PARKED)
        roars = [n for n in gp.audio.calls if n == "kraken_roar"]
        self.assertEqual(len(roars), 1)
        self.assertIn("level_win", gp.audio.calls)
        self.assertLess(gp.audio.calls.index("level_win"),
                        gp.audio.calls.index("kraken_roar"))

    def test_boss_defeat_advances_single_path(self):
        gp = make_gameplay()
        gp.barrels = []
        gp.update(1.0 / 60, _KEYS_PARKED)
        total = int(c.WAVE_TRANSITION_DURATION * 60) * 2 + 20
        for _ in range(total):
            gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertIsNotNone(gp.boss)
        wave_before = gp.wave
        score_before = gp.score
        gp.boss.hp = 1
        gp.boss._set_phase("recovery")
        from games.asteroids.cannonball import Cannonball
        # Drive one cannonball into the maw through the real loop path.
        cb = Cannonball(gp.boss.x, gp.boss.y, 0)
        cb.vx, cb.vy = 0.0, 0.0
        gp.cannonballs.append(cb)
        gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertIsNone(gp.boss)
        self.assertGreater(gp.score, score_before)
        self.assertEqual(len(gp.treasures), 1)
        # Single funnel: exactly one transition pending, wave advances once.
        self.assertIsNotNone(gp.transition)
        for _ in range(int(c.WAVE_TRANSITION_DURATION * 60) + 10):
            gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertEqual(gp.wave, wave_before + 1)
        self.assertGreater(len(gp.barrels), 0)
        self.assertIsNone(gp.boss)

    def test_spawn_exclusion_and_fallback(self):
        gp = make_gameplay()
        gp.ship.x, gp.ship.y = 800.0, 450.0
        for _ in range(30):
            gp._spawn_barrels()
            for b in gp.barrels:
                import math
                self.assertGreaterEqual(
                    math.hypot(b.x - 800.0, b.y - 450.0),
                    c.BARREL_SAFE_RADIUS)

    def test_debug_wave_absent_without_key(self):
        from games.asteroids import gameplay as gmod
        from shared import pa_store
        pa_store.clear_memory()
        self.assertIsNone(gmod._debug_kraken_wave())
        pa_store.clear_memory()

    def test_debug_wave_rejects_bad_values(self):
        from games.asteroids import gameplay as gmod
        from shared import pa_store
        for bad in ("abc", "-3", "0", "31"):
            pa_store.clear_memory()
            pa_store._MEM["pa-kraken-test-wave"] = bad
            self.assertIsNone(gmod._debug_kraken_wave())

    def test_debug_wave_lands_on_requested_wave(self):
        from games.asteroids import gameplay as gmod
        from shared import pa_store
        pa_store.clear_memory()
        pa_store._MEM["pa-kraken-test-wave"] = "2"
        self.assertEqual(gmod._debug_kraken_wave(), 1)
        # One-shot: the direct read consumed the seed; re-seed for construct.
        pa_store._MEM["pa-kraken-test-wave"] = "2"
        gp = make_gameplay()
        self.assertTrue(gp._test_mode)
        # Production advance path lands exactly on internal wave 1.
        for _ in range(30):
            gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertEqual(gp.wave, 1)
        pa_store.clear_memory()

    def test_debug_seed_one_shot_consumed(self):
        from shared import pa_store
        pa_store.clear_memory()
        pa_store._MEM["pa-kraken-test-wave"] = "2"
        gp = make_gameplay()
        self.assertTrue(gp._test_mode)
        # The browser key is gone after construction consumes it.
        self.assertNotIn("pa-kraken-test-wave", pa_store._MEM)
        pa_store.clear_memory()

    def test_debug_wave_reused_across_reset(self):
        from shared import pa_store
        pa_store.clear_memory()
        pa_store._MEM["pa-kraken-test-wave"] = "2"
        gp = make_gameplay()
        self.assertTrue(gp._test_mode)
        gp.reset()
        self.assertTrue(gp._test_mode)
        # Reset re-parks through the in-memory value, no reread needed.
        for _ in range(30):
            gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertEqual(gp.wave, 1)
        pa_store.clear_memory()

    def test_fresh_construct_without_seed_is_ordinary(self):
        from shared import pa_store
        pa_store.clear_memory()
        gp = make_gameplay()
        self.assertFalse(gp._test_mode)
        self.assertEqual(gp.wave, 0)
        self.assertGreater(len(gp.barrels), 0)
        self.assertIsNone(gp.boss)
        self.assertIsNone(gp.transition)
        pa_store.clear_memory()

    def test_malformed_seed_consumed_not_poisonous(self):
        from shared import pa_store
        pa_store.clear_memory()
        pa_store._MEM["pa-kraken-test-wave"] = "[[broken"
        gp = make_gameplay()
        self.assertFalse(gp._test_mode)
        self.assertNotIn("pa-kraken-test-wave", pa_store._MEM)
        self.assertEqual(gp.wave, 0)
        self.assertGreater(len(gp.barrels), 0)
        pa_store.clear_memory()

    def test_reset_clears_boss_and_transition(self):
        gp = make_gameplay()
        gp.barrels = []
        gp.update(1.0 / 60, _KEYS_PARKED)
        total = int(c.WAVE_TRANSITION_DURATION * 60) * 2 + 20
        for _ in range(total):
            gp.update(1.0 / 60, _KEYS_PARKED)
        self.assertIsNotNone(gp.boss)
        gp.reset()
        self.assertIsNone(gp.boss)
        self.assertIsNone(gp.transition)
        self.assertEqual(gp.wave, 0)
        self.assertGreater(len(gp.barrels), 0)


if __name__ == "__main__":
    unittest.main()
