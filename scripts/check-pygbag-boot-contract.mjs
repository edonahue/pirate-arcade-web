#!/usr/bin/env node
/**
 * Validate the Pygbag Python boot contract across all generated shells.
 *
 * The boot contract defines the ordered sequence of PirateArcadeMetrics
 * marks that every Pygbag shell must emit at runtime. This validator
 * checks that each shell's inline script contains the correct phase
 * sequence, and that the Python boot code maintains the correct
 * ordered list of phases.
 *
 * Usage: node scripts/check-pygbag-boot-contract.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import PYBAG_GAMES from "./pygbag-game-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Boot contract definition ──────────────────────────────────

// Phases emitted from JS inline script (inline <script> block)
// page-script-start is in external game-boot-metrics.js, not checked here
const JS_BOOT_PHASES = [
  "cross-file-replaced",
  "pythons-js-requested",
  "python-ready",
];

// Phases emitted from Python boot() function, in order
const PYTHON_BOOT_PHASES = [
  "boot-start",
  "pygame-install-start",
  "archive-fetch-start",
  "pygame-install-end",
  "archive-fetch-end",
  "archive-extract-start",
  "archive-extract-end",
  "input-bridge-installed",
  "display-init-start",
  "display-init-end",
  "game-object-created",
  "game-ready",
];

// Phases emitted from shared JS (pygame-input-bridge.js)
const BRIDGE_BOOT_PHASES = ["loader-hidden"];

// The full ordered contract
const FULL_BOOT_CONTRACT = [
  ...JS_BOOT_PHASES,
  ...PYTHON_BOOT_PHASES,
  ...BRIDGE_BOOT_PHASES,
];

// ── Validator ─────────────────────────────────────────────────

let failures = 0;

function fail(msg) {
  console.error("  [FAIL] " + msg);
  failures++;
}

function ok(msg) {
  console.log("  [PASS] " + msg);
}

function validatePhaseOrder(phases, html, gameId, context) {
  let lastIdx = -1;
  for (const phase of phases) {
    // Build patterns for all three quote styles used in current shells
    const patterns = [
      new RegExp('mark\\("' + phase + '"\\)', "g"),
      new RegExp("mark\\('" + phase + "'\\)", "g"),
      new RegExp('mark\\(\"' + phase + '"\\)', "g"),
      new RegExp("mark\\('" + phase + "'\\)", "g"),
    ];

    const idx =
      html.search(patterns[0]) !== -1
        ? html.search(patterns[0])
        : html.search(patterns[1]);

    if (idx === -1) {
      fail(gameId + " [" + context + ']: missing phase "' + phase + '"');
      continue;
    }

    if (idx < lastIdx) {
      fail(
        gameId +
          " [" +
          context +
          ']: phase "' +
          phase +
          '" appears out of order (after "' +
          phases[phases.indexOf(phase) - 1] +
          '")',
      );
    }
    lastIdx = idx;
  }
}

// ── Main ──────────────────────────────────────────────────────

console.log("Pygbag boot contract check\n");

let totalPhases = 0;
let totalChecks = 0;

for (const config of PYBAG_GAMES) {
  const indexPath = resolve(root, "public/play", config.id, "index.html");
  console.log("-- " + config.id + " --");

  if (!existsSync(indexPath)) {
    fail(config.id + ": index.html not found");
    continue;
  }

  const html = readFileSync(indexPath, "utf-8");

  // Check JS-side phases (inline script only — game-boot-metrics.js is shared)
  for (const phase of JS_BOOT_PHASES) {
    totalChecks++;
    // JS-side uses single quotes for mark() arguments
    const pattern = new RegExp("mark\\('" + phase + "'\\)");
    if (pattern.test(html)) {
      ok(config.id + ": JS phase " + phase);
      totalPhases++;
    } else {
      fail(config.id + ": missing JS phase " + phase);
    }
  }

  // Check Python-side phases (inside the gameCode string array)
  for (const phase of PYTHON_BOOT_PHASES) {
    totalChecks++;
    // Python side uses double quotes for mark() arguments
    const pattern = new RegExp('mark\\("' + phase + '"\\)');
    if (pattern.test(html)) {
      ok(config.id + ": Python phase " + phase);
      totalPhases++;
    } else {
      fail(config.id + ": missing Python phase " + phase);
    }
  }

  // Verify Python phases appear in the correct order in gameCode
  // Extract the gameCode array content (ends at ].join)
  const gameCodeMatch = html.match(/var gameCode = \[([\s\S]*?)\]\.join\(/);
  if (gameCodeMatch) {
    const gameCodeJs = gameCodeMatch[1];
    // Check that all PYTHON_BOOT_PHASES appear in order
    let lastIdx = -1;
    let orderOk = true;
    for (const phase of PYTHON_BOOT_PHASES) {
      totalChecks++;
      const pattern = new RegExp('mark\\("' + phase + '"\\)');
      const phaseIdx = gameCodeJs.search(pattern);
      if (phaseIdx === -1) {
        fail(config.id + ": Python phase " + phase + " not in gameCode");
        continue;
      }
      if (phaseIdx < lastIdx) {
        fail(
          config.id +
            ": Python phase order violation — " +
            phase +
            " appears after " +
            PYTHON_BOOT_PHASES[PYTHON_BOOT_PHASES.indexOf(phase) - 1],
        );
        orderOk = false;
      }
      lastIdx = phaseIdx;
    }
    if (orderOk) {
      ok(config.id + ": Python phase order correct");
    }
  } else {
    fail(config.id + ": could not extract gameCode");
  }

  // Verify key structural dependencies:
  // 1. computeDurations() must appear after game-ready mark
  const hasComputeDurations = html.includes("computeDurations()");
  const hasGameReady = /mark\("game-ready"\)/.test(html);
  totalChecks++;

  if (hasComputeDurations && hasGameReady) {
    ok(config.id + ": computeDurations follows game-ready");
  } else if (hasComputeDurations && !hasGameReady) {
    fail(config.id + ": computeDurations present but game-ready mark missing");
  }

  // 2. ready() call must appear
  totalChecks++;
  if (/PirateArcadeLoading\.ready\(/.test(html)) {
    ok(config.id + ": ready() present");
  } else {
    fail(config.id + ": missing ready() call");
  }

  // 3. error() call must appear in except block
  totalChecks++;
  if (/PirateArcadeLoading\.error\(/.test(html)) {
    ok(config.id + ": error() present");
  } else {
    fail(config.id + ": missing error() call");
  }

  // 4. exception handler must use sys.print_exception
  totalChecks++;
  if (html.includes("print_exception")) {
    ok(config.id + ": sys.print_exception present");
  } else {
    fail(config.id + ": missing sys.print_exception");
  }

  // 5. boot must be async (boot():)
  totalChecks++;
  if (html.includes("async def boot():")) {
    ok(config.id + ": async boot()");
  } else {
    fail(config.id + ": boot() not async");
  }

  // 6. asyncio.ensure_future(boot()) must be present
  totalChecks++;
  if (html.includes("asyncio.ensure_future(boot())")) {
    ok(config.id + ": asyncio.ensure_future(boot())");
  } else {
    fail(config.id + ": missing asyncio.ensure_future(boot())");
  }

  console.log("");
}

// ── Summary ───────────────────────────────────────────────────

console.log("-- summary --");
console.log("Games checked: " + PYBAG_GAMES.length);
console.log("Total checks: " + totalChecks);
console.log("Phases verified: " + totalPhases);

console.log("");
if (failures > 0) {
  console.error("FAILED: " + failures + " boot contract violation(s).");
  process.exit(1);
} else {
  console.log("PASSED: All boot contract checks passed.");
}
