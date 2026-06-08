#!/usr/bin/env node
/**
 * Check that npm dependencies are correctly classified.
 *
 * This is a static Astro site - runtime dependencies should be empty.
 * All build/test/tooling packages must be in devDependencies.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { globSync } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const deps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});

// Allowed runtime dependencies - Phaser 3 for web-native browser games
const ALLOWED_RUNTIME_DEPS = ["phaser"];

// Allowed dev dependencies - explicit allowlist for maintainability
const ALLOWED_DEV_DEPS = [
  "@astrojs/check",
  "@axe-core/playwright",
  "@lhci/cli",
  "@playwright/test",
  "astro",
  "jsdom",
  "playwright",
  "prettier",
  "prettier-plugin-astro",
  "typescript",
  "vitest",
  "lighthouse",
  "playwright-core",
  "puppeteer-core",
  "chai",
  "enquirer",
  "inquirer",
  "tar",
  "sharp",
  "glob",
  "yaml-language-server",
  "vscode-css-languageservice",
  "vscode-html-languageservice",
  "vscode-json-languageservice",
  "vscode-languageserver",
  "vscode-languageserver-protocol",
  "vscode-languageserver-textdocument",
  "vscode-languageserver-types",
  "vscode-jsonrpc",
  "vscode-nls",
  "vscode-uri",
  "volar-service-css",
  "volar-service-emmet",
  "volar-service-html",
  "volar-service-prettier",
  "volar-service-typescript",
  "volar-service-typescript-twoslash-queries",
  "volar-service-yaml",
  "sass-formatter",
  "emmet",
  "jsonc-parser",
  "request-light",
  "typescript-auto-import-cache",
  "muggle-string",
  "typesafe-path",
  "obug",
  "fontace",
  "fontkitten",
  "s.color",
  "suf-log",
  "piccolore",
  "tinyclip",
  "fast-string-truncated-width",
  "fast-string-width",
  "fast-wrap-ansi",
  "smol-toml",
];

// Node.js built-in modules (always available, no need to declare)
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

let failures = 0;

// 1. Check runtime dependencies are allowed (should be empty)
const invalidRuntimeDeps = deps.filter(
  (name) => !ALLOWED_RUNTIME_DEPS.includes(name),
);
if (invalidRuntimeDeps.length > 0) {
  console.error(
    `❌ Runtime dependencies not in allowlist (should be empty for static site):`,
  );
  for (const name of invalidRuntimeDeps) {
    console.error(`   - ${name}`);
  }
  console.error(`\n   Move to devDependencies or remove.`);
  failures += invalidRuntimeDeps.length;
}

// 2. Check dev dependencies are in allowlist
const unlistedDevDeps = devDeps.filter(
  (name) => !ALLOWED_DEV_DEPS.includes(name),
);
if (unlistedDevDeps.length > 0) {
  console.error(
    `⚠️  Dev dependencies not in allowlist (add to ALLOWED_DEV_DEPS if intentional):`,
  );
  for (const name of unlistedDevDeps) {
    console.error(`   - ${name}`);
  }
  console.error(
    `\n   Add to ALLOWED_DEV_DEPS in scripts/check-dependency-hygiene.mjs if intentional.`,
  );
  failures += unlistedDevDeps.length;
}

// 3. Check no package in both deps and devDeps
const inBoth = deps.filter((name) => devDeps.includes(name));
if (inBoth.length > 0) {
  console.error(`❌ Packages listed in both dependencies and devDependencies:`);
  for (const name of inBoth) {
    console.error(`   - ${name}`);
  }
  failures += inBoth.length;
}

// 4. Check astro is present
if (!deps.includes("astro") && !devDeps.includes("astro")) {
  console.error(`❌ astro not found in dependencies or devDependencies`);
  failures++;
}

// 5. Check sharp is accounted for (build-time image optimization)
if (!deps.includes("sharp") && !devDeps.includes("sharp")) {
  console.error(
    `⚠️  sharp not found (used for build-time image optimization and screenshot capture)`,
  );
  // Not a failure, just a warning
}

// 6. Check that scripts don't import undeclared packages
const scriptFiles = globSync("**/*.{mjs,js,ts,astro}", {
  cwd: root,
  ignore: [
    "node_modules/**",
    "dist/**",
    ".astro/**",
    "**/*.snap.ts",
    "**/*.spec.ts",
    "**/*.test.ts",
  ],
});

const allDeclaredDeps = new Set([...deps, ...devDeps]);
const importErrors = [];

// Skip regex character class patterns like [^...]
const isRegexCharClass = (str) => str.startsWith("\[") || str.startsWith("\[^");

for (const file of scriptFiles) {
  const content = readFileSync(resolve(root, file), "utf-8");
  // Find import statements - improved regex to avoid regex syntax issues
  const importMatches = content.matchAll(
    /import\s+(?:.*?\s+from\s+)?['"]([^'"\s]+)['"]/g,
  );
  for (const match of importMatches) {
    const imported = match[1];
    // Skip relative imports, Node built-ins, and protocol imports
    if (
      imported.startsWith(".") ||
      imported.startsWith("/") ||
      imported.startsWith("node:") ||
      imported.startsWith("https:") ||
      imported.startsWith("http:") ||
      imported.startsWith("astro:")
    ) {
      continue;
    }
    // Check if it's a Node built-in module
    const pkgName = imported.split("/")[0];
    if (NODE_BUILTINS.has(pkgName)) {
      continue;
    }
    // Check if it's a declared dependency
    if (!allDeclaredDeps.has(pkgName) && !pkgName.startsWith("@")) {
      // Check for scoped packages
      const scopedMatch = imported.match(/^(@[^/]+\/[^/]+)/);
      if (scopedMatch) {
        if (!allDeclaredDeps.has(scopedMatch[1])) {
          importErrors.push(
            `${file}: imports undeclared package "${scopedMatch[1]}"`,
          );
        }
      } else if (!allDeclaredDeps.has(pkgName)) {
        if (isRegexCharClass(pkgName)) continue;
        importErrors.push(`${file}: imports undeclared package "${pkgName}"`);
      }
    }
  }
}

if (importErrors.length > 0) {
  console.error(`❌ Scripts import undeclared packages:`);
  for (const err of importErrors) {
    console.error(`   - ${err}`);
  }
  failures += importErrors.length;
}

if (failures > 0) {
  console.error(`\n❌ Dependency hygiene check found ${failures} issue(s).`);
  console.error(`\nRemediation:`);
  console.error(
    `  - Move accidental runtime deps to devDependencies: npm install --save-dev <pkg>`,
  );
  console.error(`  - Remove unused packages: npm uninstall <pkg>`);
  console.error(
    `  - Add new dev deps to ALLOWED_DEV_DEPS in scripts/check-dependency-hygiene.mjs`,
  );
  console.error(`  - Run: npm install && npm run format`);
  process.exit(1);
} else {
  console.log("✅ Dependency hygiene check passed.");
  console.log(`   Runtime deps: ${deps.length} (expected 0)`);
  console.log(`   Dev deps: ${devDeps.length}`);
}
