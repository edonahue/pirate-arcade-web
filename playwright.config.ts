import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html"], ["list"]],
  timeout: 120000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixels: 500,
      animations: "disabled",
    },
  },
  use: {
    baseURL: "http://127.0.0.1:4327",
    actionTimeout: 10000,
    navigationTimeout: 30000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4327",
    url: "http://127.0.0.1:4327",
    reuseExistingServer: true,
    timeout: 180000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
    // iPad projects for touch clarity / layout testing
    {
      name: "ipad-safari",
      use: { ...devices["iPad (gen 7)"] },
    },
    {
      name: "ipad-landscape",
      use: {
        ...devices["iPad (gen 7)"],
        viewport: { width: 1024, height: 768 },
      },
    },
    // Mobile projects above use Playwright device descriptors (Pixel 5
    // and iPhone 13) as a smoke-test baseline, but emulation is NOT a
    // substitute for real-device testing. Real iOS Safari has stricter
    // audio policies, different WASM JIT behavior, and unique touch
    // timing that emulation does not reproduce. See TESTING.md for the
    // manual real-device checklist and the iOS-specific gotchas.
  ],
});
