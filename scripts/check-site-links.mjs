#!/usr/bin/env node
/**
 * Check internal links in the built site.
 *
 * Parses dist/**\/*.html, collects internal links, and verifies they exist
 * on disk. Also flags target="_blank" without rel="noopener noreferrer"
 * and http:// external links.
 *
 * Usage: node scripts/check-site-links.mjs
 * Requires: npm run build first (reads from dist/)
 */

import { readFileSync, existsSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");

if (!existsSync(distDir)) {
  console.error("dist/ not found. Run 'npm run build' first.");
  process.exit(1);
}

function collectHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(full));
    } else if (entry.isFile() && extname(full) === ".html") {
      files.push(full);
    }
  }
  return files;
}

/**
 * Resolve an href from an HTML file to an absolute path relative to dist/.
 * Returns null if the link should be skipped (external, anchor-only, etc.).
 */
function resolveLink(href, sourceFile) {
  // Skip non-local link types
  if (
    !href ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#") ||
    href.startsWith("data:") ||
    href.startsWith("blob:") ||
    href.startsWith("//")
  ) {
    return null;
  }

  // Strip query string and hash
  const clean = href.split("?")[0].split("#")[0];
  if (!clean) return null;

  let resolved;
  if (clean.startsWith("/")) {
    resolved = clean;
  } else {
    const base = dirname(sourceFile.replace(distDir, ""));
    resolved = join("/", base, clean);
  }

  // Normalize: remove double slashes, trailing dots, etc.
  resolved = resolved.replace(/\/+/g, "/");

  return join(distDir, resolved);
}

/**
 * Check if a resolved path exists on disk.
 * For directory-style paths (no extension), also check for index.html.
 */
function pathExists(resolved) {
  if (existsSync(resolved)) return true;

  // Try with index.html for directory-style paths
  if (!extname(resolved)) {
    if (existsSync(join(resolved, "index.html"))) return true;
    // Also try as a file without trailing slash (e.g. /about → /about.html)
    if (existsSync(resolved + ".html")) return true;
  }

  return false;
}

const htmlFiles = collectHtmlFiles(distDir);
let totalInternal = 0;
let totalSkipped = 0;
const brokenLinks = [];
const missingRelNoopener = [];
const httpExternalLinks = [];

// Matches href="..." and src="..." attributes
const linkPattern =
  /<(?:a|link|img|script|source)\s[^>]*?(?:href|src)\s*=\s*"([^"]+)"/gi;

for (const file of htmlFiles) {
  const content = readFileSync(file, "utf-8");
  const relPath = file.replace(distDir, "");

  // Check all href/src attributes
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const href = match[1];
    const resolved = resolveLink(href, file);
    if (!resolved) {
      totalSkipped++;
      continue;
    }
    totalInternal++;

    if (!pathExists(resolved)) {
      brokenLinks.push({
        file: relPath,
        href,
        resolved: resolved.replace(distDir, ""),
      });
    }
  }

  // Check target="_blank" external links for rel="noopener noreferrer"
  const blankAnchorPattern =
    /<a\s[^>]*?(?:href\s*=\s*"([^"]*)")[^>]*?(?:target\s*=\s*"_blank")[^>]*?>/gi;
  while ((match = blankAnchorPattern.exec(content)) !== null) {
    const fullTag = match[0];
    const href = match[1];
    if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
      const hasRel =
        fullTag.includes('rel="noopener noreferrer"') ||
        fullTag.includes("rel='noopener noreferrer'");
      if (!hasRel) {
        missingRelNoopener.push({
          file: relPath,
          href,
          tag: fullTag.slice(0, 120),
        });
      }
    }
  }

  // Check for http:// external links (should be https://)
  const httpPattern =
    /<(?:a|link|img|script|source)\s[^>]*?(?:href|src)\s*=\s*"http:\/\/([^"]+)"/gi;
  while ((match = httpPattern.exec(content)) !== null) {
    const url = match[0];
    if (
      !url.includes("localhost") &&
      !url.includes("127.0.0.1") &&
      !url.includes("0.0.0.0")
    ) {
      httpExternalLinks.push({ file: relPath, url: match[0] });
    }
  }
}

let exitCode = 0;

console.log(
  `\n📊 Scanned ${htmlFiles.length} HTML files, ${totalInternal} internal links (${totalSkipped} external/anchor skipped).`,
);

if (brokenLinks.length > 0) {
  console.error(`\n❌ ${brokenLinks.length} broken internal link(s):`);
  for (const link of brokenLinks) {
    console.error(
      `   ${link.file} → "${link.href}" (resolved: ${link.resolved})`,
    );
  }
  exitCode = 1;
} else {
  console.log(`✅ ${totalInternal} internal links — all resolve on disk.`);
}

if (missingRelNoopener.length > 0) {
  console.warn(
    `\n⚠️  ${missingRelNoopener.length} target="_blank" link(s) missing rel="noopener noreferrer":`,
  );
  for (const link of missingRelNoopener.slice(0, 10)) {
    console.warn(`   ${link.file} → ${link.href}`);
  }
  if (missingRelNoopener.length > 10) {
    console.warn(`   ... and ${missingRelNoopener.length - 10} more`);
  }
}

if (httpExternalLinks.length > 0) {
  console.warn(
    `\n⚠️  ${httpExternalLinks.length} http:// external link(s) found (should use https):`,
  );
  for (const link of httpExternalLinks.slice(0, 5)) {
    console.warn(`   ${link.file} → ${link.url}`);
  }
  if (httpExternalLinks.length > 5) {
    console.warn(`   ... and ${httpExternalLinks.length - 5} more`);
  }
}

if (exitCode === 0) {
  console.log("\n✅ All link checks passed!");
} else {
  console.log(`\n❌ Link check failed — fix broken links above.`);
}

process.exit(exitCode);
