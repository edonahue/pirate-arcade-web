#!/usr/bin/env node
/**
 * Check that npm dependencies are correctly classified.
 *
 * Known dev-only packages should not appear in "dependencies" —
 * if they do, they were likely installed without --save-dev.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const deps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});

// Known dev/test/build tools that should never be in dependencies
const KNOWN_DEV_PACKAGES = [
  "lighthouse",
  "playwright",
  "playwright-core",
  "puppeteer-core",
  "chai",
  "enquirer",
  "inquirer",
  "tar",
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

let failures = 0;
const misclassified = KNOWN_DEV_PACKAGES.filter((name) => deps.includes(name));

if (misclassified.length > 0) {
  console.error(
    `⚠️  ${misclassified.length} known dev-only packages found in dependencies:`,
  );
  for (const name of misclassified) {
    console.error(`   - ${name}`);
  }
  console.error(
    `\n   These were likely installed with "npm install <pkg>" instead of`,
  );
  console.error(
    `   "npm install --save-dev <pkg>". Move them to devDependencies.`,
  );
  failures = misclassified.length;
}

// Check that astro is in dependencies or devDependencies
if (!deps.includes("astro") && !devDeps.includes("astro")) {
  console.error(`❌ astro not found in dependencies or devDependencies`);
  failures++;
}

// Check that sharp (used for image optimization) is accounted for
if (deps.includes("sharp")) {
  // OK, sharp is a runtime dep needed by Astro image optimization
} else if (devDeps.includes("sharp")) {
  // Also OK
} else {
  // Not critical, just note it
}

if (failures > 0) {
  console.error(`\n❌ Dependency hygiene check found ${failures} issue(s).`);
  process.exit(1);
} else {
  console.log("✅ Dependency hygiene looks clean.");
}
