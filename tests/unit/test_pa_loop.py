import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port"))

import builtins

from shared.pa_loop import should_draw, page_hidden


class TestShouldDraw(unittest.TestCase):
    def test_first_call_always_draws(self):
        draw, key = should_draw(("menu", 0), None)
        self.assertTrue(draw)
        self.assertEqual(key, ("menu", 0))

    def test_same_key_skips_draw(self):
        draw, key = should_draw(("menu", 0), ("menu", 0))
        self.assertFalse(draw)
        self.assertEqual(key, ("menu", 0))

    def test_different_key_triggers_draw(self):
        draw, key = should_draw(("playing", 0), ("menu", 0))
        self.assertTrue(draw)
        self.assertEqual(key, ("playing", 0))

    def test_draw_updates_key(self):
        draw, key = should_draw(("playing", 1), ("playing", 0))
        self.assertTrue(draw)
        self.assertEqual(key, ("playing", 1))

    def test_none_last_key(self):
        draw, key = should_draw(("playing", 0), None)
        self.assertTrue(draw)
        self.assertEqual(key, ("playing", 0))

    def test_any_hashable_tuple_key(self):
        draw, key = should_draw(("playing", True, "extra"), ("paused", False, "other"))
        self.assertTrue(draw)
        self.assertEqual(key, ("playing", True, "extra"))


class TestPageHidden(unittest.TestCase):
    def setUp(self):
        self._saved = builtins.__dict__.get("__pa_page_visible__")
        builtins.__dict__.pop("__pa_page_visible__", None)

    def tearDown(self):
        builtins.__dict__.pop("__pa_page_visible__", None)
        if self._saved is not None:
            builtins.__dict__["__pa_page_visible__"] = self._saved

    def test_default_not_hidden(self):
        self.assertFalse(page_hidden())

    def test_explicitly_visible(self):
        builtins.__dict__["__pa_page_visible__"] = True
        self.assertFalse(page_hidden())

    def test_hidden_when_flag_false(self):
        builtins.__dict__["__pa_page_visible__"] = False
        self.assertTrue(page_hidden())

    def test_explicit_false_is_hidden(self):
        builtins.__dict__["__pa_page_visible__"] = False
        self.assertTrue(page_hidden())

    def test_fallback_to_true_on_missing(self):
        builtins.__dict__.pop("__pa_page_visible__", None)
        self.assertFalse(page_hidden())


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
