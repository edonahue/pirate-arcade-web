import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SITE_URL = "https://pirate-arcade.com";
const DIST = "dist";

// Read games.json for data-driven extra paths
const gamesPath = resolve("src/data/games.json");
const gamesMeta = JSON.parse(readFileSync(gamesPath, "utf-8"));

const EXTRA_STATIC_PATHS = [
  "/play/",
  ...gamesMeta
    .filter((g) => g.status === "browser-playable")
    .map((g) => `/play/${g.id}/`),
  "/feed.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pathFromHtmlFile(file) {
  const rel = relative(DIST, file);
  if (rel === "index.html") return "/";
  return `/${rel.replace(/\/index\.html$/, "/")}`;
}

function frontmatterDate(source) {
  const match = source.match(/^pubDate:\s*"?([^"\n]+)"?\s*$/m);
  if (!match) return undefined;
  const date = new Date(match[1]);
  if (Number.isNaN(date.valueOf())) return undefined;
  return date.toISOString().slice(0, 10);
}

const lastmod = new Map([
  ["/", "2026-06-01"],
  ["/play/", "2026-06-01"],
  ["/about/", "2026-06-01"],
  ["/source/", "2026-06-01"],
  ["/build-log/", "2026-06-01"],
  ["/feed.xml", "2026-06-01"],
  ["/robots.txt", "2026-06-01"],
  ["/sitemap.xml", "2026-06-01"],
  ["/llms.txt", "2026-06-01"],
  ["/llms-full.txt", "2026-06-01"],
]);

// Add game detail routes from games.json
for (const game of gamesMeta) {
  lastmod.set(`/games/${game.id}/`, "2026-06-01");
}

// Add browser play routes for browser-playable games
for (const game of gamesMeta.filter((g) => g.status === "browser-playable")) {
  lastmod.set(`/play/${game.id}/`, "2026-06-01");
}

for (const file of walk("src/content/posts").filter((f) => f.endsWith(".md"))) {
  const slug = file.split("/").pop().replace(/\.md$/, "");
  const source = readFileSync(file, "utf8");
  lastmod.set(`/build-log/${slug}/`, frontmatterDate(source) ?? "2026-06-01");
}

const paths = new Set(EXTRA_STATIC_PATHS);

for (const file of walk(DIST).filter(
  (f) => f.endsWith("index.html") || f.endsWith("feed.xml"),
)) {
  paths.add(file.endsWith("feed.xml") ? "/feed.xml" : pathFromHtmlFile(file));
}

const urls = [...paths]
  .filter((path) => path !== "/404/")
  .sort()
  .map((path) => ({
    loc: new URL(path, SITE_URL).href,
    lastmod: lastmod.get(path) ?? "2026-06-01",
  }));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
  <loc>${escapeXml(url.loc)}</loc>
  <lastmod>${url.lastmod}</lastmod>
</url>`,
  )
  .join("\n")}
</urlset>
`;

writeFileSync(join(DIST, "sitemap.xml"), xml);
console.log(`sitemap: wrote ${urls.length} canonical URLs to dist/sitemap.xml`);
