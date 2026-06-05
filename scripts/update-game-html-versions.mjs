#!/usr/bin/env node
/**
 * Update game HTML version queries from single source of truth
 * Reads ASSET_VERSION from game-asset-versions.mjs and updates all ?v= queries
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync } from "fs";
import { ASSET_VERSION } from "./game-asset-versions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

const gameDirs = ["cannonball-clash", "treasure-cove"];

console.log(`Updating game HTML to use ASSET_VERSION: ${ASSET_VERSION}`);

for (const gameDir of gameDirs) {
  const indexPath = join(root, "public", "play", gameDir, "index.html");

  try {
    let content = readFileSync(indexPath, "utf8");

    // Update inline script archive URL
    content = content.replace(
      /url = _w\.location\.href \+ "[^"]+\.tar\.gz\?v=mobile-v\d+"/g,
      `url = _w.location.href + "${gameDir}.tar.gz?v=${ASSET_VERSION}"`,
    );

    // Update preload link
    content = content.replace(
      /<link rel="preload" href="\/play\/[^"]+\.tar\.gz\?v=mobile-v\d+" as="fetch">/g,
      `<link rel="preload" href="/play/${gameDir}/${gameDir}.tar.gz?v=${ASSET_VERSION}" as="fetch">`,
    );

    // Update CSS link
    content = content.replace(
      /<link rel="stylesheet" href="\/play\/shared\/mobile-controls\.css\?v=mobile-v\d+">/g,
      `<link rel="stylesheet" href="/play/shared/mobile-controls.css?v=${ASSET_VERSION}">`,
    );

    // Update shared JS scripts
    const sharedScripts = [
      "pygame-input-bridge.js",
      "game-viewport.js",
      "mobile-controls.js",
    ];
    for (const script of sharedScripts) {
      content = content.replace(
        new RegExp(
          `<script src="/play/shared/${script}\\?v=mobile-v\\d+"></script>`,
          "g",
        ),
        `<script src="/play/shared/${script}?v=${ASSET_VERSION}"></script>`,
      );
    }

    writeFileSync(indexPath, content);
    console.log(`✅ Updated ${indexPath}`);
  } catch (err) {
    console.error(`❌ Failed to update ${indexPath}:`, err.message);
    process.exit(1);
  }
}

console.log("🎉 All game HTML version queries updated successfully!");
