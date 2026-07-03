#!/usr/bin/env node

/**
 * Check cross-document consistency across the repository documentation chain.
 *
 * Validates:
 * 1. All npm command references in docs are real scripts in package.json
 * 2. Relative markdown links resolve to existing files
 * 3. Critical factual invariants (game counts, engine mentions)
 *
 * Exit code: 0 = all good, 1 = failures
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC_FILES = [
  "README.md",
  "ROADMAP.md",
  "MAINTENANCE.md",
  "TESTING.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  ".opencode/skills/pirate-arcade-site/SKILL.md",
  "docs/adr/0001-fourth-browser-game-architecture.md",
  "docs/adr/0002-race-to-treasure-island-phaser.md",
  "docs/new-browser-game-checklist.md",
];

const BROWSER_PLAYABLE_GAMES = [
  "cannonball-clash",
  "treasure-cove",
  "krakens-wake",
  "race-to-treasure-island",
];

let failed = false;

function error(msg) {
  console.error(`  FAIL: ${msg}`);
  failed = true;
}

function read(path) {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

// --- 1. Check npm command references ---
console.log("Checking npm command references...");

const pkgRaw = read(join(ROOT, "package.json"));
const pkg = pkgRaw ? JSON.parse(pkgRaw) : {};
const validScripts = new Set(Object.keys(pkg.scripts || {}));

for (const docRel of DOC_FILES) {
  const docPath = join(ROOT, docRel);
  const content = read(docPath);
  if (!content) {
    error(`${docRel}: could not read`);
    continue;
  }

  // Find all `npm run <name>` references
  const npmRunRefs = content.matchAll(/`npm run ([a-z0-9:_-]+)`/g);
  for (const match of npmRunRefs) {
    const name = match[1];
    if (!validScripts.has(name)) {
      error(`${docRel}: references unknown script "npm run ${name}"`);
    }
  }
}

// --- 2. Check relative markdown links ---
console.log("Checking relative markdown links...");

for (const docRel of DOC_FILES) {
  const docPath = join(ROOT, docRel);
  const content = read(docPath);
  if (!content) continue;

  const docDir = dirname(docPath);

  // Find markdown links [text](path)
  const linkRefs = content.matchAll(
    /\[([^\]]+)\]\(((?:\.\.?\/)[^)]+\.md(?:#[^)]*)?)\)/g,
  );
  for (const match of linkRefs) {
    const linkTarget = match[2].split("#")[0]; // strip anchor
    const targetPath = resolve(docDir, linkTarget);
    if (!existsSync(targetPath)) {
      error(`${docRel}: broken link to "${linkTarget}" (${targetPath})`);
    }
  }
}

// --- 3. Critical factual invariants ---
console.log("Checking critical factual invariants...");

const readme = read(join(ROOT, "README.md"));
const agents = read(join(ROOT, "AGENTS.md"));
const maintenance = read(join(ROOT, "MAINTENANCE.md"));
const testing = read(join(ROOT, "TESTING.md"));
const roadmap = read(join(ROOT, "ROADMAP.md"));

// 3a. AGENTS must mention race-to-treasure-island
if (agents && !agents.includes("race-to-treasure-island")) {
  error("AGENTS.md must mention race-to-treasure-island");
}

// 3b. AGENTS must acknowledge phaser is a production dependency
if (agents && agents.includes("dependencies should remain empty")) {
  error(
    "AGENTS.md still claims dependencies should be empty (phaser is runtime dep)",
  );
}

// 3c. README must mention all 5 games (by title or id)
const readmeGameNames = [
  { id: "cannonball-clash", title: "Cannonball" },
  { id: "treasure-cove", title: "Treasure Cove" },
  { id: "krakens-wake", title: "Kraken" },
  { id: "race-to-treasure-island", title: "Race to Treasure" },
  { id: "port-royale-tycoon", title: "Port Royale" },
];
for (const { id, title } of readmeGameNames) {
  if (readme && !readme.includes(id) && !readme.includes(title)) {
    error(`README.md missing mention of game "${id}"`);
  }
}

// 3d. MAINTENANCE must reference both engine paths
if (maintenance) {
  if (!maintenance.includes("Pygbag") && !maintenance.includes("pygbag")) {
    error("MAINTENANCE should reference Pygbag engine path");
  }
  if (
    !maintenance.includes("race-to-treasure-island") &&
    !maintenance.includes("Phaser")
  ) {
    error("MAINTENANCE should reference web-native/Phaser engine path");
  }
}

// 3e. TESTING must mention both iPad projects
if (testing && !testing.includes("ipad")) {
  error("TESTING must reference iPad test projects");
}

// 3f. CONTRIBUTING exists
if (!existsSync(join(ROOT, "CONTRIBUTING.md"))) {
  error("CONTRIBUTING.md does not exist");
}

// 3g. PR template exists
if (!existsSync(join(ROOT, ".github/pull_request_template.md"))) {
  error(".github/pull_request_template.md does not exist");
}

// 3h. ADR 0002 exists
if (
  !existsSync(join(ROOT, "docs/adr/0002-race-to-treasure-island-phaser.md"))
) {
  error("docs/adr/0002-race-to-treasure-island-phaser.md does not exist");
}

// 3i. Version string consistency
const skill = read(join(ROOT, ".opencode/skills/pirate-arcade-site/SKILL.md"));
const gamesJson = read(join(ROOT, "src/data/games.json"));
const pkgAll = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

const astroVersion = (pkgAll.astro || "").replace(/[^0-9.]/g, "").split(".")[0];
const phaserRange = pkgAll.phaser || "";
const phaserMajorMinor = phaserRange
  .replace(/[^0-9.]/g, "")
  .split(".")
  .slice(0, 2)
  .join(".");

if (astroVersion && skill) {
  if (!skill.includes(`Astro ${astroVersion}`)) {
    error(`SKILL.md frontmatter should reference Astro ${astroVersion}`);
  }
}

if (phaserMajorMinor && skill) {
  if (!skill.includes(`Phaser ${phaserMajorMinor}`)) {
    error(`SKILL.md body should reference Phaser ${phaserMajorMinor}`);
  }
}

if (phaserMajorMinor && gamesJson) {
  const raceEntry = gamesJson.match(
    /"id":\s*"race-to-treasure-island"[^}]+"demonstrates":\s*\[([^\]]+)\]/s,
  );
  if (raceEntry && !raceEntry[1].includes(`Phaser ${phaserMajorMinor}`)) {
    error(
      `games.json race entry demonstrates should reference Phaser ${phaserMajorMinor}`,
    );
  }
}

if (phaserMajorMinor && roadmap) {
  const roadmapTableLine = roadmap.match(
    /\| Race to Treasure Island \| [^|]+ \|/,
  );
  if (
    roadmapTableLine &&
    !roadmapTableLine[0].includes(`Phaser ${phaserMajorMinor}`)
  ) {
    error(`ROADMAP.md table should reference Phaser ${phaserMajorMinor}`);
  }
}

// --- Summary ---
console.log(
  `\n${failed ? "FAILED — see errors above" : "All documentation consistency checks passed."}`,
);
process.exit(failed ? 1 : 0);
