#!/usr/bin/env node
/**
 * Check that npm dependencies are correctly classified and that all
 * imported packages are declared in package.json.
 *
 * Uses evidence from source imports, test imports, config files,
 * package-script executables, and package bin metadata.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { globSync } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const runtimeDeps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});
const allDeclared = new Set([...runtimeDeps, ...devDeps]);

// Node.js built-in modules (always available, never need to be declared)
const NODE_BUILTINS = new Set([
  "fs",
  "path",
  "url",
  "zlib",
  "child_process",
  "stream",
  "crypto",
  "http",
  "https",
  "util",
  "os",
  "querystring",
  "buffer",
  "events",
  "net",
  "tls",
  "dns",
  "assert",
  "console",
  "process",
  "module",
  "perf_hooks",
  "inspector",
  "vm",
  "worker_threads",
  "cluster",
  "readline",
  "repl",
  "tty",
  "domain",
  "constants",
  "punycode",
  "string_decoder",
  "sys",
  "timers",
  "async_hooks",
  "trace_events",
  "v8",
  "wasi",
  "sea",
  "test",
  "diagnostics_channel",
  "sqlite3",
]);

// Packages that cannot be detected via source imports or CLI use but are
// intentionally declared because tooling requires them at a compatible
// version (peer dep requirement, config plugin, etc.)
const JUSTIFIED_DIRECT_DEV_DEPS = {
  "@astrojs/check":
    "Provides astro check / typecheck command (peer: typescript)",
  "@playwright/test": "Test runner for browser tests (peer: playwright-core)",
  astro: "Site framework (build, dev, preview)",
  glob: "File globbing in scripts/check-*.mjs validators",
  jsdom: "HTML structure validator (check-built-html-structure.mjs)",
  playwright:
    "Used directly by scripts/test-game.mjs, test-browser-prototype.mjs, capture-browser-game-screenshots.mjs",
  prettier: "Code formatter",
  "prettier-plugin-astro": "Astro file formatting",
  sharp: "Screenshot image processing (capture-browser-game-screenshots.mjs)",
  tar: "Archive packing/extraction (patch-browser-game-archives.mjs)",
  typescript: "Language compiler and typechecker",
  vitest: "Unit test runner",
};

let failures = 0;

// ── 1. Check packages in both deps and devDeps ───────────────
const inBoth = runtimeDeps.filter((name) => devDeps.includes(name));
if (inBoth.length > 0) {
  console.error(`❌ Packages listed in both dependencies and devDependencies:`);
  for (const name of inBoth) console.error(`   - ${name}`);
  failures += inBoth.length;
}

// ── 2. Collect evidence of actual usage ──────────────────────
// Read all source files (scripts, src, tests, config files)
const scriptFiles = globSync("**/*.{mjs,js,ts,tsx,astro,cjs}", {
  cwd: root,
  ignore: ["node_modules/**", "dist/**", ".astro/**", "**/*.snap.ts"],
});

const usedPackages = new Set();

for (const file of scriptFiles) {
  const content = readFileSync(resolve(root, file), "utf-8");
  const importMatches = content.matchAll(
    /import\s+(?:.*?\s+from\s+)?['"]([^'"\s]+)['"]/g,
  );
  for (const match of importMatches) {
    const imported = match[1];
    if (
      imported.startsWith(".") ||
      imported.startsWith("/") ||
      imported.startsWith("node:") ||
      imported.startsWith("https:") ||
      imported.startsWith("http:") ||
      imported.startsWith("astro:")
    )
      continue;
    const pkgName = imported.startsWith("@")
      ? imported.split("/").slice(0, 2).join("/")
      : imported.split("/")[0];
    if (["vitest", "vi"].includes(pkgName)) continue;
    if (!/^[a-zA-Z@]/.test(pkgName)) continue;
    if (NODE_BUILTINS.has(pkgName)) continue;
    usedPackages.add(pkgName);
  }
}

// ── 3. Check package-script executables (CLI commands) ───────
const seenCLI = new Set();
for (const [, cmd] of Object.entries(pkg.scripts)) {
  const cmdStr = String(cmd);
  const bins = cmdStr.match(/(?<![-\w])(\S+)\s/g);
  if (bins) {
    for (const bin of bins) {
      const name = bin.trim();
      if (name === "node" || name === "npm" || name === "npx" || name === "tsx")
        continue;
      if (name.includes("/") || name.includes(".")) continue;
      if (name.length > 2) seenCLI.add(name);
    }
  }
}

for (const pkgName of allDeclared) {
  if (usedPackages.has(pkgName)) continue;
  // Check if any script uses this package's bin
  const binPath = resolve(root, "node_modules", pkgName, "package.json");
  if (existsSync(binPath)) {
    const meta = JSON.parse(readFileSync(binPath, "utf-8"));
    if (meta.bin) {
      const binNames =
        typeof meta.bin === "string"
          ? [pkgName.replace(/^@[^/]+\//, "")]
          : Object.keys(meta.bin);
      for (const bin of binNames) {
        if (seenCLI.has(bin)) {
          usedPackages.add(pkgName);
          break;
        }
      }
    }
  }
}

// ── 4. Check config file references ──────────────────────────
const configFiles = [
  "playwright.config.ts",
  "lighthouserc.cjs",
  "astro.config.mjs",
  "vitest.config.ts",
];
for (const cfg of configFiles) {
  const cfgPath = resolve(root, cfg);
  if (!existsSync(cfgPath)) continue;
  const content = readFileSync(cfgPath, "utf-8");
  for (const pkgName of allDeclared) {
    const importPattern = new RegExp(
      `['"]${pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`,
    );
    if (importPattern.test(content)) usedPackages.add(pkgName);
  }
}

// ── 5. Verify declared packages are used ─────────────────────
let unusedFound = false;
for (const name of allDeclared) {
  if (name === "phaser") continue; // intentional runtime dep
  if (JUSTIFIED_DIRECT_DEV_DEPS[name]) continue;
  if (usedPackages.has(name)) continue;

  console.warn(
    `⚠️  "${name}" is declared but no direct import or CLI use found.`,
  );
  unusedFound = true;
}

if (unusedFound) {
  console.error(
    "\n❌ One or more declared dependencies have no evidence of direct use.",
  );
  console.error(
    "   Remove them or add to JUSTIFIED_DIRECT_DEV_DEPS with a reason.",
  );
  failures++;
}

// ── 6. Verify packages used directly are declared ────────────
const undeclaredUsed = [];
for (const name of usedPackages) {
  if (name === "vi" || name === "vitest") continue;
  if (!allDeclared.has(name)) {
    undeclaredUsed.push(name);
  }
}
if (undeclaredUsed.length > 0) {
  console.error(`❌ Packages used directly but not declared in package.json:`);
  for (const name of undeclaredUsed) {
    console.error(`   - ${name}`);
  }
  failures += undeclaredUsed.length;
}

// ── 7. Verify runtime deps are minimal ───────────────────────
if (runtimeDeps.length > 1) {
  console.error(
    `❌ Expected 1 runtime dep (phaser), found ${runtimeDeps.length}:`,
  );
  for (const name of runtimeDeps) console.error(`   - ${name}`);
  failures += runtimeDeps.length - 1;
}

// ── Summary ──────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n❌ Dependency hygiene check found ${failures} issue(s).`);
  process.exit(1);
} else {
  console.log("✅ Dependency hygiene check passed.");
  console.log(`   Runtime dep: ${runtimeDeps.length} (phaser)`);
  console.log(`   Dev deps: ${devDeps.length}`);
  console.log("   All declared packages have evidence of direct use.");
}
