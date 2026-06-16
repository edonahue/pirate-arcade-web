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
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.8 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 1500 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "total-blocking-time": ["warn", { maxNumericValue: 100 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "speed-index": ["warn", { maxNumericValue: 2000 }],
        "server-response-time": ["warn", { maxNumericValue: 800 }],
        interactive: ["warn", { maxNumericValue: 3000 }],
        "offscreen-images": ["warn", { maxNumericValue: 0 }],
        "uses-responsive-images": ["warn", { maxNumericValue: 0 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
