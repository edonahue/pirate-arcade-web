#!/usr/bin/env node
/**
 * Copy tone guardrail.
 * Checks for banned pirate-parody words and phrases in built HTML and content files.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

const BANNED_GLOBAL = [
  "arr",
  "arrr",
  "matey",
  "scallywag",
  "yo-ho",
  "yo-ho-ho",
  "shiver me timbers",
];

const BANNED_ABOUT_BUILD_SOURCE_DOCS = [
  "ahoy",
  "captain",
  "set sail",
  "shipshape",
  "treasure map",
  "yo-ho-ho",
];

// Files that should NOT contain banned pirate-parody words
const STRICT_FILES = [
  "src/pages/about.astro",
  "src/pages/source.astro",
  "src/pages/build-log/index.astro",
  "src/pages/build-log/[slug].astro",
  "src/components/BuildLogCard.astro",
  "src/lib/schema.ts",
  "scripts/seo-audit.mjs",
];

// Content files (posts) - allowed to use pirate terms when literal
const POSTS_DIR = "src/content/posts/";

const ALLOWED_LITERAL = [
  "pirate-arcade",
  "pirate-themed",
  "pirate illustrations",
  "pirate-themed visuals",
  "pirate-themed audio",
  "pirate flavor",
  "cannonball-clash",
  "treasure-cove",
  "krakens-wake",
  "kraken's wake",
  "port-royale-tycoon",
  "port royale tycoon",
  "howard pyle",
  "pirate illustrations",
  "pirate art",
];

function checkBannedWords(text, file, bannedList, allowedList = []) {
  const lower = text.toLowerCase();
  const violations = [];

  for (const word of bannedList) {
    const regex = new RegExp(
      `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi",
    );
    if (regex.test(lower)) {
      // Check if it's in an allowed context
      let allowed = false;
      for (const allowed of allowedList) {
        if (lower.includes(allowed.toLowerCase())) {
          // Check if the banned word appears near the allowed term
          const idx = lower.indexOf(word.toLowerCase());
          const allowedIdx = lower.indexOf(allowed.toLowerCase());
          if (allowedIdx !== -1 && Math.abs(idx - allowedIdx) < 50) {
            allowed = true;
            break;
          }
        }
      }
      if (!allowed) {
        violations.push(word);
      }
    }
  }
  return violations;
}

function walk(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  console.log("🔍 Checking copy tone...\n");

  let allPassed = true;
  const distDir = join(root, "dist");

  // Check built HTML files
  if (existsSync(distDir)) {
    const htmlFiles = walk(distDir).filter((f) => f.endsWith(".html"));
    for (const file of htmlFiles) {
      const content = readFileSync(file, "utf8");
      const relPath = file.replace(root + "/", "");

      const violations = checkBannedWords(content, relPath, BANNED_GLOBAL);
      if (violations.length > 0) {
        console.log(
          `  ❌ ${relPath}: banned words found: ${violations.join(", ")}`,
        );
        allPassed = false;
      }
    }
  }

  // Check source files (stricter for certain files)
  for (const file of STRICT_FILES) {
    const fullPath = join(root, file);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");

    const violations = checkBannedWords(
      content,
      file,
      BANNED_ABOUT_BUILD_SOURCE_DOCS,
    );
    if (violations.length > 0) {
      console.log(
        `  ❌ ${file}: banned words in restricted file: ${violations.join(", ")}`,
      );
      allPassed = false;
    }
  }

  // Check posts directory (allow literal terms)
  if (existsSync(join(root, POSTS_DIR))) {
    const postFiles = walk(join(root, POSTS_DIR)).filter((f) =>
      f.endsWith(".md"),
    );
    for (const file of postFiles) {
      const content = readFileSync(file, "utf8");
      const relPath = file.replace(root + "/", "");

      // Only check for global banned words in posts
      const violations = checkBannedWords(
        content,
        relPath,
        BANNED_GLOBAL,
        ALLOWED_LITERAL,
      );
      if (violations.length > 0) {
        console.log(
          `  ❌ ${relPath}: banned words found: ${violations.join(", ")}`,
        );
        allPassed = false;
      }
    }
  }

  if (allPassed) {
    console.log("\n✅ Copy tone check passed!");
    process.exit(0);
  } else {
    console.log("\n❌ Copy tone check failed!");
    process.exit(1);
  }
}

main();
