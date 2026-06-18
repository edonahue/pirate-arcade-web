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
    phase: "prereq",
    slow: false,
  },
  typecheck: {
    name: "Typecheck",
    cmd: "npm run typecheck",
    phase: "prereq",
    slow: false,
  },
  build: { name: "Build", cmd: "npm run build", phase: "prereq", slow: false },
  "seo-audit": {
    name: "SEO audit",
    cmd: "npm run seo:audit",
    phase: "static",
    slow: false,
  },
  "copy-tone": {
    name: "Copy tone",
    cmd: "npm run test:copy-tone",
    phase: "static",
    slow: false,
  },
  "css-tokens": {
    name: "CSS tokens",
    cmd: "npm run test:css-tokens",
    phase: "static",
    slow: false,
  },
  contrast: {
    name: "Visual contrast",
    cmd: "npm run test:visual-contrast",
    phase: "static",
    slow: false,
  },
  dependency: {
    name: "Dependency hygiene",
    cmd: "npm run check:dependency-hygiene",
    phase: "static",
    slow: false,
  },
  headers: {
    name: "Cloudflare headers",
    cmd: "npm run test:check-headers",
    phase: "static",
    slow: false,
  },
  shells: {
    name: "Browser game shells",
    cmd: "npm run test:browser-game-shells",
    phase: "static",
    slow: false,
  },
  "shell-int": {
    name: "Game shell integrity",
    cmd: "npm run test:game-shell-integrity",
    phase: "static",
    slow: false,
  },
  sw: {
    name: "Service worker",
    cmd: "npm run test:service-worker",
    phase: "static",
    slow: false,
  },
  cachever: {
    name: "Cache versioning",
    cmd: "npm run test:cache-versioning",
    phase: "static",
    slow: false,
  },
  boot: {
    name: "Pygbag boot contract",
    cmd: "npm run test:pygbag-boot-contract",
    phase: "static",
    slow: false,
  },
  drift: {
    name: "Pygbag shell drift",
    cmd: "npm run test:pygbag-shell-drift",
    phase: "static",
    slow: false,
  },
  versions: {
    name: "Game versions",
    cmd: "npm run test:game-versions",
    phase: "static",
    slow: false,
  },
  htmlstruct: {
    name: "HTML structure",
    cmd: "npm run test:html-structure",
    phase: "static",
    slow: false,
  },
  archivepar: {
    name: "Archive parity",
    cmd: "npm run test:archive-parity",
    phase: "static",
    slow: false,
  },
  archaudit: {
    name: "Audit game archives",
    cmd: "npm run audit:game-archives",
    phase: "static",
    slow: false,
  },
  links: {
    name: "Site links",
    cmd: "npm run test:site-links",
    phase: "static",
    slow: false,
  },
  pdart: {
    name: "Public domain art",
    cmd: "npm run test:public-domain-art",
    phase: "static",
    slow: false,
  },
  themingsrc: {
    name: "Game theming source",
    cmd: "npm run test:game-theming-source",
    phase: "static",
    slow: false,
  },
  registry: {
    name: "Game registry",
    cmd: "npm run test:game-registry",
    phase: "static",
    slow: false,
  },
  docs: {
    name: "Repository docs",
    cmd: "npm run test:docs",
    phase: "static",
    slow: false,
  },
  ships: {
    name: "Race ship assets",
    cmd: "npm run test:race-ship-assets",
    phase: "static",
    slow: false,
  },
  screenshots: {
    name: "Screenshot assets",
    cmd: "npm run test:screenshot-assets",
    phase: "static",
    slow: false,
  },
  budgets: {
    name: "Performance budgets",
    cmd: "npm run test:performance-budgets",
    phase: "static",
    slow: false,
  },
  sitetheme: {
    name: "Site theme",
    cmd: "npm run test:site-theme",
    phase: "full",
    slow: false,
  },
  sitecontent: {
    name: "Site game content",
    cmd: "npm run test:site-game-content",
    phase: "full",
    slow: false,
  },
  a11y: {
    name: "Accessibility",
    cmd: "npm run test:a11y",
    phase: "full",
    slow: false,
  },
  mobilelayout: {
    name: "Mobile layout",
    cmd: "npm run test:mobile-layout",
    phase: "full",
    slow: false,
  },
  mobilepause: {
    name: "Mobile pause",
    cmd: "npm run test:mobile-pause",
    phase: "full",
    slow: false,
  },
  mobileinput: {
    name: "Mobile input",
    cmd: "npm run test:mobile-input",
    phase: "full",
    slow: false,
  },
  mobilenav: {
    name: "Mobile navigation",
    cmd: "npm run test:mobile-navigation",
    phase: "full",
    slow: false,
  },
  mobilereg: {
    name: "Mobile regression",
    cmd: "npm run test:mobile-regression",
    phase: "full",
    slow: false,
  },
  ipadlayout: {
    name: "iPad layout",
    cmd: "npm run test:ipad-layout",
    phase: "full",
    slow: false,
  },
  ipadcontrols: {
    name: "iPad controls",
    cmd: "npm run test:ipad-controls",
    phase: "full",
    slow: false,
  },
  browsergames: {
    name: "Browser games (chromium)",
    cmd: "npm run test:browser-games:chromium",
    phase: "full",
    slow: false,
  },
  webnativegames: {
    name: "Web-native games (chromium)",
    cmd: "npm run test:web-native-games:chromium",
    phase: "full",
    slow: false,
  },
  gametheme: {
    name: "Game theming (visual)",
    cmd: "npm run test:game-theming",
    phase: "full",
    slow: false,
  },
  prewarm: {
    name: "Game prewarm",
    cmd: "npm run test:game-prewarm",
    phase: "full",
    slow: false,
  },
  captainslog: {
    name: "Captain's Log",
    cmd: "npm run test:captains-log",
    phase: "full",
    slow: false,
  },
  lhci: {
    name: "Lighthouse CI",
    cmd: "npm run test:lhci",
    phase: "full",
    slow: true,
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
  const flags = { list: false, continueOnFail: false };
  let explicitProfile = null;
  let jsonOutputPath = null;
  const errors = [];

  for (const arg of argv) {
    if (arg === "--list") {
      flags.list = true;
    } else if (arg === "--continue") {
      flags.continueOnFail = true;
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

function runCommand(check) {
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

/** Run multiple independent checks with bounded concurrency (3 at a time). */
function runCommandsParallel(checks) {
  const CONCURRENCY = 3;
  const results = [];
  let nextIndex = 0;

  function startOne(resolve) {
    const i = nextIndex++;
    const check = checks[i];
    if (!check) return resolve();
    const [cmd, ...args] = check.cmd.split(/\s+/);
    const startMs = Date.now();
    const proc = execFile(cmd, args, { shell: "/bin/bash" }, (err) => {
      const elapsedMs = Date.now() - startMs;
      let status = "passed";
      let exitCode = 0;
      let signal = null;
      if (err) {
        status = "failed";
        exitCode = err.status || 1;
        signal = err.signal || null;
      }
      results.push({
        id: check.id,
        name: check.name,
        command: check.cmd,
        status,
        elapsedMs,
        exitCode,
        signal,
        index: i,
      });
      startOne(resolve);
    });
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
  }

  return new Promise((resolve) => {
    var started = 0;
    while (started < CONCURRENCY && started < checks.length) {
      started++;
      startOne(resolve);
    }
  }).then(() =>
    results.sort((a, b) => a.index - b.index).map(({ index: _, ...r }) => r),
  );
}

// ── JSON report builder ──────────────────────────────────────────

function buildReport(profileName, results, startedAt, skipped) {
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status !== "passed").length;
  const sorted = [...results].sort((a, b) => b.elapsedMs - a.elapsedMs);
  return {
    schemaVersion: 2,
    profile: profileName,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt.getTime(),
    checks: results.map((r) => ({
      id: r.id,
      name: r.name,
      command: r.command,
      status: r.status,
      elapsedMs: r.elapsedMs,
      exitCode: r.exitCode,
      signal: r.signal || undefined,
    })),
    skipped: skipped.map((s) => ({
      id: s.id,
      name: s.name,
      reason: "fail-fast",
    })),
    passed,
    failed,
    skipped: skipped.length,
    total: results.length + skipped.length,
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
  // Atomic rename (POSIX guarantee; best-effort on Windows)
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
          schemaVersion: 2,
          profile: profileName,
          checks: checks.map((c) => ({
            id: c.id,
            name: c.name,
            command: c.cmd,
            phase: c.phase,
            slow: c.slow,
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
    console.error(`\n⚠️  Interrupted by ${sig}`);
    process.exit(128 + (sig === "SIGINT" ? 2 : sig === "SIGTERM" ? 15 : 1));
  }
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  const mode = profileName.toUpperCase();
  console.log(`\n🚀 Starting ${mode} release gate (${checks.length} checks)`);
  console.log(
    `   Mode: ${flags.continueOnFail ? "continue on failure" : "fail-fast (default)"}\n`,
  );

  const startedAt = new Date();
  const results = [];
  const skipped = [];

  const prereqChecks = checks.filter((c) => c.phase === "prereq");
  const independentChecks = checks.filter((c) => c.phase !== "prereq");

  // ── Prerequisites (sequential, fail-fast aware) ─────────────
  for (const check of prereqChecks) {
    console.log(`  ▶ ${check.name}`);
    const result = runCommand(check);
    results.push(result);
    if (result.status === "passed") {
      console.log(`    ✅ (${result.elapsedMs}ms)`);
    } else {
      console.error(
        `    ❌ failed (${result.elapsedMs}ms, exit ${result.exitCode}${result.signal ? `, signal ${result.signal}` : ""})`,
      );
      if (!flags.continueOnFail) {
        for (const rest of [
          ...prereqChecks.slice(results.length),
          ...independentChecks,
        ]) {
          skipped.push({ id: rest.id, name: rest.name });
        }
        break;
      }
    }
  }

  // ── Independent checks (parallel in --continue mode, sequential otherwise) ──
  const prereqFailed = results.some((r) => r.status !== "passed");
  if (independentChecks.length > 0 && !prereqFailed) {
    const runParallel = flags.continueOnFail;
    if (runParallel) {
      console.log("");
      const parallelResults = await runCommandsParallel(independentChecks);
      for (const result of parallelResults) {
        results.push(result);
        const msg =
          result.status === "passed"
            ? `    ✅ (${result.elapsedMs}ms)`
            : `    ❌ failed (${result.elapsedMs}ms, exit ${result.exitCode}${result.signal ? `, signal ${result.signal}` : ""})`;
        console.log(`  ▶ ${result.name}\n${msg}`);
      }
    } else {
      for (let i = 0; i < independentChecks.length; i++) {
        const check = independentChecks[i];
        console.log(`  ▶ ${check.name}`);
        const result = runCommand(check);
        results.push(result);
        if (result.status === "passed") {
          console.log(`    ✅ (${result.elapsedMs}ms)`);
        } else {
          console.error(
            `    ❌ failed (${result.elapsedMs}ms, exit ${result.exitCode}${result.signal ? `, signal ${result.signal}` : ""})`,
          );
          for (const rest of independentChecks.slice(i + 1)) {
            skipped.push({ id: rest.id, name: rest.name });
          }
          break;
        }
      }
    }
  }

  const report = buildReport(profileName, results, startedAt, skipped);

  // Human summary
  const totalPassed = report.passed;
  const totalFailed = report.failed;
  const totalSkipped = skipped.length;
  const totalCheck = report.total;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 ${mode} gate complete in ${report.elapsedMs}ms`);
  console.log(`   ✅ Passed: ${totalPassed}`);
  if (totalFailed > 0) console.log(`   ❌ Failed: ${totalFailed}`);
  if (totalSkipped > 0) console.log(`   ⏭  Skipped: ${totalSkipped}`);
  console.log(`   Total: ${totalCheck}`);
  if (report.slowest.length > 0) {
    console.log(`   Slowest:`);
    for (const s of report.slowest)
      console.log(`     ${s.name} (${s.elapsedMs}ms)`);
  }

  if (totalFailed > 0 && report.checks.find((c) => c.status !== "passed")) {
    console.error(`\nFailed checks:`);
    for (const c of report.checks) {
      if (c.status !== "passed") console.error(`   [${c.id}] ${c.name}`);
    }
  }

  // Machine output
  if (jsonOutputPath) {
    const resolvedPath = resolve(jsonOutputPath);
    writeJsonAtomic(resolvedPath, report);
    console.log(`\n📄 JSON report written to ${resolvedPath}`);
  }

  // Also always emit JSON to stdout as second line (last line) for tooling
  console.log("\n" + JSON.stringify(report));

  process.exit(totalFailed > 0 ? 1 : 0);
}

// Guard: only run main when this is the entry point (not when imported for testing)
const thisFile = fileURLToPath(import.meta.url);
const isEntry =
  process.argv[1] &&
  (process.argv[1] === thisFile ||
    process.argv[1].endsWith("/scripts/verify-release.mjs"));
if (isEntry) {
  main();
}
