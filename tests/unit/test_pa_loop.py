import unittest
import sys
import os
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts/pygbag-port"))

import builtins

from shared.pa_loop import (
    should_draw, page_hidden,
    FixedStepTimer, PresentGate, LoopMetrics,
    STEP_S, MAX_FRAME_S, MAX_STEPS,
)


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


class TestLoopMetrics(unittest.TestCase):
    def test_snapshot_returns_copy(self):
        m = LoopMetrics()
        s1 = m.snapshot()
        m.record_outer()
        s2 = m.snapshot()
        self.assertEqual(s1["outerLoops"], 0)
        self.assertEqual(s2["outerLoops"], 1)

    def test_all_counters_present(self):
        m = LoopMetrics()
        s = m.snapshot()
        expected_keys = [
            "outerLoops", "simSteps", "renderedFrames",
            "presentCalls", "staticDrawSkips", "staticPresentSkips",
            "hiddenIterations", "cappedSteps", "droppedTime",
            "clampedFrames",
        ]
        for k in expected_keys:
            self.assertIn(k, s)

    def test_reset_clears(self):
        m = LoopMetrics()
        m.record_outer()
        m.record_step()
        m.reset()
        s = m.snapshot()
        self.assertEqual(s["outerLoops"], 0)
        self.assertEqual(s["simSteps"], 0)

    def test_float_counters(self):
        m = LoopMetrics()
        m.record_dropped(0.5)
        m.record_dropped(0.3)
        s = m.snapshot()
        self.assertAlmostEqual(s["droppedTime"], 0.8)


class TestFixedStepTimer(unittest.TestCase):
    def test_default_params(self):
        t = FixedStepTimer()
        self.assertAlmostEqual(t._step_s, STEP_S)
        self.assertAlmostEqual(t._max_frame_s, MAX_FRAME_S)
        self.assertEqual(t._max_steps, MAX_STEPS)

    def test_begin_frame_returns_result(self):
        t = FixedStepTimer(step_s=0.1, max_frame_s=1.0, max_steps=10)
        r = t.begin_frame(active=True)
        self.assertEqual(r.steps, 0)
        self.assertAlmostEqual(r.step_seconds, 0.1)

    def test_inactive_resets_accumulator(self):
        t = FixedStepTimer(step_s=0.1, max_frame_s=1.0, max_steps=10)
        t._accum = 0.5
        r = t.begin_frame(active=False)
        self.assertEqual(r.steps, 0)
        self.assertEqual(t._accum, 0.0)

    def test_hidden_returns_zero_steps(self):
        t = FixedStepTimer(step_s=0.1, max_frame_s=1.0, max_steps=10)
        r = t.begin_frame(hidden=True)
        self.assertEqual(r.steps, 0)
        m = t.metrics().snapshot()
        self.assertEqual(m["hiddenIterations"], 1)

    def test_pause_resume_prevents_catchup(self):
        t = FixedStepTimer(step_s=0.1, max_frame_s=5.0, max_steps=100)
        t.pause()
        t.begin_frame(active=True)
        t.resume()
        r = t.begin_frame(active=True)
        self.assertLessEqual(r.steps, 2)

    def test_inactive_prevents_catchup(self):
        t = FixedStepTimer(step_s=0.1, max_frame_s=5.0, max_steps=100)
        t.begin_frame(active=False)
        t.begin_frame(active=False)
        r = t.begin_frame(active=True)
        self.assertLessEqual(r.steps, 2)

    def test_clamp_max_frame_time(self):
        clock = iter([0.0, 10.0, 10.1])
        t = FixedStepTimer(
            step_s=0.1, max_frame_s=0.2, max_steps=10,
            clock=lambda: next(clock),
        )
        r = t.begin_frame(active=True)
        self.assertLessEqual(r.steps, 10)
        m = t.metrics().snapshot()
        self.assertEqual(m["clampedFrames"], 1)
        self.assertGreater(m["droppedTime"], 0)

    def test_cap_max_steps_per_frame(self):
        clock = iter([0.0, 2.0, 2.0 + 0.1 * 3])
        t = FixedStepTimer(
            step_s=0.1, max_frame_s=5.0, max_steps=3,
            clock=lambda: next(clock),
        )
        r = t.begin_frame(active=True)
        self.assertEqual(r.steps, 3)
        m = t.metrics().snapshot()
        self.assertEqual(m["cappedSteps"], 17)

    def test_metrics_accessible(self):
        t = FixedStepTimer()
        m = t.metrics()
        self.assertIsInstance(m, LoopMetrics)


class TestPresentGate(unittest.TestCase):
    def test_first_draw_triggers(self):
        g = PresentGate()
        self.assertTrue(g.check_draw(("menu", 0)))

    def test_same_key_skips_draw(self):
        g = PresentGate()
        g.check_draw(("menu", 0))
        self.assertFalse(g.check_draw(("menu", 0)))

    def test_changed_key_triggers_draw(self):
        g = PresentGate()
        g.check_draw(("menu", 0))
        self.assertTrue(g.check_draw(("playing", 0)))

    def test_force_triggers_draw(self):
        g = PresentGate()
        self.assertTrue(g.check_draw(("menu", 0), force=True))
        self.assertTrue(g.check_draw(("menu", 0), force=True))

    def test_present_not_drawn_skips(self):
        g = PresentGate()
        g.check_draw(("menu", 0))
        g.check_draw(("menu", 0))
        self.assertFalse(g.check_present(("menu", 0)))
        self.assertFalse(g.check_present(("menu", 0)))

    def test_present_after_draw_triggers(self):
        g = PresentGate()
        g.check_draw(("menu", 0))
        self.assertTrue(g.check_present(("menu", 0)))

    def test_present_force_triggers(self):
        g = PresentGate()
        self.assertTrue(g.check_present(("menu", 0), force=True))

    def test_drew_this_frame(self):
        g = PresentGate()
        self.assertFalse(g.drew_this_frame())
        g.check_draw(("menu", 0))
        self.assertTrue(g.drew_this_frame())
        g.check_draw(("menu", 0))
        self.assertFalse(g.drew_this_frame())

    def test_present_after_force_draw(self):
        g = PresentGate()
        g.check_draw(("menu", 0), force=True)
        self.assertTrue(g.check_present(("menu", 0)))


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

    def test_fallback_to_true_on_missing(self):
        builtins.__dict__.pop("__pa_page_visible__", None)
        self.assertFalse(page_hidden())


class TestFixedStepTimerInvariants(unittest.TestCase):
    def test_exactly_n_steps_over_n_seconds(self):
        clock = iter([i * 0.1 for i in range(-1, 200)])
        t = FixedStepTimer(step_s=0.1, max_frame_s=1.0, max_steps=20,
                           clock=lambda: next(clock))
        total_steps = 0
        for _ in range(100):
            frame = t.begin_frame(active=True)
            total_steps += frame.steps
        self.assertEqual(total_steps, 100)

    def test_no_steps_when_no_time_passes(self):
        clock = iter([0.0 for _ in range(100)])
        t = FixedStepTimer(step_s=0.1, max_frame_s=1.0, max_steps=10,
                           clock=lambda: next(clock))
        frame = t.begin_frame(active=True)
        self.assertEqual(frame.steps, 0)

    def test_no_negative_steps(self):
        for _ in range(100):
            clock = iter([random.random() * 0.5 for _ in range(-1, 50)])
            t = FixedStepTimer(step_s=1/60, max_frame_s=0.1, max_steps=5,
                               clock=lambda: next(clock))
            frame = t.begin_frame(active=True)
            self.assertGreaterEqual(frame.steps, 0)
            self.assertLessEqual(frame.steps, 5)

    def test_metrics_summary_is_valid_after_mixed_load(self):
        clock = iter([i * (1/60) for i in range(-1, 5000)])
        t = FixedStepTimer(clock=lambda: next(clock))
        for _ in range(2000):
            active = random.random() < 0.7
            hidden = random.random() < 0.05 if not active else False
            frame = t.begin_frame(active=active, hidden=hidden)
            for _ in range(frame.steps):
                t.metrics().record_step()
        m = t.metrics().snapshot()
        self.assertGreaterEqual(m["simSteps"], 0)
        self.assertGreaterEqual(m["outerLoops"], 1000)
        self.assertLessEqual(m["outerLoops"], 2000)
        self.assertGreaterEqual(m["hiddenIterations"], 0)
        self.assertLessEqual(m["hiddenIterations"], 2000)

    def test_present_gate_plus_timer_no_false_flips(self):
        clock = iter([i * (1/60) for i in range(-1, 500)])
        t = FixedStepTimer(clock=lambda: next(clock))
        g = PresentGate()
        for frame_i in range(200):
            t.begin_frame(active=True)
            key = ("playing", frame_i // 30)
            g.check_draw(key)
            if frame_i % 30 == 0:
                self.assertTrue(g.check_present(key))
            else:
                g.check_present(key)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if result.result.wasSuccessful() else 1)
