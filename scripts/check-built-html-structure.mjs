#!/usr/bin/env node

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

const CONTENT_TAGS = new Set([
  "section",
  "div",
  "article",
  "aside",
  "header",
  "nav",
  "main",
]);

// Known non-BaseLayout paths that are valid (game shells, etc.)
const KNOWN_NON_BASELAYOUT = new Set([
  "/play/cannonball-clash/",
  "/play/treasure-cove/",
  "/play/krakens-wake/",
  "/play/race-to-treasure-island/",
]);

// Game shells from `public/play/` (static HTML, Pygbag)
const PYBAG_GAME_IDS = new Set([
  "cannonball-clash",
  "treasure-cove",
  "krakens-wake",
]);
// Game shells from Astro pages (Phaser, GamePlayLayout)
const ASTRO_GAME_IDS = new Set(["race-to-treasure-island"]);

const DIST = join(import.meta.dirname, "..", "dist");

function collectHtmlFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

function getPagePath(filePath) {
  const rel = filePath.replace(DIST + "/", "");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html"))
    return "/" + rel.slice(0, -"index.html".length);
  return "/" + rel;
}

function checkRawMarkup(filePath, pagePath) {
  const html = readFileSync(filePath, "utf-8");
  const errors = [];

  // DOCTYPE
  if (!/^<!DOCTYPE\s+html>/i.test(html)) {
    errors.push("missing or invalid DOCTYPE html declaration");
  }

  // <html lang>
  const htmlTag = html.match(/<html[^>]*>/i);
  if (htmlTag) {
    if (!/lang\s*=\s*["']/.test(htmlTag[0])) {
      errors.push("<html> tag missing lang attribute");
    }
  } else {
    errors.push("missing <html> tag");
  }

  // <title>
  if (!/<title>/.test(html)) {
    errors.push("missing <title> tag");
  }

  // <meta charset>
  if (!/meta[^>]*charset\s*=/i.test(html)) {
    errors.push("missing <meta charset> declaration");
  }

  // <meta name="viewport">
  if (!/meta[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
    errors.push('missing <meta name="viewport"> tag');
  }

  return errors;
}

function checkPage(filePath) {
  const pagePath = getPagePath(filePath);
  const raw = readFileSync(filePath, "utf-8");
  const dom = new JSDOM(raw);
  const doc = dom.window.document;

  const errors = [];

  // Raw markup checks for ALL pages
  const markupErrors = checkRawMarkup(filePath, pagePath);
  errors.push(...markupErrors);

  const main = doc.querySelector("main#main-content");
  const footer = doc.querySelector("footer");

  // Non-BaseLayout pages (game shells, etc.)
  if (!main) {
    const isKnown = KNOWN_NON_BASELAYOUT.has(pagePath);
    if (isKnown) {
      // Game shell structural checks
      const shellErrors = checkGameShell(doc, raw, pagePath);
      errors.push(...shellErrors);
    } else {
      errors.push(
        `not a BaseLayout page and not in known non-BaseLayout allowlist (${pagePath})`,
      );
    }
    return { pagePath, errors, isGameShell: isKnown };
  }

  // BaseLayout pages
  if (!footer) {
    errors.push("footer element missing");
  }

  if (main && footer) {
    const position = main.compareDocumentPosition(footer);
    if (!(position & dom.window.Node.DOCUMENT_POSITION_FOLLOWING)) {
      errors.push("footer does not follow main#main-content in document order");
    }

    let sibling = main.nextElementSibling;
    while (sibling && sibling !== footer) {
      const tag = sibling.tagName.toLowerCase();
      if (CONTENT_TAGS.has(tag)) {
        errors.push(`<${tag}> found between </main> and <footer>`);
      }
      sibling = sibling.nextElementSibling;
    }
  }

  if (main.children.length === 0) {
    errors.push("main#main-content has no child elements");
  }

  return { pagePath, errors };
}

function checkGameShell(doc, raw, pagePath) {
  const errors = [];
  const isPygbag = PYBAG_GAME_IDS.has(
    pagePath.replace(/^\/play\/([^/]+)\/.*/, "$1"),
  );

  // All game shells need game-loading overlay
  if (!doc.querySelector("#game-loading")) {
    errors.push("missing #game-loading overlay element");
  }

  if (isPygbag) {
    // Pygbag games: use canvas#canvas for the game render target
    if (!doc.querySelector("canvas#canvas")) {
      errors.push("Pygbag game shell missing canvas#canvas");
    }
    // Pygbag games: must have CDN version pin comment
    if (!raw.includes("CDN VERSION PIN")) {
      errors.push("Pygbag game shell missing CDN VERSION PIN comment");
    }
  } else {
    // Phaser / other engine games: must have a game container
    if (!doc.querySelector("#game-container, canvas#canvas")) {
      errors.push("game shell missing #game-container or canvas#canvas");
    }
  }

  return errors;
}

const files = collectHtmlFiles(DIST);
console.log(`Checking ${files.length} HTML files for structural integrity...`);

let baseLayoutCount = 0;
let gameShellCount = 0;
let unknownSkipCount = 0;
let allPassed = true;

for (const file of files) {
  const result = checkPage(file);
  if (result.isGameShell) {
    gameShellCount++;
  } else if (
    result.errors.length > 0 &&
    result.errors.some((e) => e.includes("not a BaseLayout page"))
  ) {
    unknownSkipCount++;
  } else {
    baseLayoutCount++;
  }
  if (result.errors.length > 0) {
    allPassed = false;
    console.log(`\n❌ ${result.pagePath}`);
    for (const err of result.errors) {
      console.log(`    ${err}`);
    }
  }
}

console.log(
  `\nBaseLayout pages: ${baseLayoutCount}, game shells: ${gameShellCount}${unknownSkipCount > 0 ? `, unknown (not allowed): ${unknownSkipCount}` : ""}`,
);
if (allPassed) {
  console.log("✅ All pages pass structural and markup integrity checks.");
  process.exit(0);
} else {
  console.log("❌ Some pages have structural defects.");
  process.exit(1);
}
