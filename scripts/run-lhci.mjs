#!/usr/bin/env node
/**
 * Local Lighthouse CI runner with browser discovery.
 *
 * `lhci autorun` relies on chrome-launcher autodiscovery, which only
 * searches system Chrome installs — never Playwright's bundled browsers.
 * On machines without a system Chrome (e.g. this project's Linux dev
 * workstation), that fails the healthcheck even though a perfectly good
 * Chromium is already installed for Playwright.
 *
 * Resolution precedence (first usable wins):
 *   1. explicit CHROME_PATH (CI stable Chrome, developer overrides)
 *   2. installed project Playwright Chromium (chromium.executablePath)
 *   3. fall through to plain `lhci autorun` (system autodiscovery)
 *
 * Never auto-installs browsers. Propagates LHCI's exit code.
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

/**
 * Pure browser-path resolution (unit-tested separately).
 *
 * @param {object} opts
 * @param {string|undefined} opts.explicitPath - pre-trimmed CHROME_PATH or undefined
 * @param {string|undefined} opts.playwrightPath - chromium.executablePath() or undefined on error
 * @param {(p: string) => boolean} opts.exists - existence check (fs.existsSync in production)
 * @returns {{ chromePath: string|undefined, reason: string }}
 */
export function resolveChromePath({ explicitPath, playwrightPath, exists }) {
  if (explicitPath) {
    return { chromePath: explicitPath, reason: "explicit CHROME_PATH" };
  }
  if (playwrightPath && exists(playwrightPath)) {
    return {
      chromePath: playwrightPath,
      reason: "project Playwright Chromium",
    };
  }
  return { chromePath: undefined, reason: "none (LHCI autodiscovery)" };
}

function playwrightChromiumPath() {
  try {
    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright");
    const candidate = chromium.executablePath();
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  } catch {
    // playwright unavailable or no bundled revision known
  }
  return undefined;
}

function main() {
  const explicit = (process.env.CHROME_PATH || "").trim() || undefined;
  const { chromePath, reason } = resolveChromePath({
    explicitPath: explicit,
    playwrightPath: playwrightChromiumPath(),
    exists: (p) => {
      try {
        return existsSync(p);
      } catch {
        return false;
      }
    },
  });

  const env = { ...process.env };
  if (chromePath) {
    env.CHROME_PATH = chromePath;
    console.log(`run-lhci: using Chrome from ${reason}: ${chromePath}`);
  } else {
    console.log(
      "run-lhci: no explicit CHROME_PATH and no installed Playwright Chromium found.",
    );
    console.log(
      "run-lhci: falling through to LHCI autodiscovery; set CHROME_PATH explicitly or run: npx playwright install chromium",
    );
  }

  const result = spawnSync(
    "npx",
    ["lhci", "autorun", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env,
    },
  );
  process.exit(result.status ?? 1);
}

// Only run when executed directly; unit tests import resolveChromePath.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
