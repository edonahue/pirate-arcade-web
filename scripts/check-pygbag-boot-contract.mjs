#!/usr/bin/env node
/**
 * Validate the Pygbag Python boot contract across all generated shells.
 *
 * Python-side checks use the authoritative renderPythonBootProgram() as
 * source of truth. Shell-to-source equivalence verifies the commited shell
 * matches the rendered output. JS-side phases are checked from the shell
 * (they come from the inline script template, not the Python boot code).
 *
 * Usage: node scripts/check-pygbag-boot-contract.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import PYBAG_GAMES from "./pygbag-game-config.mjs";
import {
  renderPythonBootProgram,
  BOOT_MARKS,
  extractGameCodeFromShell,
} from "./pygbag-boot-program.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Boot contract definition ──────────────────────────────────

// Phases emitted from JS inline script (inline <script> block)
const JS_BOOT_PHASES = [
  "cross-file-replaced",
  "pythons-js-requested",
  "python-ready",
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
  const rendered = renderPythonBootProgram(config);

  // ── JS-side phases (from inline script in shell) ─────────────

  for (const phase of JS_BOOT_PHASES) {
    totalChecks++;
    const pattern = new RegExp("mark\\('" + phase + "'\\)");
    if (pattern.test(html)) {
      ok(config.id + ": JS phase " + phase);
      totalPhases++;
    } else {
      fail(config.id + ": missing JS phase " + phase);
    }
  }

  // ── Shell gameCode extractable ───────────────────────────────
  // Verify the gameCode array exists in the shell. Full shell-to-source
  // equivalence is covered by scripts/check-pygbag-shell-drift.mjs.

  totalChecks++;
  const extracted = extractGameCodeFromShell(html);
  if (extracted) {
    ok(config.id + ": shell gameCode extractable");
  } else {
    fail(config.id + ": shell gameCode not extractable");
  }

  // ── Python-side phases (from authoritative renderer) ─────────

  const source = rendered.source;

  // Check all BOOT_MARKS appear in the rendered source
  for (const phase of BOOT_MARKS) {
    totalChecks++;
    const pattern = new RegExp('mark\\("' + phase + '"\\)');
    if (pattern.test(source)) {
      ok(config.id + ": Python phase " + phase);
      totalPhases++;
    } else {
      fail(config.id + ": missing Python phase " + phase);
    }
  }

  // Verify BOOT_MARKS appear in the correct order
  let lastIdx = -1;
  let orderOk = true;
  for (const phase of BOOT_MARKS) {
    totalChecks++;
    const pattern = new RegExp('mark\\("' + phase + '"\\)');
    const phaseIdx = source.search(pattern);
    if (phaseIdx === -1) {
      fail(config.id + ": Python phase " + phase + " not in source");
      continue;
    }
    if (phaseIdx < lastIdx) {
      fail(
        config.id +
          ": Python phase order violation — " +
          phase +
          " appears after " +
          BOOT_MARKS[BOOT_MARKS.indexOf(phase) - 1],
      );
      orderOk = false;
    }
    lastIdx = phaseIdx;
  }
  if (orderOk) {
    ok(config.id + ": Python phase order correct");
  }

  // ── Structural checks on rendered source ─────────────────────

  totalChecks++;
  if (/sys\.path\.insert\(/.test(source)) {
    ok(config.id + ": sys.path.insert present");
  } else {
    fail(config.id + ": missing sys.path.insert");
  }

  totalChecks++;
  if (/os\.chdir\(/.test(source)) {
    ok(config.id + ": os.chdir present");
  } else {
    fail(config.id + ": missing os.chdir");
  }

  // Import must appear after sys.path.insert and os.chdir
  const importMatch = source.match(/from\s+\S+\s+import\s+\S+/);
  const sysPathMatch = source.match(/sys\.path\.insert/);
  const osChdirMatch = source.match(/os\.chdir/);
  const importIdx = importMatch ? importMatch.index : -1;
  const sysPathIdx = sysPathMatch ? sysPathMatch.index : -1;
  const osChdirIdx = osChdirMatch ? osChdirMatch.index : -1;

  if (sysPathIdx !== -1 && osChdirIdx !== -1) {
    totalChecks++;
    if (importIdx !== -1 && importIdx > sysPathIdx && importIdx > osChdirIdx) {
      ok(config.id + ": import follows sys.path.insert and os.chdir");
    } else {
      fail(config.id + ": import before sys.path.insert or os.chdir");
    }
  }

  // Validate exact pythonModule and gameClass from config
  totalChecks++;
  const expectedImport =
    "from " + config.pythonModule + " import " + config.gameClass;
  if (source.includes(expectedImport)) {
    ok(config.id + ': import "' + expectedImport + '" matches config');
  } else {
    fail(config.id + ': expected import "' + expectedImport + '" not found');
  }

  // computeDurations must appear after game-ready mark
  const hasComputeDurations = source.includes("computeDurations()");
  const hasGameReady = /mark\("game-ready"\)/.test(source);
  totalChecks++;

  if (hasComputeDurations && hasGameReady) {
    ok(config.id + ": computeDurations follows game-ready");
  } else if (hasComputeDurations && !hasGameReady) {
    fail(config.id + ": computeDurations present but game-ready mark missing");
  }

  // ready() call must appear
  totalChecks++;
  if (/PirateArcadeLoading\.ready\(/.test(source)) {
    ok(config.id + ": ready() present");
  } else {
    fail(config.id + ": missing ready() call");
  }

  // error() call must appear in except block
  totalChecks++;
  if (/PirateArcadeLoading\.error\(/.test(source)) {
    ok(config.id + ": error() present");
  } else {
    fail(config.id + ": missing error() call");
  }

  // exception handler must use sys.print_exception
  totalChecks++;
  if (source.includes("print_exception")) {
    ok(config.id + ": sys.print_exception present");
  } else {
    fail(config.id + ": missing sys.print_exception");
  }

  // boot must be async (async def boot():)
  totalChecks++;
  if (source.includes("async def boot():")) {
    ok(config.id + ": async boot()");
  } else {
    fail(config.id + ": boot() not async");
  }

  // asyncio.ensure_future(boot()) must be present
  totalChecks++;
  if (source.includes("asyncio.ensure_future(boot())")) {
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
