import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  "dist/robots.txt",
  "dist/sitemap.xml",
  "dist/llms.txt",
  "dist/llms-full.txt",
  "dist/feed.xml",
  "dist/index.html",
];

// Core routes that must always exist
const CORE_ROUTES = [
  "/",
  "/play/",
  "/build-log/",
  "/about/",
  "/source/",
  "/feed.xml",
  "/sitemap.xml",
];

function fail(message) {
  console.error(`seo-audit: ${message}`);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  if (!existsSync(file)) fail(`missing ${file}`);
}

if (process.exitCode) process.exit();

// Read games.json for data-driven routes
const gamesPath = resolve("src/data/games.json");
const gamesMeta = JSON.parse(readFileSync(gamesPath, "utf-8"));

// Build importantRoutes from games.json
const importantRoutes = new Set([
  ...CORE_ROUTES,
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
]);

// Add game detail routes for all games
for (const game of gamesMeta) {
  importantRoutes.add(`/games/${game.id}/`);
}

// Add browser play routes for browser-playable games
for (const game of gamesMeta.filter((g) => g.status === "browser-playable")) {
  importantRoutes.add(`/play/${game.id}/`);
}

const importantRoutesList = [...importantRoutes].map(
  (p) => `https://pirate-arcade.com${p}`,
);

for (const file of requiredFiles) {
  if (!existsSync(file)) fail(`missing ${file}`);
}

if (process.exitCode) process.exit();

const home = readFileSync("dist/index.html", "utf8");
const sitemap = readFileSync("dist/sitemap.xml", "utf8");
const robots = readFileSync("dist/robots.txt", "utf8");

const homeChecks = [
  [
    "canonical",
    /<link\s+rel="canonical"\s+href="https:\/\/pirate-arcade\.com\/"/,
  ],
  ["meta description", /<meta\s+name="description"\s+content="[^"]+"/],
  ["og title", /<meta\s+property="og:title"\s+content="[^"]+"/],
  [
    "twitter card",
    /<meta\s+name="twitter:card"\s+content="summary_large_image"/,
  ],
  ["json-ld", /<script\s+type="application\/ld\+json">/],
  ["erich sameAs", /erichdonahue\.com/],
  ["github sameAs", /github\.com\/edonahue\/pirate-arcade/],
];

for (const [name, pattern] of homeChecks) {
  if (!pattern.test(home)) fail(`homepage missing ${name}`);
}

if (!robots.includes("Sitemap: https://pirate-arcade.com/sitemap.xml")) {
  fail("robots.txt does not point to sitemap.xml");
}

for (const route of importantRoutesList) {
  if (!sitemap.includes(`<loc>${route}</loc>`)) {
    fail(`sitemap missing ${route}`);
  }
}

if (/localhost|127\.0\.0\.1|<loc>http:/.test(home + sitemap)) {
  fail("found invalid local or http URL in SEO output");
}

// Check for stale "two browser ports" reference
if (/two browser ports|two browser-playable/i.test(home + sitemap)) {
  fail('found stale "two browser ports" reference');
}

// Check for stale "desktop-only" or "desktop game" for Kraken's Wake
if (
  /krakens?-wake.*desktop-only|desktop-only.*krakens?-wake|krakens?-wake.*desktop game/i.test(
    home + sitemap,
  )
) {
  fail('found stale "desktop-only" claim for Kraken\'s Wake');
}

// Check that Kraken's Wake is marked as browser-playable
if (!/play\/krakens-wake/i.test(home + sitemap)) {
  fail("missing /play/krakens-wake/ reference");
}

if (!process.exitCode) {
  console.log("seo-audit: ok");
}
