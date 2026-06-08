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

const gamesPath = resolve("src/data/games.json");
const gamesMeta = JSON.parse(readFileSync(gamesPath, "utf-8"));

const importantRoutes = new Set([
  ...CORE_ROUTES,
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
]);

for (const game of gamesMeta) {
  importantRoutes.add(`/games/${game.id}/`);
}

for (const game of gamesMeta.filter((g) => g.status === "browser-playable")) {
  importantRoutes.add(`/play/${game.id}/`);
}

const importantRoutesList = [...importantRoutes].map(
  (p) => `https://pirate-arcade.com${p}`,
);

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

if (/two browser ports|two browser-playable/i.test(home + sitemap)) {
  fail('found stale "two browser ports" reference');
}

if (
  /krakens?-wake.*desktop-only|desktop-only.*krakens?-wake|krakens?-wake.*desktop game/i.test(
    home + sitemap,
  )
) {
  fail('found stale "desktop-only" claim for Kraken\'s Wake');
}

if (!/play\/krakens-wake/i.test(home + sitemap)) {
  fail("missing /play/krakens-wake/ reference");
}

// 1. Every browser-playable game must have a browserUrl
for (const game of gamesMeta.filter((g) => g.status === "browser-playable")) {
  if (!game.browserUrl) {
    fail(`browser-playable game "${game.id}" missing browserUrl`);
  }
  if (!game.browserUrl.startsWith("/play/")) {
    fail(
      `browser-playable game "${game.id}" browserUrl must start with /play/`,
    );
  }
}

// 2. Every browser-playable game must have a screenshot
for (const game of gamesMeta.filter((g) => g.status === "browser-playable")) {
  if (!game.screenshot) {
    fail(`browser-playable game "${game.id}" missing screenshot`);
  }
  if (!game.screenshot.startsWith("/images/screenshot-")) {
    fail(
      `browser-playable game "${game.id}" screenshot path must be /images/screenshot-<id>.png`,
    );
  }
  const screenshotPath = resolve("public", game.screenshot.replace(/^\//, ""));
  if (!existsSync(screenshotPath)) {
    fail(`screenshot file missing for "${game.id}": ${screenshotPath}`);
  }
}

// 3. Every desktop-available game without browserUrl must not appear under /play/<id>/
for (const game of gamesMeta.filter(
  (g) => g.status === "desktop-available" && !g.browserUrl,
)) {
  const playPath = resolve("public/play", game.id);
  if (existsSync(playPath)) {
    fail(
      `desktop-only game "${game.id}" has /play/${game.id}/ directory but no browserUrl`,
    );
  }
  const playRoute = `https://pirate-arcade.com/play/${game.id}/`;
  if (sitemap.includes(`<loc>${playRoute}</loc>`)) {
    fail(
      `desktop-only game "${game.id}" appears in sitemap under /play/ but has no browserUrl`,
    );
  }
}

// 4. llms.txt must list all browser-playable games
const llmsTxt = readFileSync("public/llms.txt", "utf8");
for (const game of gamesMeta.filter((g) => g.status === "browser-playable")) {
  if (!llmsTxt.includes(game.title)) {
    fail(`llms.txt missing browser-playable game: ${game.title}`);
  }
  if (!llmsTxt.includes(`/play/${game.id}/`)) {
    fail(`llms.txt missing play URL for ${game.title}: /play/${game.id}/`);
  }
}

// 5. llms.txt must not list Port Royale as browser-playable
if (
  llmsTxt.includes("Port Royale Tycoon") &&
  llmsTxt.includes("/play/port-royale-tycoon/")
) {
  fail("llms.txt incorrectly lists Port Royale Tycoon as browser-playable");
}

// 6. Every game detail page must have unique title/meta description
for (const game of gamesMeta) {
  const gameHtmlPath = resolve("dist/games", game.id, "index.html");
  if (existsSync(gameHtmlPath)) {
    const gameHtml = readFileSync(
      resolve("dist/games", game.id, "index.html"),
      "utf8",
    );
    const titleMatch = gameHtml.match(/<title>([^<]+)<\/title>/);
    const descMatch = gameHtml.match(
      /<meta\s+name="description"\s+content="([^"]+)"/,
    );
    if (!titleMatch) {
      fail(`game detail page for "${game.id}" missing <title>`);
    }
    if (!descMatch) {
      fail(`game detail page for "${game.id}" missing meta description`);
    }
    if (descMatch[1].length > 160) {
      console.warn(
        `seo-audit: game "${game.id}" meta description > 160 chars (${descMatch[1].length})`,
      );
    }
  }
}

if (!process.exitCode) {
  console.log("seo-audit: ok");
}
