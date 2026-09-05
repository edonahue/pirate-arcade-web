import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port"))

from shared import pa_store


class TestPaStoreContract(unittest.TestCase):
    def setUp(self):
        pa_store.clear_memory()

    def test_no_stored_value_returns_default(self):
        self.assertIsNone(pa_store.get_best("pa-test-missing"))
        self.assertEqual(pa_store.get_best("pa-test-missing", default=0), 0)

    def test_valid_stored_value_round_trips(self):
        self.assertTrue(pa_store.submit_best("pa-test-score", 1250))
        self.assertEqual(pa_store.get_best("pa-test-score"), 1250)

    def test_malformed_stored_value_treated_as_absent(self):
        pa_store._MEM["pa-test-bad"] = "not-a-number"
        self.assertIsNone(pa_store.get_best("pa-test-bad"))
        pa_store._MEM["pa-test-bad2"] = "-5"
        self.assertIsNone(pa_store.get_best("pa-test-bad2"))

    def test_lower_score_does_not_replace_best(self):
        pa_store.submit_best("pa-test-score", 100)
        self.assertFalse(pa_store.submit_best("pa-test-score", 50))
        self.assertEqual(pa_store.get_best("pa-test-score"), 100)

    def test_equal_score_does_not_replace_best(self):
        pa_store.submit_best("pa-test-score", 100)
        self.assertFalse(pa_store.submit_best("pa-test-score", 100))
        self.assertEqual(pa_store.get_best("pa-test-score"), 100)

    def test_higher_score_replaces_best(self):
        pa_store.submit_best("pa-test-score", 100)
        self.assertTrue(pa_store.submit_best("pa-test-score", 250))
        self.assertEqual(pa_store.get_best("pa-test-score"), 250)

    def test_rejects_non_numeric_and_bool(self):
        self.assertFalse(pa_store.submit_best("pa-test-score", True))
        self.assertFalse(pa_store.submit_best("pa-test-score", "abc"))
        self.assertFalse(pa_store.submit_best("pa-test-score", None))
        self.assertIsNone(pa_store.get_best("pa-test-score"))

    def test_rejects_empty_key(self):
        self.assertFalse(pa_store.submit_best("", 10))
        self.assertIsNone(pa_store.get_best(""))


def _load_game_highscores(mod_name, game_dir):
    """Load a per-game highscores.py in isolation (all share a module name)."""
    import importlib.util
    base = os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port")
    game_path = os.path.join(base, game_dir)
    if game_path not in sys.path:
        sys.path.append(game_path)
    spec = importlib.util.spec_from_file_location(
        mod_name, os.path.join(game_path, "highscores.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


class TestGameHighscores(unittest.TestCase):
    def setUp(self):
        pa_store.clear_memory()

    def test_cannonball_rally_record(self):
        hs = _load_game_highscores("cc_highscores", "cannonball-clash")
        self.assertIsNone(hs.get_high("pong"))
        self.assertTrue(hs.submit_rally(12))
        self.assertEqual(hs.get_high("pong")["score"], 12)
        self.assertFalse(hs.submit_rally(7))
        self.assertTrue(hs.submit_rally(18))
        self.assertEqual(hs.get_high("pong")["score"], 18)
        self.assertEqual(hs.get_all()["pong"]["score"], 18)

    def test_treasure_best_score(self):
        hs = _load_game_highscores("tc_highscores", "treasure-cove")
        self.assertIsNone(hs.get_high("breakout"))
        self.assertTrue(hs.submit_breakout(450))
        self.assertEqual(hs.get_high("breakout")["score"], 450)
        self.assertFalse(hs.submit_breakout(100))
        self.assertEqual(hs.get_high("breakout")["score"], 450)

    def test_kraken_best_score_desktop_backend(self):
        import tempfile
        from unittest import mock
        # Isolate HOME so the desktop file backend never touches the real one.
        with tempfile.TemporaryDirectory() as home:
            with mock.patch.dict(os.environ, {"HOME": home}):
                hs = _load_game_highscores("kw_highscores_iso", "krakens-wake")
                self.assertFalse(hs.submit_asteroids(0))
                self.assertTrue(hs.submit_asteroids(900))
                self.assertEqual(hs.get_high("asteroids")["score"], 900)
                self.assertFalse(hs.submit_asteroids(100))
                self.assertEqual(hs.get_high("asteroids")["score"], 900)

    def test_kraken_browser_backend_round_trips(self):
        import types
        # Fake the Emscripten browser bridge with a dict-backed localStorage.
        backing = {}

        class FakeStorage:
            def getItem(self, key):
                return backing.get(key)

            def setItem(self, key, value):
                backing[key] = value

            def removeItem(self, key):
                backing.pop(key, None)

        fake_window = types.SimpleNamespace(localStorage=FakeStorage())
        fake_platform = types.SimpleNamespace(window=fake_window)
        emscripten = types.ModuleType("__EMSCRIPTEN__")
        emscripten.window = fake_window
        sys.modules["__EMSCRIPTEN__"] = fake_platform
        try:
            hs = _load_game_highscores("kw_highscores_web", "krakens-wake")
            self.assertIsNone(hs.get_high("asteroids"))
            self.assertTrue(hs.submit_asteroids(1200))
            self.assertEqual(
                hs.get_high("asteroids")["score"], 1200)
            # A fresh module read hits localStorage, not the file backend.
            hs2 = _load_game_highscores("kw_highscores_web2", "krakens-wake")
            self.assertEqual(hs2.get_high("asteroids")["score"], 1200)
            # Malformed stored JSON is treated as absent.
            backing["pa-kraken-scores"] = "[[broken"
            hs3 = _load_game_highscores("kw_highscores_web3", "krakens-wake")
            self.assertIsNone(hs3.get_high("asteroids"))
        finally:
            sys.modules.pop("__EMSCRIPTEN__", None)


if __name__ == "__main__":
    unittest.main()
