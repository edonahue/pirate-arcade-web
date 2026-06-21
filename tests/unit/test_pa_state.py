import json
import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port"))

import builtins

_B = builtins.__dict__

from shared.pa_state import StatePublisher, STATE_PUBLISH_INTERVAL, STATE_HEARTBEAT_HZ

STATE_KEY = "__pa_game_state_json"


class TestStatePublisherHeartbeat(unittest.TestCase):
    def setUp(self):
        _B[STATE_KEY] = None
        self.pub = StatePublisher()

    def assert_published_value(self, key, expected):
        raw = _B.get(STATE_KEY)
        self.assertIsNotNone(raw, "expected state to be published")
        parsed = json.loads(raw)
        self.assertEqual(parsed.get(key), expected)

    def test_does_not_publish_before_interval(self):
        self.pub._last_phase = "playing"
        self.pub.tick(0.05, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNone(_B.get(STATE_KEY))

    def test_publishes_after_full_interval(self):
        self.pub._last_phase = "playing"
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_accumulates_across_partial_ticks(self):
        self.pub._last_phase = "playing"
        self.pub.tick(0.06, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNone(_B.get(STATE_KEY))
        self.pub.tick(0.07, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_phase_transition_publishes_immediately(self):
        self.pub.tick(0.01, {"gameId": "test", "phase": "menu", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_phase_transition_from_playing_to_paused(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "score": 0})
        _B[STATE_KEY] = None
        self.pub.tick(0.01, {"gameId": "test", "phase": "paused", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_same_phase_no_publish_before_interval(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "menu", "score": 0})
        _B[STATE_KEY] = None
        self.pub.tick(0.05, {"gameId": "test", "phase": "menu", "score": 0})
        self.assertIsNone(_B.get(STATE_KEY))

    def test_dedup_same_state_not_published_twice(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "score": 0})
        first = _B.get(STATE_KEY)
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIs(_B.get(STATE_KEY), first)

    def test_dedup_different_state_publishes(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "score": 0})
        _B[STATE_KEY] = None
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "score": 1})
        self.assertIsNotNone(_B.get(STATE_KEY))
        self.assert_published_value("score", 1)

    def test_force_publishes_immediately(self):
        self.pub.force_publish({"gameId": "test", "phase": "menu", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_force_publish_updates_phase_tracking(self):
        self.pub.force_publish({"gameId": "test", "phase": "menu", "score": 0})
        _B[STATE_KEY] = None
        self.pub.tick(0.05, {"gameId": "test", "phase": "menu", "score": 0})
        self.assertIsNone(_B.get(STATE_KEY))

    def test_accumulator_resets_after_publish(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "score": 0})
        _B[STATE_KEY] = None
        self.pub.tick(0.05, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNone(_B.get(STATE_KEY))

    def test_no_crash_with_none_phase(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_publishes_null_value(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "value": None})
        self.assertIsNotNone(_B.get(STATE_KEY))
        self.assert_published_value("value", None)

    def test_custom_heartbeat_rate(self):
        pub2 = StatePublisher(heartbeat_hz=2)
        pub2._last_phase = "playing"
        pub2.tick(0.4, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNone(_B.get(STATE_KEY))
        pub2.tick(0.1, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_correct_json_structure(self):
        state = {"gameId": "test", "phase": "playing", "score": 42, "active": True}
        self.pub.tick(STATE_PUBLISH_INTERVAL, state)
        self.assert_published_value("gameId", "test")
        self.assert_published_value("phase", "playing")
        self.assert_published_value("score", 42)
        self.assert_published_value("active", True)

    def test_default_heartbeat_hz(self):
        self.assertEqual(STATE_HEARTBEAT_HZ, 8)
        self.assertAlmostEqual(STATE_PUBLISH_INTERVAL, 0.125)

    def test_variable_phases_always_publish_on_change(self):
        self.pub.tick(0.125, {"gameId": "test", "phase": "menu", "score": 0})
        _B[STATE_KEY] = None
        self.pub.tick(0.01, {"gameId": "test", "phase": "playing", "score": 0})
        self.assertIsNotNone(_B.get(STATE_KEY))

    def test_emscripten_exception_does_not_prevent_builtins_assign(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing"})
        raw = _B.get(STATE_KEY)
        self.assertIsNotNone(raw)
        parsed = json.loads(raw)
        self.assertEqual(parsed["gameId"], "test")

    def test_tick_does_not_publish_when_same_json_and_not_enough_time(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "v": 1})
        _B[STATE_KEY] = None
        self.pub.tick(0.01, {"gameId": "test", "phase": "playing", "v": 2})
        self.assertIsNone(_B.get(STATE_KEY))

    def test_publishes_after_second_identical_interval(self):
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "v": 1})
        _B[STATE_KEY] = None
        self.pub.tick(STATE_PUBLISH_INTERVAL, {"gameId": "test", "phase": "playing", "v": 2})
        self.assertIsNotNone(_B.get(STATE_KEY))
        self.assert_published_value("v", 2)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
