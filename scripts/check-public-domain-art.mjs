#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

const manifestPath = join(root, "src/data/publicDomainArt.ts");

console.log("Checking public domain art manifest and assets...");

let manifestRaw;
try {
  manifestRaw = readFileSync(manifestPath, "utf8");
} catch (err) {
  console.log(`  Could not read manifest at ${manifestPath}`);
  process.exit(1);
}

const entries = manifestRaw.match(
  /id:\s*"([^"]+)",\s*\n\s*title:\s*"([^"]+)",\s*\n\s*alt:\s*"([^"]+)",\s*\n\s*filename:\s*"([^"]+)",\s*\n\s*width:\s*(\d+),\s*\n\s*height:\s*(\d+),\s*\n\s*format:\s*"([^"]+)",\s*\n\s*sourceUrl:\s*"([^"]+)",\s*\n\s*sourcePage:\s*"([^"]+)",\s*\n\s*license:\s*"([^"]+)",\s*\n\s*author:\s*"([^"]+)",\s*\n\s*year:\s*(\d+),\s*\n\s*collection:\s*"([^"]+)",\s*\n\s*usage:\s*"([^"]+)"/g,
);

if (!entries || entries.length === 0) {
  console.log("  No manifest entries found");
  process.exit(1);
}

console.log(`  Found ${entries.length} manifest entries`);

let allPassed = true;

for (const block of manifestRaw.match(/{\s*\n[\s\S]*?},\s*\n/g) || []) {
  const id = block.match(/id:\s*"([^"]+)"/)?.[1];
  const filename = block.match(/filename:\s*"([^"]+)"/)?.[1];
  const fileFormat = block.match(/format:\s*"([^"]+)"/)?.[1];
  const sourceUrl = block.match(/sourceUrl:\s*"([^"]+)"/)?.[1];
  const sourcePage = block.match(/sourcePage:\s*"([^"]+)"/)?.[1];
  const license = block.match(/license:\s*"([^"]+)"/)?.[1];
  const author = block.match(/author:\s*"([^"]+)"/)?.[1];

  if (!id || !filename) continue;

  // Check file exists
  const filePath = join(root, "public/images/art", filename);
  if (!existsSync(filePath)) {
    console.log(`  File not found: public/images/art/${filename}`);
    allPassed = false;
    continue;
  }

  // Check format
  if (fileFormat !== "image/webp") {
    console.log(`  ${filename}: expected image/webp, got ${fileFormat}`);
    allPassed = false;
  }

  // Check source URL and page
  if (!sourceUrl || !sourceUrl.startsWith("https://")) {
    console.log(`  ${id}: missing or invalid sourceUrl`);
    allPassed = false;
  }
  if (!sourcePage || !sourcePage.startsWith("https://commons.wikimedia")) {
    console.log(`  ${id}: sourcePage should link to Wikimedia Commons`);
    allPassed = false;
  }

  // Check license presence
  if (!license || !license.toLowerCase().includes("public domain")) {
    console.log(`  ${id}: license must contain 'public domain'`);
    allPassed = false;
  }

  // Check author
  if (!author || author !== "Howard Pyle") {
    console.log(`  ${id}: author should be Howard Pyle`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log("All public domain art checks passed!");
  process.exit(0);
} else {
  console.log("Some public domain art checks failed!");
  process.exit(1);
}
