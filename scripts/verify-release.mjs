#!/usr/bin/env node
/**
 * Release gate verification script.
 * Runs a curated subset of validation commands in order.
 *
 * Usage:
 *   node scripts/verify-release.mjs              # full gate (default)
 *   node scripts/verify-release.mjs --fast       # fast gate only
 *   node scripts/verify-release.mjs --continue   # continue after failures
 */

import { execSync } from "child_process";

const FAST_GATE = [
  { name: "Format check", cmd: "npm run format:check" },
  { name: "Typecheck", cmd: "npm run typecheck" },
  { name: "Build", cmd: "npm run build" },
  { name: "SEO audit", cmd: "npm run seo:audit" },
  { name: "CSS tokens", cmd: "npm run test:css-tokens" },
  { name: "Dependency hygiene", cmd: "npm run check:dependency-hygiene" },
  {
    name: "Browser game consistency",
    cmd: "npm run test:browser-game-consistency",
  },
  { name: "Browser game shells", cmd: "npm run test:browser-game-shells" },
  { name: "Service worker", cmd: "npm run test:service-worker" },
  { name: "Cache versioning", cmd: "npm run test:cache-versioning" },
  { name: "Game versions", cmd: "npm run test:game-versions" },
  { name: "Archive parity", cmd: "npm run test:archive-parity" },
  { name: "Audit game archives", cmd: "npm run audit:game-archives" },
  { name: "Public domain art", cmd: "npm run test:public-domain-art" },
  { name: "Game theming source", cmd: "npm run test:game-theming-source" },
];

const FULL_GATE = [
  ...FAST_GATE,
  { name: "Site theme", cmd: "npm run test:site-theme" },
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
  { name: "Game theming (visual)", cmd: "npm run test:game-theming" },
  { name: "Captain's Log", cmd: "npm run test:captains-log" },
];

function runCommand(name, cmd, continueOnFail) {
  const start = Date.now();
  try {
    execSync(cmd, { stdio: "inherit", encoding: "utf-8", shell: "/bin/bash" });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ ${name} passed (${elapsed}s)`);
    return { name, passed: true, elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n❌ ${name} failed (${elapsed}s)`);
    if (!continueOnFail) {
      process.exit(1);
    }
    return { name, passed: false, elapsed };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fastOnly = args.includes("--fast");
  const continueOnFail = args.includes("--continue");
  const gate = fastOnly ? FAST_GATE : FULL_GATE;
  const mode = fastOnly ? "FAST" : "FULL";

  console.log(`\n🚀 Starting ${mode} release gate...`);
  console.log(`   ${gate.length} checks\n`);

  const results = [];
  const startAll = Date.now();

  for (const check of gate) {
    const result = runCommand(check.name, check.cmd, continueOnFail);
    results.push(result);
  }

  const totalElapsed = ((Date.now() - startAll) / 1000).toFixed(1);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 ${mode} gate complete in ${totalElapsed}s`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log(`\nFailed checks:`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`   - ${r.name}`);
    }
    process.exit(1);
  } else {
    console.log(`\n🎉 All checks passed!`);
    process.exit(0);
  }
}

main();
