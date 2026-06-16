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

function checkPage(filePath) {
  const pagePath = getPagePath(filePath);
  const html = readFileSync(filePath, "utf-8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const main = doc.querySelector("main#main-content");
  const footer = doc.querySelector("footer");

  if (!main) {
    return { pagePath, skip: true };
  }

  const errors = [];

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

const files = collectHtmlFiles(DIST);
console.log(`Checking ${files.length} HTML files for structural integrity...`);

let checked = 0;
let skipped = 0;
let allPassed = true;

for (const file of files) {
  const result = checkPage(file);
  if (result.skip) {
    skipped++;
    continue;
  }
  checked++;
  if (result.errors.length > 0) {
    allPassed = false;
    console.log(`\n❌ ${result.pagePath}`);
    for (const err of result.errors) {
      console.log(`    ${err}`);
    }
  }
}

console.log(
  `\nChecked: ${checked} (BaseLayout pages), skipped: ${skipped} (no main#main-content)`,
);
if (allPassed) {
  console.log("✅ All BaseLayout pages have correct document structure.");
  process.exit(0);
} else {
  console.log("❌ Some pages have structural defects.");
  process.exit(1);
}
