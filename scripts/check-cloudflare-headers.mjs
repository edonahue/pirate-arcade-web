#!/usr/bin/env node
/**
 * Static Cloudflare Pages _headers parser and validator.
 *
 * Parses public/_headers, simulates Cloudflare's matching and inheritance
 * algorithm, and asserts correct CSP for game vs non-game routes.
 *
 * Pygbag games require CSP with `unsafe-eval` and `wasm-unsafe-eval`.
 * Web-native (Phaser) games use the global strict CSP.
 *
 * Cloudflare Pages _headers algorithm:
 *  1. Find all route patterns that match the URL.
 *  2. Sort by "specificity" — longest literal prefix wins. Ties broken
 *     by order (later rule = higher priority).
 *  3. Apply rules from LEAST specific to MOST specific:
 *     - A header set by a more-specific rule overrides the same header
 *       from a less-specific rule.
 *     - A `!` detach in a more-specific rule prevents that header from
 *       being inherited from any less-specific rule.
 *     - Any header NOT mentioned in a specific rule is inherited from
 *       the most specific rule that does mention it.
 *
 * Exit codes:
 *  0 — all checks pass
 *  1 — one or more assertions failed
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Read canonical game list from games.json
const gamesMeta = JSON.parse(
  readFileSync(resolve(ROOT, "src/data/games.json"), "utf-8"),
);
const PYGAMES = gamesMeta.filter(
  (g) =>
    g.status === "browser-playable" && (!g.engine || g.engine === "pygbag"),
);
const WEB_NATIVE = gamesMeta.filter(
  (g) => g.status === "browser-playable" && g.engine === "phaser",
);

const HEADERS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "_headers",
);

// ── Data structures ──────────────────────────────────────────────────

/**
 * @typedef {Object} HeaderRule
 * @property {string} pattern - The URL pattern (e.g. "/*", "/play/cannonball-clash/*")
 * @property {string} literalPrefix - The literal part before the first `*`
 * @property {boolean} hasGlob - Whether pattern has `*`
 * @property {Map<string, string>} setHeaders - header name (lowercase) → value
 * @property {Set<string>} detachHeaders - header names to detach (! prefix)
 */

// ── Parsing ──────────────────────────────────────────────────────────

/**
 * Parse the _headers file into an array of HeaderRule.
 * Returns rules in file order.
 */
function parseHeadersFile(content) {
  const lines = content.split("\n");
  const rules = [];
  let currentPattern = null;
  let currentSetHeaders = null;
  let currentDetachHeaders = null;

  function flushRule() {
    if (currentPattern && currentSetHeaders) {
      rules.push(
        buildRule(currentPattern, currentSetHeaders, currentDetachHeaders),
      );
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Empty lines and comments flush the current rule
    if (trimmed === "" || trimmed.startsWith("#")) {
      flushRule();
      currentPattern = null;
      currentSetHeaders = null;
      currentDetachHeaders = null;
      continue;
    }

    // Line starts with space/tab => header directive
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (!currentSetHeaders) continue; // Ignore header without a route

      const isDetach = trimmed.startsWith("!");
      const withoutBang = isDetach ? trimmed.slice(1).trim() : trimmed;
      const colonIdx = withoutBang.indexOf(":");

      if (isDetach) {
        const name = withoutBang.toLowerCase();
        if (name.length > 0) {
          currentDetachHeaders.add(name);
        }
      } else if (colonIdx !== -1) {
        const name = withoutBang.slice(0, colonIdx).trim().toLowerCase();
        const value = withoutBang.slice(colonIdx + 1).trim();
        currentSetHeaders.set(name, value);
      } else {
        console.warn(`  [warn] malformed header line: ${trimmed}`);
      }
    } else {
      // Route pattern line
      flushRule();
      currentPattern = trimmed;
      currentSetHeaders = new Map();
      currentDetachHeaders = new Set();
    }
  }

  // Last rule
  flushRule();

  return rules;
}

function buildRule(pattern, setHeaders, detachHeaders) {
  const starIdx = pattern.indexOf("*");
  const hasGlob = starIdx !== -1;
  const literalPrefix = hasGlob ? pattern.slice(0, starIdx) : pattern;
  return { pattern, literalPrefix, hasGlob, setHeaders, detachHeaders };
}

// ── URL matching ─────────────────────────────────────────────────────

/**
 * Does a _headers pattern match a given URL path?
 */
function patternMatchesUrl(pattern, urlPath) {
  if (!pattern.hasGlob) {
    return pattern.literalPrefix === urlPath;
  }
  return urlPath.startsWith(pattern.literalPrefix);
}

// ── Compute effective headers ────────────────────────────────────────

/**
 * Compute effective headers for a URL path following Cloudflare's algorithm.
 */
function computeEffectiveHeaders(urlPath, rules) {
  const matching = rules.filter((r) => patternMatchesUrl(r, urlPath));

  if (matching.length === 0) {
    return new Map();
  }

  matching.sort((a, b) => {
    const lenDiff = b.literalPrefix.length - a.literalPrefix.length;
    if (lenDiff !== 0) return lenDiff;
    if (a.hasGlob !== b.hasGlob) return a.hasGlob ? 1 : -1;
    return 0;
  });

  const effective = new Map();
  const blocked = new Set();

  for (const rule of matching) {
    for (const [name, value] of rule.setHeaders) {
      if (!effective.has(name) && !blocked.has(name)) {
        effective.set(name, value);
      }
    }

    for (const name of rule.detachHeaders) {
      blocked.add(name);
    }
  }

  return effective;
}

// ── Assertions ───────────────────────────────────────────────────────

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failures++;
  } else {
    console.log(`  OK:   ${message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const content = readFileSync(HEADERS_PATH, "utf-8");
  const rules = parseHeadersFile(content);

  console.log(`Parsed ${rules.length} route rules from ${HEADERS_PATH}\n`);

  // ── Rule-level checks: Pygbag games ──

  const pygbagPatterns = PYGAMES.flatMap((g) => [
    `/play/${g.id}/`,
    `/play/${g.id}/index.html`,
    `/play/${g.id}/*`,
  ]);

  for (const pat of pygbagPatterns) {
    const rule = rules.find((r) => r.pattern === pat);

    assert(rule != null, `Pygbag route "${pat}" exists`);

    if (rule) {
      assert(
        rule.detachHeaders.has("content-security-policy"),
        `"${pat}" detaches (with !) the inherited Content-Security-Policy`,
      );

      const csp = rule.setHeaders.get("content-security-policy");
      assert(csp != null, `"${pat}" sets its own Content-Security-Policy`);

      if (csp) {
        assert(
          csp.includes("'unsafe-eval'"),
          `"${pat}" CSP includes 'unsafe-eval'`,
        );
        assert(
          csp.includes("'wasm-unsafe-eval'"),
          `"${pat}" CSP includes 'wasm-unsafe-eval'`,
        );
        assert(
          csp.includes("https://cdn.pygame.org"),
          `"${pat}" CSP includes https://cdn.pygame.org in connect-src`,
        );
        assert(
          csp.includes("https://cdn.jsdelivr.net"),
          `"${pat}" CSP includes https://cdn.jsdelivr.net in script-src`,
        );
        assert(
          csp.includes("https://static.cloudflareinsights.com"),
          `"${pat}" CSP includes https://static.cloudflareinsights.com in script-src`,
        );
        assert(
          csp.includes("connect-src 'self'"),
          `"${pat}" CSP retains 'self' in connect-src`,
        );
      }
    }
  }

  // ── Web-native games should NOT have CSP entries ──

  for (const game of WEB_NATIVE) {
    for (const suffix of ["/", "/index.html", "/*"]) {
      const pat = `/play/${game.id}${suffix}`;
      const rule = rules.find((r) => r.pattern === pat);
      if (rule) {
        console.log(
          `  INFO: "${pat}" has CSP entry (web-native — will use global CSP if detached properly)`,
        );
      } else {
        console.log(
          `  OK:   "${pat}" no CSP entry (web-native, uses global CSP)`,
        );
      }
    }
  }

  // Global route
  const globalRule = rules.find((r) => r.pattern === "/*");
  assert(globalRule != null, 'Global route "/*" exists');
  if (globalRule) {
    const csp = globalRule.setHeaders.get("content-security-policy");
    assert(csp != null, '"/*" has a Content-Security-Policy');
    if (csp) {
      assert(
        !csp.includes("'unsafe-eval'"),
        '"/*" CSP does NOT contain unsafe-eval (strict for non-game routes)',
      );
      assert(
        csp.includes("'wasm-unsafe-eval'"),
        '"/*" CSP includes wasm-unsafe-eval',
      );
      assert(
        csp.includes("https://static.cloudflareinsights.com"),
        '"/*" CSP includes https://static.cloudflareinsights.com in script-src',
      );
      assert(
        csp.includes("connect-src 'self'"),
        "\"/*\" CSP retains 'self' in connect-src",
      );
    }
  }

  // ── Effective header computation ──

  console.log("\n── Effective CSP per URL ──\n");

  // Build test cases dynamically from games.json
  const testCases = [
    { url: "/", expectUnsafeEval: false, desc: "site root" },
    { url: "/play/", expectUnsafeEval: false, desc: "arcade index" },
    ...PYGAMES.flatMap((g) => [
      {
        url: `/play/${g.id}/`,
        expectUnsafeEval: true,
        desc: `${g.id} directory index`,
      },
      {
        url: `/play/${g.id}/index.html`,
        expectUnsafeEval: true,
        desc: `${g.id} explicit HTML`,
      },
      {
        url: `/play/${g.id}/${g.id}.tar.gz`,
        expectUnsafeEval: true,
        desc: `${g.id} sub-resource`,
      },
    ]),
    ...WEB_NATIVE.flatMap((g) => [
      {
        url: `/play/${g.id}/`,
        expectUnsafeEval: false,
        desc: `${g.id} (web-native) directory index`,
      },
    ]),
    { url: "/about/", expectUnsafeEval: false, desc: "non-game route" },
  ];

  // Get first Pygbag game CSP for comparison
  const anyGameCSP =
    PYGAMES.length > 0
      ? rules
          .find((r) => r.pattern === `/play/${PYGAMES[0].id}/*`)
          ?.setHeaders.get("content-security-policy") || ""
      : "";

  for (const tc of testCases) {
    const effective = computeEffectiveHeaders(tc.url, rules);
    const csp = effective.get("content-security-policy") || "";

    assert(effective.size > 0, `${tc.desc} (${tc.url}) has headers`);

    // All effective CSPs must allow Cloudflare Insights script origin
    assert(
      csp.includes("https://static.cloudflareinsights.com"),
      `${tc.desc} (${tc.url}) effective CSP includes https://static.cloudflareinsights.com in script-src`,
    );
    // All effective CSPs must retain 'self' in connect-src
    assert(
      csp.includes("connect-src 'self'"),
      `${tc.desc} (${tc.url}) effective CSP retains 'self' in connect-src`,
    );

    if (tc.expectUnsafeEval) {
      assert(
        csp.includes("'unsafe-eval'"),
        `${tc.desc} (${tc.url}) effective CSP includes 'unsafe-eval'`,
      );
      assert(
        csp.includes("'wasm-unsafe-eval'"),
        `${tc.desc} (${tc.url}) effective CSP includes 'wasm-unsafe-eval'`,
      );
      assert(
        csp.includes("https://cdn.pygame.org"),
        `${tc.desc} (${tc.url}) effective CSP includes cdn.pygame.org`,
      );
      if (anyGameCSP) {
        assert(
          csp === anyGameCSP,
          `${tc.desc} (${tc.url}) effective CSP is exactly the game CSP, not merged with global CSP`,
        );
      }
    } else {
      assert(
        !csp.includes("'unsafe-eval'"),
        `${tc.desc} (${tc.url}) effective CSP does NOT include 'unsafe-eval'`,
      );
    }
  }

  // ── Other headers inherit correctly ──
  console.log("\n── Non-CSP header inheritance ──\n");

  const firstPygame = PYGAMES.length > 0 ? PYGAMES[0] : null;
  const gameUrl = firstPygame ? `/play/${firstPygame.id}/` : "/";
  const gHeaders = computeEffectiveHeaders(gameUrl, rules);

  assert(
    gHeaders.get("strict-transport-security") != null,
    `"${gameUrl}" inherits Strict-Transport-Security from global rule`,
  );
  assert(
    gHeaders.get("x-content-type-options") != null,
    `"${gameUrl}" inherits X-Content-Type-Options from global rule`,
  );
  assert(
    gHeaders.get("referrer-policy") != null,
    `"${gameUrl}" inherits Referrer-Policy from global rule`,
  );

  console.log(`\n── Results ──`);
  if (failures === 0) {
    console.log("All Cloudflare headers checks PASSED.\n");
  } else {
    console.error(`${failures} assertion(s) FAILED.\n`);
    process.exit(1);
  }
}

main();
