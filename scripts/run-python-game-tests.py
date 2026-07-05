#!/usr/bin/env python3
"""
Pirate Arcade — Python Game Test Runner

Invokes each Pygbag game's Python test suite + shared infrastructure tests
in isolated subprocesses so sys.modules contamination cannot happen.

Usage:
    python3 scripts/run-python-game-tests.py                  # all
    python3 scripts/run-python-game-tests.py --game=cannonball-clash
    python3 scripts/run-python-game-tests.py --game=treasure-cove
    python3 scripts/run-python-game-tests.py --game=krakens-wake
    python3 scripts/run-python-game-tests.py --game=breakout   # alias
    python3 scripts/run-python-game-tests.py --game=asteroids  # alias
    python3 scripts/run-python-game-tests.py --game=pong       # alias

Returns non-zero if any suite fails, a test file is missing, zero tests
are discovered, compilation fails, or an unknown game ID is given.
"""

import argparse
import compileall
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_BASE = REPO_ROOT / "scripts" / "pygbag-port"
TEST_DIR = REPO_ROOT / "tests" / "unit"
LOG_DIR = REPO_ROOT / "test-results" / "python-games"

ALIASES = {
    "cannonball-clash": "cannonball-clash",
    "treasure-cove": "treasure-cove",
    "krakens-wake": "krakens-wake",
    "pong": "cannonball-clash",
    "breakout": "treasure-cove",
    "asteroids": "krakens-wake",
}

GAME_CONFIGS = [
    {
        "id": "cannonball-clash",
        "label": "Cannonball Clash",
        "game_dir": SCRIPTS_BASE / "cannonball-clash",
        "test_file": "test_cannonball_clash.py",
        "runtime_contract": True,
    },
    {
        "id": "treasure-cove",
        "label": "Treasure Cove",
        "game_dir": SCRIPTS_BASE / "treasure-cove",
        "test_file": "test_treasure_cove.py",
        "runtime_contract": True,
    },
    {
        "id": "krakens-wake",
        "label": "Kraken's Wake",
        "game_dir": SCRIPTS_BASE / "krakens-wake",
        "test_file": "test_krakens_wake.py",
        "runtime_contract": True,
    },
]

SHARED_TEST_FILES = [
    "test_pa_state.py",
    "test_pa_loop.py",
    "test_game_source_contract.py",
    "test_runner_self.py",
]

BASE_ENV = {
    "PYGAME_HIDE_SUPPORT_PROMPT": "1",
    "PYTHONHASHSEED": "0",
    "SDL_VIDEODRIVER": "dummy",
    "SDL_AUDIODRIVER": "dummy",
}

SHARED_PYTHONPATH = os.pathsep.join([
    str(SCRIPTS_BASE),
    str(REPO_ROOT / "scripts"),
])

SUBPROCESS_TIMEOUT = 60


def compile_python_tree(root: Path, label: str) -> list[str]:
    """Recursively compileall a tree. Returns list of error messages."""
    errors: list[str] = []
    if not root.is_dir():
        errors.append(f"  SKIP  {label}: directory not found: {root}")
        return errors

    skip = {"build", "__pycache__", ".git", "node_modules"}

    class _Reporter:
        def __call__(self, *a, **kw):
            pass

    ok = compileall.compile_dir(
        str(root),
        quiet=1,
        rx=re.compile("|".join(skip)),
        workers=0,
        ddir=str(root),
    )
    if not ok:
        errors.append(f"  FAIL  {label}: compile error in {root.name}")

    return errors


def run_unittest(
    test_file: str,
    extra_pythonpath: str,
    suite_label: str,
    env_override: dict | None = None,
) -> tuple[int, str, float]:
    """Run a single unittest file in a subprocess. Returns (exitcode, output, duration)."""
    env = os.environ.copy()
    env.update(BASE_ENV)
    env["PYTHONPATH"] = extra_pythonpath
    if env_override:
        env.update(env_override)

    start = time.monotonic()
    try:
        result = subprocess.run(
            [sys.executable, "-u", "-m", "unittest", "discover", "-s", str(TEST_DIR),
             "-p", test_file, "-v"],
            cwd=str(TEST_DIR),
            env=env,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )
        duration = time.monotonic() - start
        output = result.stdout + result.stderr
        return result.returncode, output, duration
    except subprocess.TimeoutExpired:
        duration = time.monotonic() - start
        return -1, f"TIMEOUT after {SUBPROCESS_TIMEOUT}s", duration


def parse_test_counts(output: str) -> dict:
    """Parse unittest output for test counts."""
    result = {
        "tests_run": 0,
        "failures": 0,
        "errors": 0,
        "skips": 0,
    }
    for line in output.splitlines():
        if line.startswith("Ran "):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    result["tests_run"] = int(parts[1])
                except ValueError:
                    pass
        if "FAILED (" in line or "FAILED" == line:
            if "failures=" in line:
                try:
                    val = line.split("failures=")[1].split(",")[0].split(")")[0].strip()
                    result["failures"] = int(val)
                except (IndexError, ValueError):
                    result["failures"] = 1
            if "errors=" in line:
                try:
                    val = line.split("errors=")[1].split(",")[0].split(")")[0].strip()
                    result["errors"] = int(val)
                except (IndexError, ValueError):
                    result["errors"] = 1
        if "skipped=" in line:
            try:
                val = line.split("skipped=")[1].split(",")[0].split(")")[0].strip()
                result["skips"] = int(val)
            except (IndexError, ValueError):
                pass
    return result


def run_suite(
    test_file: str,
    pythonpath: str,
    suite_label: str,
    log_path: Path,
    env_override: dict | None = None,
) -> dict:
    """Run a test suite and return structured results."""
    log_path.parent.mkdir(parents=True, exist_ok=True)

    exitcode, output, duration = run_unittest(test_file, pythonpath, suite_label, env_override)

    with open(log_path, "w") as f:
        f.write(output)

    counts = parse_test_counts(output)

    if exitcode != 0:
        process_result = "failed"
    elif counts["tests_run"] == 0:
        process_result = "failed"
    elif counts["failures"] > 0 or counts["errors"] > 0:
        process_result = "failed"
    else:
        process_result = "passed"

    return {
        "suite": suite_label,
        "test_file": test_file,
        "process_result": process_result,
        "tests_run": counts["tests_run"],
        "failures": counts["failures"],
        "errors": counts["errors"],
        "skips": counts["skips"],
        "exit_code": exitcode,
        "duration_seconds": round(duration, 3),
        "log_path": str(log_path.relative_to(REPO_ROOT)),
    }


def main():
    parser = argparse.ArgumentParser(description="Pirate Arcade Python Game Test Runner")
    parser.add_argument(
        "--game",
        help="Canonical game ID or alias (cannonball-clash, treasure-cove, krakens-wake, pong, breakout, asteroids)",
    )
    args = parser.parse_args()

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # Resolve game filter
    game_filter = None
    if args.game:
        canonical = ALIASES.get(args.game)
        if not canonical:
            valid = ", ".join(sorted(ALIASES))
            print(f"ERROR: Unknown game ID '{args.game}'. Valid: {valid}")
            sys.exit(1)
        game_filter = canonical

    # --- Compile validation ---
    compile_errors: list[str] = []

    compile_errors.extend(compile_python_tree(SCRIPTS_BASE / "shared", "shared"))
    for cfg in GAME_CONFIGS:
        compile_errors.extend(compile_python_tree(cfg["game_dir"], cfg["label"]))

    if compile_errors:
        print("\n".join(compile_errors))
        sys.exit(1)

    all_results: list[dict] = []

    # --- Shared test suites ---
    if game_filter is None:
        shared_pythonpath = SHARED_PYTHONPATH
        for tf in SHARED_TEST_FILES:
            test_path = TEST_DIR / tf
            if not test_path.is_file():
                all_results.append({
                    "suite": tf.replace(".py", ""),
                    "test_file": tf,
                    "process_result": "failed",
                    "tests_run": 0,
                    "failures": 0,
                    "errors": 0,
                    "skips": 0,
                    "exit_code": -1,
                    "duration_seconds": 0.0,
                    "log_path": "",
                })
                continue
            label = tf.replace(".py", "").replace("test_", "")
            log_path = LOG_DIR / f"shared-{tf}"
            result = run_suite(tf, shared_pythonpath, label, log_path)
            all_results.append(result)

    # --- Per-game suites ---
    for cfg in GAME_CONFIGS:
        if game_filter and cfg["id"] != game_filter:
            continue

        test_path = TEST_DIR / cfg["test_file"]
        if not test_path.is_file():
            print(f"  FAIL  Missing test file: {test_path}")
            all_results.append({
                "suite": cfg["label"],
                "test_file": cfg["test_file"],
                "process_result": "failed",
                "tests_run": 0, "failures": 0, "errors": 0, "skips": 0,
                "exit_code": -1, "duration_seconds": 0.0, "log_path": "",
            })
            continue

        pythonpath = os.pathsep.join([
            str(cfg["game_dir"]),
            str(SCRIPTS_BASE),
            str(TEST_DIR),
        ])

        # Game-specific tests
        log_path = LOG_DIR / f"{cfg['id']}.log"
        result = run_suite(cfg["test_file"], pythonpath, cfg["label"], log_path)
        all_results.append(result)

        # Runtime contract test
        if cfg["runtime_contract"]:
            contract_path = TEST_DIR / "test_game_runtime_contract.py"
            if not contract_path.is_file():
                all_results.append({
                    "suite": f"{cfg['label']} (contract)",
                    "test_file": "test_game_runtime_contract.py",
                    "process_result": "failed",
                    "tests_run": 0, "failures": 0, "errors": 0, "skips": 0,
                    "exit_code": -1, "duration_seconds": 0.0, "log_path": "",
                })
                continue
            contract_log = LOG_DIR / f"{cfg['id']}-contract.log"
            contract_result = run_suite(
                "test_game_runtime_contract.py",
                pythonpath,
                f"{cfg['label']} (contract)",
                contract_log,
                env_override={"PA_GAME_ID": cfg["id"]},
            )
            all_results.append(contract_result)

    # --- Summary ---
    failures = sum(1 for r in all_results if r["process_result"] != "passed")
    total_tests = sum(r["tests_run"] for r in all_results)
    total_failures = sum(r["failures"] for r in all_results)
    total_errors = sum(r["errors"] for r in all_results)

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "suites": all_results,
        "total_suites": len(all_results),
        "failed_suites": failures,
        "total_tests": total_tests,
        "total_failures": total_failures,
        "total_errors": total_errors,
    }

    summary_path = LOG_DIR / "summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    # Console output
    for r in all_results:
        icon = "✓" if r["process_result"] == "passed" else "✗"
        print(f"  {icon} {r['suite']} ({r['tests_run']} tests, "
              f"{r['failures']} failures, {r['errors']} errors, "
              f"{r['skips']} skips) [{r['duration_seconds']}s]")

    if failures:
        for r in all_results:
            if r["process_result"] != "passed":
                print(f"  FAILED: {r['suite']} — {r['test_file']}")
        print(f"\n{'='*50}")
        print(f"Failed: {failures}/{len(all_results)} suites, "
              f"{total_failures} test failures, {total_errors} errors")
        print(f"Logs: {LOG_DIR}")
        sys.exit(1)

    print(f"\n{'='*50}")
    print(f"All {len(all_results)} suites passed ({total_tests} tests)")
    print(f"Logs: {LOG_DIR}")


if __name__ == "__main__":
    main()
