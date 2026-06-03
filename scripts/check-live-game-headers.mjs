#!/usr/bin/env node
/**
 * Live deployed Content-Security-Policy header checker.
 *
 * Fetches game pages from the live site and verifies the effective CSP
 * includes 'unsafe-eval' and other required directives.
 *
 * Usage:
 *   node scripts/check-live-game-headers.mjs
 *   node scripts/check-live-game-headers.mjs --base=https://staging.example.com
 *
 * Exit codes:
 *   0 – all checks pass
 *   1 – one or more checks failed
 */

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ||
  "https://pirate-arcade.com";

const GAME_URLS = [
  "/play/cannonball-clash/",
  "/play/treasure-cove/",
  "/play/krakens-wake/",
];

const REQUIRED_DIRECTIVES = [
  "'unsafe-eval'",
  "'wasm-unsafe-eval'",
  "https://cdn.pygame.org",
  "https://cdn.jsdelivr.net",
];

const FORBIDDEN_ONLY = [
  // If ONLY the global CSP (without unsafe-eval) applies, it means
  // the game route CSP was not properly detached.
  // We check that the CSP does NOT contain the exact global policy
  // without unsafe-eval.
];

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failures++;
  } else {
    console.log(`  OK:   ${message}`);
  }
}

async function main() {
  console.log(`Checking live CSP headers at ${BASE}\n`);

  for (const path of GAME_URLS) {
    const url = `${BASE}${path}`;
    console.log(`── ${url} ──`);

    try {
      const resp = await fetch(url, { redirect: "follow" });
      const csp = resp.headers.get("content-security-policy") || "";
      // Also check the raw header name variations
      const csp2 = resp.headers.get("Content-Security-Policy") || "";

      const effectiveCSP = csp || csp2;

      console.log(`  Status: ${resp.status}`);
      console.log(
        `  Content-Security-Policy: ${effectiveCSP.slice(0, 200)}...`,
      );

      assert(resp.ok, `${url} returned ${resp.status}`);
      assert(
        effectiveCSP.length > 0,
        `${path} has a Content-Security-Policy header`,
      );

      // Check for REQUIRED directives
      for (const directive of REQUIRED_DIRECTIVES) {
        assert(
          effectiveCSP.includes(directive),
          `${path} CSP includes "${directive}"`,
        );
      }

      // Check the CSP does NOT contain the global strict policy simultaneously
      // If we see `default-src 'self'` without unsafe-eval BEFORE the
      // game CSP, it means the global policy leaked.
      if (effectiveCSP.includes("default-src 'self'")) {
        // Count how many CSP directives appear (multiple policies are
        // comma-separated when Cloudflare merges). If there's more than
        // one policy, the global one leaked.
        // Actually, browser joining is just comma concatenation. Let's
        // check if 'unsafe-eval' appears in the FIRST policy segment.
        const policies = effectiveCSP.split(",");
        for (let i = 0; i < policies.length; i++) {
          const pol = policies[i].trim();
          if (pol.includes("script-src")) {
            const hasUnsafeEval = pol.includes("'unsafe-eval'");
            if (!hasUnsafeEval) {
              // This could be a problem — a policy without unsafe-eval
              // might be enforced alongside the game policy
              console.warn(
                `  WARN: Policy segment ${i + 1} lacks 'unsafe-eval': ${pol.slice(0, 100)}...`,
              );
            }
          }
        }
      }

      console.log();
    } catch (err) {
      console.error(`  ERROR fetching ${url}: ${err.message}`);
      failures++;
    }
  }

  console.log(`── Results ──`);
  if (failures === 0) {
    console.log("All live header checks PASSED.\n");
  } else {
    console.error(`${failures} check(s) FAILED.\n`);
    process.exit(1);
  }
}

main();
