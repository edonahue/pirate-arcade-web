/** @type {import('@lhci/cli').LighthouseCiConfig} */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "astro preview --port 4321",
      url: [
        "http://localhost:4321/",
        "http://localhost:4321/play/",
        "http://localhost:4321/play/cannonball-clash/",
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
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["warn", { minScore: 0.7 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:seo": ["warn", { minScore: 0.85 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 2000 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 3000 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.15 }],
        "speed-index": ["warn", { maxNumericValue: 3000 }],
        "server-response-time": ["warn", { maxNumericValue: 1000 }],
        interactive: ["warn", { maxNumericValue: 4000 }],
        "offscreen-images": ["warn", { maxNumericValue: 50000 }],
        "uses-responsive-images": ["warn", { maxNumericValue: 50000 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
