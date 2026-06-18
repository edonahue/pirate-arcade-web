#!/usr/bin/env node
/**
 * Release gate verification script.
 * Runs curated validation profiles in order.
 *
 * Usage:
 *   node scripts/verify-release.mjs                   # full gate (default)
 *   node scripts/verify-release.mjs --fast            # fast gate
 *   node scripts/verify-release.mjs --list            # print plan and exit
 *   node scripts/verify-release.mjs --continue        # continue after failures
 *   node scripts/verify-release.mjs --profile=post-build  # post-build checks only
 *
 * Profiles:
 *   fast          — complete local fast gate (includes build prereq)
 *   full          — complete local full gate (includes all fast checks)
 *   post-build    — deterministic checks that need dist/ (no format/typecheck/build)
 *   prerequisites — format, typecheck, build only
 */

import { execSync } from "child_process";

const FAST_GATE = [
  { name: "Format check", cmd: "npm run format:check" },
  { name: "Typecheck", cmd: "npm run typecheck" },
  { name: "Build", cmd: "npm run build" },
  { name: "SEO audit", cmd: "npm run seo:audit" },
  { name: "Copy tone", cmd: "npm run test:copy-tone" },
  { name: "CSS tokens", cmd: "npm run test:css-tokens" },
  { name: "Visual contrast", cmd: "npm run test:visual-contrast" },
  { name: "Dependency hygiene", cmd: "npm run check:dependency-hygiene" },
  { name: "Cloudflare headers", cmd: "npm run test:check-headers" },
  { name: "Browser game shells", cmd: "npm run test:browser-game-shells" },
  { name: "Game shell integrity", cmd: "npm run test:game-shell-integrity" },
  { name: "Service worker", cmd: "npm run test:service-worker" },
  { name: "Cache versioning", cmd: "npm run test:cache-versioning" },
  { name: "Pygbag boot contract", cmd: "npm run test:pygbag-boot-contract" },
  { name: "Pygbag shell drift", cmd: "npm run test:pygbag-shell-drift" },
  { name: "Game versions", cmd: "npm run test:game-versions" },
  { name: "HTML structure", cmd: "npm run test:html-structure" },
  { name: "Archive parity", cmd: "npm run test:archive-parity" },
  { name: "Audit game archives", cmd: "npm run audit:game-archives" },
  { name: "Site links", cmd: "npm run test:site-links" },
  { name: "Public domain art", cmd: "npm run test:public-domain-art" },
  { name: "Game theming source", cmd: "npm run test:game-theming-source" },
  { name: "Game registry", cmd: "npm run test:game-registry" },
  { name: "Repository docs", cmd: "npm run test:docs" },
  { name: "Race ship assets", cmd: "npm run test:race-ship-assets" },
  { name: "Screenshot assets", cmd: "npm run test:screenshot-assets" },
  { name: "Performance budgets", cmd: "npm run test:performance-budgets" },
];

const POST_BUILD_CHECKS = FAST_GATE.filter(
  (c) => !["Format check", "Typecheck", "Build"].includes(c.name),
);

const PREREQUISITES = [
  { name: "Format check", cmd: "npm run format:check" },
  { name: "Typecheck", cmd: "npm run typecheck" },
  { name: "Build", cmd: "npm run build" },
];

const FULL_GATE = [
  ...FAST_GATE,
  { name: "Site theme", cmd: "npm run test:site-theme" },
  { name: "Site game content", cmd: "npm run test:site-game-content" },
  { name: "Accessibility", cmd: "npm run test:a11y" },
  { name: "Mobile layout", cmd: "npm run test:mobile-layout" },
  { name: "Mobile pause", cmd: "npm run test:mobile-pause" },
  { name: "Mobile input", cmd: "npm run test:mobile-input" },
  { name: "Mobile navigation", cmd: "npm run test:mobile-navigation" },
  { name: "Mobile regression", cmd: "npm run test:mobile-regression" },
  { name: "iPad layout", cmd: "npm run test:ipad-layout" },
  { name: "iPad controls", cmd: "npm run test:ipad-controls" },
  {
    name: "Browser games (chromium)",
    cmd: "npm run test:browser-games:chromium",
  },
  {
    name: "Web-native games (chromium)",
    cmd: "npm run test:web-native-games:chromium",
  },
  { name: "Game theming (visual)", cmd: "npm run test:game-theming" },
  { name: "Game prewarm", cmd: "npm run test:game-prewarm" },
  { name: "Captain's Log", cmd: "npm run test:captains-log" },
  { name: "Lighthouse CI", cmd: "npm run test:lhci", slow: true },
];

const PROFILES = {
  fast: FAST_GATE,
  full: FULL_GATE,
  "post-build": POST_BUILD_CHECKS,
  prerequisites: PREREQUISITES,
};

function runCommand(name, cmd, continueOnFail) {
  const start = Date.now();
  try {
    execSync(cmd, { stdio: "inherit", encoding: "utf-8", shell: "/bin/bash" });
    const elapsedMs = Date.now() - start;
    return { name, command: cmd, status: "passed", elapsedMs, exitCode: 0 };
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const exitCode = err.status || 1;
    return { name, command: cmd, status: "failed", elapsedMs, exitCode };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const continueOnFail = args.includes("--continue");
  const listOnly = args.includes("--list");

  // Determine profile
  let profileName = "fast";
  const profileArg = args.find((a) => a.startsWith("--profile="));
  if (args.includes("--full")) {
    profileName = "full";
  } else if (profileArg) {
    profileName = profileArg.split("=")[1];
  }

  const gate = PROFILES[profileName];
  if (!gate) {
    console.error(
      `Unknown profile "${profileName}". Valid: ${Object.keys(PROFILES).join(", ")}`,
    );
    process.exit(1);
  }

  if (listOnly) {
    console.log(
      JSON.stringify(
        {
          schemaVersion: 1,
          profile: profileName,
          checks: gate.map((c) => ({
            name: c.name,
            command: c.cmd,
            slow: !!c.slow,
          })),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const mode = profileName.toUpperCase();
  console.log(`\n🚀 Starting ${mode} release gate...`);
  console.log(`   ${gate.length} checks\n`);

  const results = [];
  const startAll = Date.now();

  for (const check of gate) {
    const result = runCommand(check.name, check.cmd, continueOnFail);
    results.push(result);
  }

  const totalElapsedMs = Date.now() - startAll;
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status !== "passed").length;

  // Slowest check summary
  const sorted = [...results].sort((a, b) => b.elapsedMs - a.elapsedMs);
  const slowestLine =
    sorted.length > 0
      ? `   Slowest: ${sorted[0].name} (${sorted[0].elapsedMs}ms)`
      : "";

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 ${mode} gate complete in ${totalElapsedMs}ms`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  if (slowestLine) console.log(slowestLine);

  // Machine-readable JSON output to stderr (doesn't mix with user output)
  const report = {
    schemaVersion: 1,
    profile: profileName,
    startedAt: new Date(startAll).toISOString(),
    elapsedMs: totalElapsedMs,
    checks: results.map((r) => ({
      name: r.name,
      command: r.command,
      status: r.status,
      elapsedMs: r.elapsedMs,
      exitCode: r.exitCode,
    })),
    passed,
    failed,
    total: results.length,
  };
  console.log("\n" + JSON.stringify(report));

  if (failed > 0) {
    console.error(`\nFailed checks:`);
    for (const r of results.filter((r) => r.status !== "passed")) {
      console.error(`   - ${r.name}`);
    }
    process.exit(1);
  } else {
    console.log(`\n🎉 All checks passed!`);
    process.exit(0);
  }
}

main();
