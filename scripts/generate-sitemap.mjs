import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SITE_URL = "https://pirate-arcade.com";
const DIST = "dist";
const EXTRA_STATIC_PATHS = [
  "/play/cannonball-clash/",
  "/play/treasure-cove/",
  "/feed.xml",
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
  ["/games/cannonball-clash/", "2026-06-01"],
  ["/games/treasure-cove/", "2026-06-01"],
  ["/games/krakens-wake/", "2026-06-01"],
  ["/games/port-royale-tycoon/", "2026-06-01"],
  ["/play/cannonball-clash/", "2026-06-01"],
  ["/play/treasure-cove/", "2026-06-01"],
]);

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
