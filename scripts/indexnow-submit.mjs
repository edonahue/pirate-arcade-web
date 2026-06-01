import { existsSync, readFileSync } from "node:fs";

const key = process.env.INDEXNOW_KEY;
const siteUrl = process.env.SITE_URL ?? "https://pirate-arcade.com";
const host = new URL(siteUrl).host;
const sitemapPath = process.env.SITEMAP_PATH ?? "dist/sitemap.xml";
const explicitUrls = process.env.INDEXNOW_URLS?.split(",")
  .map((url) => url.trim())
  .filter(Boolean);

function urlsFromSitemap(path) {
  if (!existsSync(path)) {
    throw new Error(`sitemap not found: ${path}`);
  }
  const sitemap = readFileSync(path, "utf8");
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

if (!key) {
  console.log("indexnow: INDEXNOW_KEY not set; skipping");
  process.exit(0);
}

const urls = explicitUrls?.length ? explicitUrls : urlsFromSitemap(sitemapPath);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: new URL(`/${key}.txt`, siteUrl).href,
    urlList: urls,
  }),
});

if (!response.ok) {
  console.error(`indexnow: ${response.status} ${response.statusText}`);
  process.exit(1);
}

console.log(`indexnow: submitted ${urls.length} URLs for ${host}`);
