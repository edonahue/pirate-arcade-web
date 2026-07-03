"""Self-tests for the Python game test runner (run-python-game-tests.py)."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


class TestParseTestCounts(unittest.TestCase):
    """Tests for parse_test_counts helper."""

    def _import_runner(self):
        """Import the runner module from the scripts directory."""
        scripts_dir = Path(__file__).resolve().parent.parent.parent / "scripts"
        if str(scripts_dir) not in sys.path:
            sys.path.insert(0, str(scripts_dir))
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "runner", scripts_dir / "run-python-game-tests.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def setUp(self):
        self.runner = self._import_runner()

    def test_parse_all_pass(self):
        output = "Ran 5 tests in 0.1s\n\nOK\n"
        counts = self.runner.parse_test_counts(output)
        self.assertEqual(counts["tests_run"], 5)
        self.assertEqual(counts["failures"], 0)
        self.assertEqual(counts["errors"], 0)

    def test_parse_with_failures(self):
        output = "Ran 5 tests in 0.1s\n\nFAILED (failures=2, errors=1)\n"
        counts = self.runner.parse_test_counts(output)
        self.assertEqual(counts["tests_run"], 5)
        self.assertEqual(counts["failures"], 2)
        self.assertEqual(counts["errors"], 1)

    def test_parse_with_skips(self):
        output = "Ran 10 tests in 0.2s\n\nOK (skipped=3)\n"
        counts = self.runner.parse_test_counts(output)
        self.assertEqual(counts["tests_run"], 10)
        self.assertEqual(counts["skips"], 3)

    def test_parse_no_tests(self):
        output = "Ran 0 tests in 0.0s\n\nOK\n"
        counts = self.runner.parse_test_counts(output)
        self.assertEqual(counts["tests_run"], 0)
        self.assertEqual(counts["failures"], 0)

    def test_parse_empty_output(self):
        counts = self.runner.parse_test_counts("")
        self.assertEqual(counts["tests_run"], 0)
        self.assertEqual(counts["failures"], 0)

    def test_parse_errors_only(self):
        output = "Ran 3 tests in 0.1s\n\nFAILED (errors=3)\n"
        counts = self.runner.parse_test_counts(output)
        self.assertEqual(counts["tests_run"], 3)
        self.assertEqual(counts["errors"], 3)


class TestAliasResolution(unittest.TestCase):
    """Tests for game ID alias resolution."""

    def _import_runner(self):
        scripts_dir = Path(__file__).resolve().parent.parent.parent / "scripts"
        if str(scripts_dir) not in sys.path:
            sys.path.insert(0, str(scripts_dir))
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "runner", scripts_dir / "run-python-game-tests.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def setUp(self):
        self.runner = self._import_runner()

    def test_canonical_ids(self):
        for canonical in ["cannonball-clash", "treasure-cove", "krakens-wake"]:
            self.assertEqual(self.runner.ALIASES.get(canonical), canonical)

    def test_alias_pong(self):
        self.assertEqual(self.runner.ALIASES.get("pong"), "cannonball-clash")

    def test_alias_breakout(self):
        self.assertEqual(self.runner.ALIASES.get("breakout"), "treasure-cove")

    def test_alias_asteroids(self):
        self.assertEqual(self.runner.ALIASES.get("asteroids"), "krakens-wake")

    def test_unknown_alias(self):
        self.assertIsNone(self.runner.ALIASES.get("unknown"))


if __name__ == "__main__":
    unittest.main()
