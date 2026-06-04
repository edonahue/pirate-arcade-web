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
  },
  use: {
    baseURL: "http://127.0.0.1:4327",
    actionTimeout: 10000,
    navigationTimeout: 30000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
