#!/usr/bin/env node
/**
 * Create a new browser-game scaffold.
 * Dry-run by default. Use --apply to write files.
 * Usage: node scripts/create-browser-game-scaffold.mjs --id <game-id> --title "Game Title" [--apply]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Parse args
const args = process.argv.slice(2);
const id = args.find((a) => a === "--id")
  ? args[args.indexOf("--id") + 1]
  : null;
const title = args.find((a) => a === "--title")
  ? args[args.indexOf("--title") + 1]
  : null;
const apply = args.includes("--apply");
const dryRun = !apply;

if (!id || !title) {
  console.error(
    'Usage: node scripts/create-browser-game-scaffold.mjs --id <game-id> --title "Game Title" [--apply]',
  );
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(id)) {
  console.error("Error: --id must be lowercase alphanumeric with hyphens only");
  process.exit(1);
}

const gameDir = resolve(root, "public/play", id);
const scriptsDir = resolve(root, "scripts/pygbag-port", id);
const gamesJsonPath = resolve(root, "src/data/games.json");

console.log(`Creating scaffold for: ${id} (${title})`);
console.log(`Mode: ${dryRun ? "DRY RUN (use --apply to write)" : "APPLY"}`);

// Check if already exists
if (existsSync(gameDir) || existsSync(scriptsDir)) {
  console.error(`❌ Game ${id} already exists`);
  process.exit(1);
}

// Load games.json for validation
const gamesJson = JSON.parse(
  readFileSync(resolve(root, "src/data/games.json"), "utf-8"),
);
if (gamesJson.some((g) => g.id === id)) {
  console.error(`❌ Game ${id} already in games.json`);
  process.exit(1);
}

// Read template
const templateHtml = readFileSync(
  resolve(root, "public/play/cannonball-clash/index.html"),
  "utf-8",
);

// Generate game HTML
const gameHtml = templateHtml
  .replace(/cannonball-clash/g, id)
  .replace(/Cannonball Clash/g, title)
  .replace(/pong/g, "custom"); // controlMode placeholder

// Files to create
const files = [
  {
    path: resolve(gameDir, "index.html"),
    content: gameHtml,
    desc: "Game shell HTML",
  },
  {
    path: resolve(scriptsDir, "main.py"),
    content: `# ${title} - Pygbag entry point\n# TODO: Implement game entry point\n`,
    desc: "Pygbag entry point",
  },
  {
    path: resolve(scriptsDir, "games/__init__.py"),
    content: "",
    desc: "Games package init",
  },
  {
    path: resolve(scriptsDir, "games/game/__init__.py"),
    content: "",
    desc: "Game module init",
  },
  {
    path: resolve(scriptsDir, "games/game/game.py"),
    content: `# ${title} game logic\n# TODO: Implement game class\n`,
    desc: "Game main class",
  },
  {
    path: resolve(scriptsDir, "games/game/gameplay.py"),
    content: `# ${title} gameplay logic\n# TODO: Implement gameplay\n`,
    desc: "Gameplay logic",
  },
  {
    path: resolve(scriptsDir, "assets/__init__.py"),
    content: "",
    desc: "Assets package init",
  },
];

console.log("\nFiles to create:");
for (const f of files) {
  console.log(`  ${f.path.replace(root + "/", "")}  (${f.desc})`);
}

if (dryRun) {
  console.log("\n⚠️  DRY RUN - no files written. Use --apply to create files.");
  process.exit(0);
}

// Create directories and files
for (const f of files) {
  mkdirSync(dirname(f.path), { recursive: true });
  writeFileSync(f.path, f.content);
  console.log(`  ✅ Created: ${f.path.replace(root + "/", "")}`);
}

// Update games.json (manual step reminder)
console.log("\n⚠️  Manual steps required:");
console.log(`  1. Add entry to src/data/games.json for "${id}"`);
console.log(`  2. Run: npm run apply:game-versions`);
console.log(`  3. Add CSP entries to public/_headers`);
console.log(`  4. Update public/sw.js ASSETS_TO_CACHE`);
console.log(`  4. Run: npm run test:browser-game-shells`);
console.log(`  5. Run: npm run capture:screenshots`);

console.log("\n✅ Scaffold created successfully!");
