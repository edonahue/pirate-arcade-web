import { describe, it, expect } from "vitest";
import { resolveChromePath } from "../../scripts/run-lhci.mjs";

const existsYes = () => true;
const existsNo = () => false;

describe("run-lhci browser resolution", () => {
  it("preserves an explicit CHROME_PATH untouched", () => {
    const result = resolveChromePath({
      explicitPath: "/usr/bin/google-chrome",
      playwrightPath: "/home/user/.cache/ms-playwright/chromium-1/chrome",
      exists: existsYes,
    });
    expect(result.chromePath).toBe("/usr/bin/google-chrome");
  });

  it("selects installed Playwright Chromium when unset", () => {
    const candidate = "/home/user/.cache/ms-playwright/chromium-1/chrome";
    const result = resolveChromePath({
      explicitPath: undefined,
      playwrightPath: candidate,
      exists: (p) => p === candidate,
    });
    expect(result.chromePath).toBe(candidate);
  });

  it("falls through to LHCI autodiscovery when nothing is available", () => {
    const result = resolveChromePath({
      explicitPath: undefined,
      playwrightPath: undefined,
      exists: existsNo,
    });
    expect(result.chromePath).toBeUndefined();
  });

  it("ignores a Playwright path whose binary is absent", () => {
    const result = resolveChromePath({
      explicitPath: undefined,
      playwrightPath: "/home/user/.cache/ms-playwright/chromium-9/chrome",
      exists: existsNo,
    });
    expect(result.chromePath).toBeUndefined();
  });
});
