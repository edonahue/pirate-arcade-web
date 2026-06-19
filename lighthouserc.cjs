/** @type {import('@lhci/cli').LighthouseCiConfig} */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "astro preview --port 4321",
      url: [
        "http://localhost:4321/",
        "http://localhost:4321/play/",
        "http://localhost:4321/play/cannonball-clash/",
        "http://localhost:4321/play/treasure-cove/",
        "http://localhost:4321/play/krakens-wake/",
        "http://localhost:4321/play/race-to-treasure-island/",
        "http://localhost:4321/games/cannonball-clash/",
        "http://localhost:4321/about/",
      ],
      numberOfRuns: 2,
      settings: {
        preset: "desktop",
        extraHeaders: {
          "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124"',
        },
      },
    },
    assert: {
      // CI smoke/baseline thresholds — NOT final performance budgets.
      // These verify Lighthouse executes and produces reports in CI.
      // Route-specific static budgets are handled by check-performance-budgets.mjs.
      // Stronger thresholds must be calibrated from stored CI artifacts.
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["warn", { minScore: 0.5 }],
        "categories:best-practices": ["warn", { minScore: 0.5 }],
        "categories:seo": ["warn", { minScore: 0.5 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 5000 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 5000 }],
        "total-blocking-time": ["warn", { maxNumericValue: 1000 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 1.0 }],
        "speed-index": ["warn", { maxNumericValue: 5000 }],
        "server-response-time": ["warn", { maxNumericValue: 2000 }],
        interactive: ["warn", { maxNumericValue: 5000 }],
        "offscreen-images": ["warn", { maxNumericValue: 100000 }],
        "uses-responsive-images": ["warn", { maxNumericValue: 100000 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
