#!/usr/bin/env node

import { execSync, execFile } from "child_process";
import { writeFileSync, existsSync, renameSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

// ── Check definitions ────────────────────────────────────────────

const CHECKS = {
  format: {
    name: "Format check",
    cmd: "npm run format:check",
    cmdParts: ["npm", "run", "format:check"],
    group: "prereq",
  },
  typecheck: {
    name: "Typecheck",
    cmd: "npm run typecheck",
    cmdParts: ["npm", "run", "typecheck"],
    group: "prereq",
  },
  build: {
    name: "Build",
    cmd: "npm run build",
    cmdParts: ["npm", "run", "build"],
    group: "prereq",
  },
  "seo-audit": {
    name: "SEO audit",
    cmd: "npm run seo:audit",
    cmdParts: ["npm", "run", "seo:audit"],
    group: "static",
  },
  "copy-tone": {
    name: "Copy tone",
    cmd: "npm run test:copy-tone",
    cmdParts: ["npm", "run", "test:copy-tone"],
    group: "static",
  },
  "css-tokens": {
    name: "CSS tokens",
    cmd: "npm run test:css-tokens",
    cmdParts: ["npm", "run", "test:css-tokens"],
    group: "static",
  },
  contrast: {
    name: "Visual contrast",
    cmd: "npm run test:visual-contrast",
    cmdParts: ["npm", "run", "test:visual-contrast"],
    group: "static",
  },
  dependency: {
    name: "Dependency hygiene",
    cmd: "npm run check:dependency-hygiene",
    cmdParts: ["npm", "run", "check:dependency-hygiene"],
    group: "static",
  },
  headers: {
    name: "Cloudflare headers",
    cmd: "npm run test:check-headers",
    cmdParts: ["npm", "run", "test:check-headers"],
    group: "static",
  },
  shells: {
    name: "Browser game shells",
    cmd: "npm run test:browser-game-shells",
    cmdParts: ["npm", "run", "test:browser-game-shells"],
    group: "static",
  },
  "shell-int": {
    name: "Game shell integrity",
    cmd: "npm run test:game-shell-integrity",
    cmdParts: ["npm", "run", "test:game-shell-integrity"],
    group: "static",
  },
  sw: {
    name: "Service worker",
    cmd: "npm run test:service-worker",
    cmdParts: ["npm", "run", "test:service-worker"],
    group: "static",
  },
  cachever: {
    name: "Cache versioning",
    cmd: "npm run test:cache-versioning",
    cmdParts: ["npm", "run", "test:cache-versioning"],
    group: "static",
  },
  boot: {
    name: "Pygbag boot contract",
    cmd: "npm run test:pygbag-boot-contract",
    cmdParts: ["npm", "run", "test:pygbag-boot-contract"],
    group: "static",
  },
  bootprog: {
    name: "Pygbag boot program",
    cmd: "npm run test:pygbag-boot-program",
    cmdParts: ["npm", "run", "test:pygbag-boot-program"],
    group: "static",
  },
  drift: {
    name: "Pygbag shell drift",
    cmd: "npm run test:pygbag-shell-drift",
    cmdParts: ["npm", "run", "test:pygbag-shell-drift"],
    group: "static",
  },
  versions: {
    name: "Game versions",
    cmd: "npm run test:game-versions",
    cmdParts: ["npm", "run", "test:game-versions"],
    group: "static",
  },
  htmlstruct: {
    name: "HTML structure",
    cmd: "npm run test:html-structure",
    cmdParts: ["npm", "run", "test:html-structure"],
    group: "static",
  },
  archivepar: {
    name: "Archive parity",
    cmd: "npm run test:archive-parity",
    cmdParts: ["npm", "run", "test:archive-parity"],
    group: "static",
  },
  archaudit: {
    name: "Audit game archives",
    cmd: "npm run audit:game-archives",
    cmdParts: ["npm", "run", "audit:game-archives"],
    group: "static",
  },
  links: {
    name: "Site links",
    cmd: "npm run test:site-links",
    cmdParts: ["npm", "run", "test:site-links"],
    group: "static",
  },
  pdart: {
    name: "Public domain art",
    cmd: "npm run test:public-domain-art",
    cmdParts: ["npm", "run", "test:public-domain-art"],
    group: "static",
  },
  themingsrc: {
    name: "Game theming source",
    cmd: "npm run test:game-theming-source",
    cmdParts: ["npm", "run", "test:game-theming-source"],
    group: "static",
  },
  registry: {
    name: "Game registry",
    cmd: "npm run test:game-registry",
    cmdParts: ["npm", "run", "test:game-registry"],
    group: "static",
  },
  docs: {
    name: "Repository docs",
    cmd: "npm run test:docs",
    cmdParts: ["npm", "run", "test:docs"],
    group: "static",
  },
  ships: {
    name: "Race ship assets",
    cmd: "npm run test:race-ship-assets",
    cmdParts: ["npm", "run", "test:race-ship-assets"],
    group: "static",
  },
  screenshots: {
    name: "Screenshot assets",
    cmd: "npm run test:screenshot-assets",
    cmdParts: ["npm", "run", "test:screenshot-assets"],
    group: "static",
  },
  budgets: {
    name: "Performance budgets",
    cmd: "npm run test:performance-budgets",
    cmdParts: ["npm", "run", "test:performance-budgets"],
    group: "static",
  },
  pythongames: {
    name: "Python gameplay tests",
    cmd: "npm run test:python-games",
    cmdParts: ["npm", "run", "test:python-games"],
    group: "static",
  },
  sitetheme: {
    name: "Site theme",
    cmd: "npm run test:site-theme",
    cmdParts: ["npm", "run", "test:site-theme"],
    group: "browser",
  },
  sitecontent: {
    name: "Site game content",
    cmd: "npm run test:site-game-content",
    cmdParts: ["npm", "run", "test:site-game-content"],
    group: "browser",
  },
  a11y: {
    name: "Accessibility",
    cmd: "npm run test:a11y",
    cmdParts: ["npm", "run", "test:a11y"],
    group: "browser",
  },
  mobilelayout: {
    name: "Mobile layout",
    cmd: "npm run test:mobile-layout",
    cmdParts: ["npm", "run", "test:mobile-layout"],
    group: "browser",
  },
  mobilepause: {
    name: "Mobile pause",
    cmd: "npm run test:mobile-pause",
    cmdParts: ["npm", "run", "test:mobile-pause"],
    group: "browser",
  },
  mobileinput: {
    name: "Mobile input",
    cmd: "npm run test:mobile-input",
    cmdParts: ["npm", "run", "test:mobile-input"],
    group: "browser",
  },
  mobilenav: {
    name: "Mobile navigation",
    cmd: "npm run test:mobile-navigation",
    cmdParts: ["npm", "run", "test:mobile-navigation"],
    group: "browser",
  },
  mobilereg: {
    name: "Mobile regression",
    cmd: "npm run test:mobile-regression",
    cmdParts: ["npm", "run", "test:mobile-regression"],
    group: "browser",
  },
  ipadlayout: {
    name: "iPad layout",
    cmd: "npm run test:ipad-layout",
    cmdParts: ["npm", "run", "test:ipad-layout"],
    group: "browser",
  },
  ipadcontrols: {
    name: "iPad controls",
    cmd: "npm run test:ipad-controls",
    cmdParts: ["npm", "run", "test:ipad-controls"],
    group: "browser",
  },
  browsergames: {
    name: "Browser games (chromium)",
    cmd: "npm run test:browser-games:chromium",
    cmdParts: ["npm", "run", "test:browser-games:chromium"],
    group: "browser",
  },
  webnativegames: {
    name: "Web-native games (chromium)",
    cmd: "npm run test:web-native-games:chromium",
    cmdParts: ["npm", "run", "test:web-native-games:chromium"],
    group: "browser",
  },
  gametheme: {
    name: "Game theming (visual)",
    cmd: "npm run test:game-theming",
    cmdParts: ["npm", "run", "test:game-theming"],
    group: "browser",
  },
  prewarm: {
    name: "Game prewarm",
    cmd: "npm run test:game-prewarm",
    cmdParts: ["npm", "run", "test:game-prewarm"],
    group: "browser",
  },
  captainslog: {
    name: "Captain's Log",
    cmd: "npm run test:captains-log",
    cmdParts: ["npm", "run", "test:captains-log"],
    group: "browser",
  },
  lhci: {
    name: "Lighthouse CI",
    cmd: "npm run test:lhci",
    cmdParts: ["npm", "run", "test:lhci"],
    group: "lighthouse",
  },
};

// ── Profile definitions (ordered ID lists) ───────────────────────

const FAST_IDS = [
  "format",
  "typecheck",
  "build",
  "seo-audit",
  "copy-tone",
  "css-tokens",
  "contrast",
  "dependency",
  "headers",
  "shells",
  "shell-int",
  "sw",
  "cachever",
  "boot",
  "bootprog",
  "drift",
  "versions",
  "htmlstruct",
  "archivepar",
  "archaudit",
  "links",
  "pdart",
  "themingsrc",
  "registry",
  "docs",
  "ships",
  "screenshots",
  "budgets",
];

const POST_BUILD_IDS = FAST_IDS.filter(
  (id) => !["format", "typecheck", "build"].includes(id),
);

const PREREQ_IDS = ["format", "typecheck", "build"];

const FULL_IDS = [
  ...FAST_IDS,
  "sitetheme",
  "sitecontent",
  "a11y",
  "mobilelayout",
  "mobilepause",
  "mobileinput",
  "mobilenav",
  "mobilereg",
  "ipadlayout",
  "ipadcontrols",
  "browsergames",
  "webnativegames",
  "gametheme",
  "prewarm",
  "captainslog",
  "lhci",
];

const PROFILES = {
  fast: { name: "fast", ids: FAST_IDS },
  full: { name: "full", ids: FULL_IDS },
  "post-build": { name: "post-build", ids: POST_BUILD_IDS },
  prerequisites: { name: "prerequisites", ids: PREREQ_IDS },
};

// ── Pure: argument parsing ────────────────────────────────────────

export function parseArgs(argv) {
  const flags = { list: false, continueOnFail: false, json: false };
  let explicitProfile = null;
  let jsonOutputPath = null;
  const errors = [];

  for (const arg of argv) {
    if (arg === "--list") {
      flags.list = true;
    } else if (arg === "--continue") {
      flags.continueOnFail = true;
    } else if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--fast") {
      setProfile("fast");
    } else if (arg === "--full") {
      setProfile("full");
    } else if (arg.startsWith("--profile=")) {
      const val = arg.split("=")[1];
      if (!val) errors.push("--profile= requires a value");
      else setProfile(val);
    } else if (arg.startsWith("--json-output=")) {
      const val = arg.split("=")[1];
      if (!val) errors.push("--json-output= requires a path");
      else jsonOutputPath = val;
    } else if (arg.startsWith("--")) {
      errors.push(`Unknown flag: ${arg}`);
    }
  }

  function setProfile(name) {
    if (explicitProfile !== null && explicitProfile !== name) {
      errors.push(
        `Contradictory profiles: "${explicitProfile}" and "${name}". Use only one profile selector.`,
      );
    }
    explicitProfile = name;
  }

  return { flags, profile: explicitProfile, jsonOutputPath, errors };
}

// ── Pure: resolve check list ─────────────────────────────────────

export function resolveProfile(profileName) {
  const profile = PROFILES[profileName];
  if (!profile) {
    return {
      error: `Unknown profile "${profileName}". Valid: ${Object.keys(PROFILES).join(", ")}`,
      checks: [],
    };
  }
  return {
    error: null,
    checks: profile.ids.map((id) => ({ id, ...CHECKS[id] })),
    profile: profile.name,
  };
}

// ── Command execution ────────────────────────────────────────────

export function runCommand(check) {
  const start = Date.now();
  let status = "passed";
  let exitCode = 0;
  let signal = null;
  try {
    execSync(check.cmd, {
      stdio: "inherit",
      encoding: "utf-8",
      shell: "/bin/bash",
    });
  } catch (err) {
    status = "failed";
    exitCode = err.status || 1;
    signal = err.signal || null;
  }
  const elapsedMs = Date.now() - start;
  return {
    id: check.id,
    name: check.name,
    command: check.cmd,
    status,
    elapsedMs,
    exitCode,
    signal,
  };
}

export async function runCommandAsync(check) {
  return new Promise((resolve) => {
    const startMs = Date.now();
    const cmdParts = check.cmdParts || check.cmd.split(/\s+/);
    const proc = execFile(
      cmdParts[0],
      cmdParts.slice(1),
      { shell: "/bin/bash" },
      (err) => {
        const elapsedMs = Date.now() - startMs;
        let status = "passed";
        let exitCode = 0;
        let signal = null;
        if (err) {
          status = "failed";
          exitCode = err.status || 1;
          signal = err.signal || null;
        }
        resolve({
          id: check.id,
          name: check.name,
          command: check.cmd,
          status,
          elapsedMs,
          exitCode,
          signal,
        });
      },
    );
    proc.stdout?.pipe(process.stdout);
    proc.stderr?.pipe(process.stderr);
  });
}

/**
 * Run checks in a bounded worker pool.
 * Every worker claims the next index via claimNextIndex, ensuring
 * no index is processed twice and the function resolves only after
 * every started check completes.
 *
 * @param {Array} checks
 * @param {number} concurrency
 * @param {function} [runCheckAsyncFn] - injectable async run function
 */
export async function runChecksParallel(
  checks,
  concurrency = 3,
  runCheckAsyncFn,
) {
  if (checks.length === 0) return [];
  const results = [];
  let nextIndex = 0;
  const runFn = runCheckAsyncFn || runCommandAsync;

  function claimNextIndex() {
    const i = nextIndex;
    if (i >= checks.length) return null;
    nextIndex = i + 1;
    return i;
  }

  async function worker() {
    while (true) {
      const index = claimNextIndex();
      if (index === null) return;
      results[index] = await runFn(checks[index]);
    }
  }

  const workerCount = Math.min(concurrency, checks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

// ── Orchestrator ──────────────────────────────────────────────────

/**
 * Run a collection of checks respecting execution-class safety.
 *
 * In fail-fast mode, any failure within a group skips the rest of that
 * group and all later groups.
 * In --continue mode, every check runs regardless of failures, but
 * execution-class safety (static parallel, browser sequential, etc.)
 * is still enforced.
 *
 * @param {object} options
 * @param {Array} options.checks - check objects with .group
 * @param {boolean} options.continueOnFail - continue after failures
 * @param {function} [options.runCheck] - injectable run function (for testing)
 * @param {function} [options.runCheckAsync] - injectable async run function (for testing)
 * @returns {{ results: Array, skipped: Array }}
 */
export async function runChecksByGroup({
  checks,
  continueOnFail,
  runCheck: runCheckSync,
  runCheckAsync: runCheckAsyncFn,
}) {
  const results = [];
  const skipped = [];
  const runSync = runCheckSync || runCommand;
  const runAsync = runCheckAsyncFn || runCommandAsync;

  const groups = ["prereq", "static", "browser", "lighthouse", "isolated"];
  const groupOrder = {};
  groups.forEach((g, i) => {
    groupOrder[g] = i;
  });

  const byGroup = {};
  for (const check of checks) {
    const g = check.group || "static";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(check);
  }

  function skipFromGroup(groupName, startIdx) {
    const group = byGroup[groupName] || [];
    for (let j = startIdx; j < group.length; j++) {
      skipped.push({
        id: group[j].id,
        name: group[j].name,
        reason: "fail-fast",
      });
    }
    const gIdx = groupOrder[groupName];
    for (let g = gIdx + 1; g < groups.length; g++) {
      const laterGroup = byGroup[groups[g]];
      if (laterGroup) {
        for (const c of laterGroup) {
          skipped.push({ id: c.id, name: c.name, reason: "fail-fast" });
        }
      }
    }
  }

  function shouldKeepGoing() {
    return continueOnFail || skipped.length === 0;
  }

  // ── Prerequisites (sequential) ──
  const prereqGroup = byGroup["prereq"] || [];
  for (let i = 0; i < prereqGroup.length; i++) {
    const check = prereqGroup[i];
    const result = runSync(check);
    results.push(result);
    if (result.status !== "passed") {
      if (!continueOnFail) {
        skipFromGroup("prereq", i + 1);
        return { results, skipped };
      }
    }
  }

  const anyPrereqFailed = results
    .slice(0, prereqGroup.length)
    .some((r) => r.status !== "passed");

  // If --continue is off and a prereq failed, we already returned.
  // If --continue is on, proceed regardless.

  // ── Static checks (parallel in --continue, sequential in fail-fast) ──
  const staticGroup = byGroup["static"] || [];
  if (staticGroup.length > 0) {
    if (continueOnFail) {
      const parallelResults = await runChecksParallel(staticGroup, 3, runAsync);
      for (const result of parallelResults) {
        results.push(result);
      }
    } else {
      for (let i = 0; i < staticGroup.length; i++) {
        const check = staticGroup[i];
        const result = runSync(check);
        results.push(result);
        if (result.status !== "passed") {
          skipFromGroup("static", i + 1);
          return { results, skipped };
        }
      }
    }
  }

  // ── Browser checks (sequential — they start preview servers) ──
  const browserGroup = byGroup["browser"] || [];
  for (let i = 0; i < browserGroup.length; i++) {
    const check = browserGroup[i];
    const result = runSync(check);
    results.push(result);
    if (result.status !== "passed" && !continueOnFail) {
      skipFromGroup("browser", i + 1);
      return { results, skipped };
    }
  }

  // ── Isolated checks (sequential, exclusive) ──
  const isolatedGroup = byGroup["isolated"] || [];
  for (let i = 0; i < isolatedGroup.length; i++) {
    const check = isolatedGroup[i];
    const result = runSync(check);
    results.push(result);
    if (result.status !== "passed" && !continueOnFail) {
      skipFromGroup("isolated", i + 1);
      return { results, skipped };
    }
  }

  // ── Lighthouse (alone, last) ──
  const lighthouseGroup = byGroup["lighthouse"] || [];
  for (let i = 0; i < lighthouseGroup.length; i++) {
    const check = lighthouseGroup[i];
    const result = runSync(check);
    results.push(result);
    if (result.status !== "passed" && !continueOnFail) {
      skipFromGroup("lighthouse", i + 1);
      return { results, skipped };
    }
  }

  return { results, skipped };
}

// ── JSON report builder ──────────────────────────────────────────

export function buildReport(profileName, results, startedAt, skipped) {
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status !== "passed").length;
  const sorted = [...results].sort((a, b) => b.elapsedMs - a.elapsedMs);
  return {
    schemaVersion: 3,
    profile: profileName,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt.getTime(),
    summary: {
      passed,
      failed,
      skipped: skipped ? skipped.length : 0,
      total: results.length + (skipped ? skipped.length : 0),
    },
    checks: results.map((r) => ({
      id: r.id,
      name: r.name,
      command: r.command,
      status: r.status,
      elapsedMs: r.elapsedMs,
      exitCode: r.exitCode,
      signal: r.signal || undefined,
    })),
    skippedChecks: (skipped || []).map((s) => ({
      id: s.id,
      name: s.name,
      reason: s.reason || "fail-fast",
    })),
    slowest:
      sorted.length > 0
        ? sorted
            .slice(0, 3)
            .map((r) => ({ name: r.name, elapsedMs: r.elapsedMs }))
        : [],
  };
}

function writeJsonAtomic(filePath, data) {
  const tmp = filePath + ".tmp." + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  try {
    if (existsSync(filePath)) {
      renameSync(filePath, filePath + ".bak." + process.pid);
    }
  } catch {}
  renameSync(tmp, filePath);
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const {
    flags,
    profile: explicitProfile,
    jsonOutputPath,
    errors,
  } = parseArgs(process.argv.slice(2));

  if (errors.length > 0) {
    for (const e of errors) console.error("error:", e);
    process.exit(2);
  }

  const profileName = explicitProfile || "full";
  const { error: resolveError, checks } = resolveProfile(profileName);
  if (resolveError) {
    console.error(resolveError);
    process.exit(1);
  }

  if (flags.list) {
    console.log(
      JSON.stringify(
        {
          schemaVersion: 3,
          profile: profileName,
          checks: checks.map((c) => ({
            id: c.id,
            name: c.name,
            command: c.cmd,
            group: c.group,
          })),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  // Trap signals for clean exit
  let shuttingDown = false;
  function onSignal(sig) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`\n\u26a0\ufe0f  Interrupted by ${sig}`);
    process.exit(128 + (sig === "SIGINT" ? 2 : sig === "SIGTERM" ? 15 : 1));
  }
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  const mode = profileName.toUpperCase();
  console.log(
    `\n\u{1F680} Starting ${mode} release gate (${checks.length} checks)`,
  );
  console.log(
    `   Mode: ${flags.continueOnFail ? "continue on failure" : "fail-fast (default)"}\n`,
  );

  const startedAt = new Date();

  const { results, skipped } = await runChecksByGroup({
    checks,
    continueOnFail: flags.continueOnFail,
  });

  const report = buildReport(profileName, results, startedAt, skipped);

  // Human output
  for (const r of results) {
    const idx = checks.findIndex((c) => c.id === r.id);
    const check = checks[idx];
    if (check) {
      console.log(`  \u25b6 ${check.name}`);
      const msg =
        r.status === "passed"
          ? `    \u2705 (${r.elapsedMs}ms)`
          : `    \u274c failed (${r.elapsedMs}ms, exit ${r.exitCode}${r.signal ? `, signal ${r.signal}` : ""})`;
      console.log(msg);
    }
  }

  // Summary
  const totalPassed = report.summary.passed;
  const totalFailed = report.summary.failed;
  const totalSkipped = report.summary.skipped;
  const totalCheck = report.summary.total;

  console.log(`\n\u2501`.repeat(46));
  console.log(`\u{1F4CA} ${mode} gate complete in ${report.elapsedMs}ms`);
  console.log(`   \u2705 Passed: ${totalPassed}`);
  if (totalFailed > 0) console.log(`   \u274c Failed: ${totalFailed}`);
  if (totalSkipped > 0) console.log(`   \u23ed  Skipped: ${totalSkipped}`);
  console.log(`   Total: ${totalCheck}`);
  if (report.slowest.length > 0) {
    console.log(`   Slowest:`);
    for (const s of report.slowest)
      console.log(`     ${s.name} (${s.elapsedMs}ms)`);
  }

  if (totalFailed > 0) {
    console.error(`\nFailed checks:`);
    for (const c of report.checks) {
      if (c.status !== "passed") console.error(`   [${c.id}] ${c.name}`);
    }
  }

  // Machine output
  if (jsonOutputPath) {
    const resolvedPath = resolve(jsonOutputPath);
    writeJsonAtomic(resolvedPath, report);
    console.log(`\n\u{1F4C4} JSON report written to ${resolvedPath}`);
  }

  if (flags.json) {
    console.log(JSON.stringify(report));
  } else if (!jsonOutputPath) {
    // Always emit compact JSON as last line for tooling (unless --json was used to suppress it)
    console.log("\n" + JSON.stringify(report));
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

// Guard: only run main when this is the entry point
const thisFile = fileURLToPath(import.meta.url);
const isEntry =
  process.argv[1] &&
  (process.argv[1] === thisFile ||
    process.argv[1].endsWith("/scripts/verify-release.mjs"));
if (isEntry) {
  main();
}
