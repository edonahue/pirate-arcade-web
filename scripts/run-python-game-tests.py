#!/usr/bin/env python3
"""
Pirate Arcade — Python Game Test Runner

Invokes each Pygbag game's Python test suite in an isolated subprocess
so sys.modules contamination between games cannot happen.

Usage:
    python3 scripts/run-python-game-tests.py             # run all game tests
    python3 scripts/run-python-game-tests.py --game=breakout  # single game

Returns non-zero if any test fails, a test file is missing, or no tests
are discovered. Fails if a source module fails to compile or import.
"""

import subprocess
import sys
import os
import glob

SCRIPTS_BASE = os.path.join(os.path.dirname(__file__), "../scripts/pygbag-port")
TEST_DIR = os.path.join(os.path.dirname(__file__), "../tests/unit")

GAME_CONFIGS = [
    {
        "id": "cannonball-clash",
        "test_file": "test_cannonball_clash.py",
        "game_dir": os.path.join(SCRIPTS_BASE, "cannonball-clash"),
        "label": "Cannonball Clash",
    },
    {
        "id": "breakout",
        "test_file": "test_treasure_cove.py",
        "game_dir": os.path.join(SCRIPTS_BASE, "treasure-cove"),
        "label": "Treasure Cove",
    },
    {
        "id": "asteroids",
        "test_file": "test_kraken_stress.py",
        "game_dir": os.path.join(SCRIPTS_BASE, "krakens-wake"),
        "label": "Kraken's Wake",
    },
]


def run_game_tests(game):
    test_path = os.path.join(TEST_DIR, game["test_file"])
    if not os.path.isfile(test_path):
        print(f"  FAIL  Missing test file: {test_path}")
        return False

    if not os.path.isdir(game["game_dir"]):
        print(f"  FAIL  Missing game source directory: {game['game_dir']}")
        return False

    env = os.environ.copy()
    env["SDL_VIDEODRIVER"] = "dummy"
    env["SDL_AUDIODRIVER"] = "dummy"
    env["PYTHONPATH"] = f"{game['game_dir']}:{SCRIPTS_BASE}:{TEST_DIR}"

    result = subprocess.run(
        [sys.executable, "-m", "unittest", game["test_file"].replace(".py", "")],
        cwd=TEST_DIR,
        env=env,
        capture_output=True,
        text=True,
    )

    output = result.stdout + result.stderr
    return result.returncode, output


def main():
    args = sys.argv[1:]
    game_filter = None
    for arg in args:
        if arg.startswith("--game="):
            game_filter = arg.split("=", 1)[1]

    failures = 0
    total = 0

    for game in GAME_CONFIGS:
        if game_filter and game["id"] != game_filter:
            continue

        total += 1
        print(f"\n━━━ {game['label']} ━━━")
        sys.stdout.flush()

        test_path = os.path.join(TEST_DIR, game["test_file"])
        if not os.path.isfile(test_path):
            print(f"  ⚠ MISSING: {game['test_file']}")
            failures += 1
            continue

        test_files = [game["test_file"]]
        contract_file = "test_game_runtime_contract.py"
        if os.path.isfile(os.path.join(TEST_DIR, contract_file)):
            test_files.append(contract_file)

        any_fail = False
        for tf in test_files:
            result = subprocess.run(
                [sys.executable, "-u", "-m", "unittest", "discover", "-s", TEST_DIR,
                 "-p", tf, "-v"],
                cwd=TEST_DIR,
                env={
                    **os.environ,
                    "SDL_VIDEODRIVER": "dummy",
                    "SDL_AUDIODRIVER": "dummy",
                    "PYTHONPATH": f"{game['game_dir']}:{SCRIPTS_BASE}",
                },
                capture_output=True,
                text=True,
            )

            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(result.stderr, file=sys.stderr)

            if result.returncode != 0:
                print(f"  ✗ {game['label']} FAILED ({tf})")
                any_fail = True

        if any_fail:
            failures += 1
        else:
            print(f"  ✓ {game['label']} passed")

    if total == 0:
        print("\nNo tests were discovered — nothing to run.")
        sys.exit(1)

    summary = f"\n{'='*40}\nRan {total} game suite(s): {total - failures} passed, {failures} failed\n"
    print(summary)

    if failures:
        # Print guidance if pygame is missing
        try:
            import pygame
        except ImportError:
            print("Hint: pygame is not installed. Run: pip install -r requirements-test.txt")
        sys.exit(1)


if __name__ == "__main__":
    main()
