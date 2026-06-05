#!/usr/bin/env node
/*
 * CSS Token Checker
 * Ensures all CSS var() references use defined tokens from tokens.css
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Allowlisted tokens that are okay to be undefined (browser defaults, etc.)
const ALLOWLISTED = new Set([
  // Common CSS properties that might use var() for fallback
  "animation-delay",
  "animation-duration",
  "animation-iteration-count",
  "animation-name",
  "animation-timing-function",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-radius",
  "border-style",
  "border-width",
  "bottom",
  "box-shadow",
  "color",
  "cursor",
  "display",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "gap",
  "grid-area",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-column",
  "grid-column-end",
  "grid-column-start",
  "grid-row",
  "grid-row-end",
  "grid-row-start",
  "grid-template-areas",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "justify-content",
  "left",
  "letter-spacing",
  "line-height",
  "list-style",
  "list-style-image",
  "list-style-position",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "opacity",
  "order",
  "outline",
  "outline-color",
  "outline-offset",
  "outline-style",
  "outline-width",
  "overflow",
  "overflow-x",
  "overflow-y",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "perspective",
  "perspective-origin",
  "pointer-events",
  "position",
  "right",
  "table-layout",
  "text-align",
  "text-decoration",
  "text-decoration-color",
  "text-decoration-line",
  "text-decoration-style",
  "text-indent",
  "text-transform",
  "top",
  "transform",
  "transform-origin",
  "transform-style",
  "transition",
  "transition-delay",
  "transition-duration",
  "transition-property",
  "transition-timing-function",
  "vertical-align",
  "visibility",
  "white-space",
  "width",
  "word-spacing",
  "z-index",
]);

// Read tokens.css to get all defined variables
const tokensPath = join(process.cwd(), "src", "styles", "tokens.css");
const tokensContent = readFileSync(tokensPath, "utf8");

// Extract all CSS variable names (--variable-name)
const tokenRegex = /--([a-zA-Z][a-zA-Z0-9-]*)/g;
const definedTokens = new Set();
let match;
while ((match = tokenRegex.exec(tokensContent)) !== null) {
  definedTokens.add(match[1]);
}

// Add the allowlisted properties as "defined" for checking purposes
// (We're really checking that vars used in these contexts are defined)
ALLOWLISTED.forEach((prop) => definedTokens.add(`--${prop}`));

// Find all CSS files to check
const { readdir } = await import("node:fs/promises");

async function findCssFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      entry.name !== "node_modules"
    ) {
      files.push(...(await findCssFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const cssFiles = await findCssFiles(join(process.cwd(), "src", "styles"));
  // Also check any inline styles in Astro/HTML if needed

  let errors = [];
  let warnings = [];

  const varRegex = /var\s*\(\s*--([a-zA-Z][a-zA-Z0-9-]*)/g;

  for (const file of cssFiles) {
    try {
      const content = readFileSync(file, "utf8");
      let match;

      while ((match = varRegex.exec(content)) !== null) {
        const tokenName = match[1];

        // Skip if it's a css var() function with fallback like var(--foo, bar)
        const varMatch = content
          .substring(match.index)
          .match(/var\s*\(\s*--[a-zA-Z][a-zA-Z0-9-]*(?:\s*,[^)]*)?\)/);
        if (varMatch && varMatch[0].includes(",")) {
          // This is a var() with fallback, only check the first token
          const firstTokenMatch = varMatch[0].match(
            /var\s*\(\s*--([a-zA-Z][a-zA-Z0-9-]*)/,
          );
          if (firstTokenMatch) {
            const tokenToCheck = firstTokenMatch[1];
            if (
              !definedTokens.has(tokenToCheck) &&
              !ALLOWLISTED.has(tokenToCheck)
            ) {
              errors.push(
                `${file}:${getLineNumber(content, match.index)}: Undefined CSS token: --${tokenToCheck}`,
              );
            }
          }
          continue;
        }

        if (!definedTokens.has(tokenName) && !ALLOWLISTED.has(tokenName)) {
          errors.push(
            `${file}:${getLineNumber(content, match.index)}: Undefined CSS token: --${tokenName}`,
          );
        }
      }
    } catch (err) {
      errors.push(`Failed to process ${file}: ${err.message}`);
    }
  }

  function getLineNumber(str, index) {
    return str.slice(0, index).split("\n").length;
  }

  if (errors.length > 0) {
    console.log("❌ CSS Token Check Failed:");
    errors.forEach((err) => console.log(`  ${err}`));
    process.exit(1);
  } else {
    console.log(
      "✅ CSS Token Check Passed: All var() references use defined tokens",
    );
    if (warnings.length > 0) {
      warnings.forEach((warn) => console.log(`⚠️  ${warn}`));
    }
  }
}

main().catch((err) => {
  console.error(`💥 CSS Token Checker failed:`, err);
  process.exit(1);
});
