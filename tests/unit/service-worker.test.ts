import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function createMockEnv(): {
  self: Record<string, any>;
  caches: Record<string, any>;
  listeners: Record<string, Function[]>;
  console: { warn: ReturnType<typeof vi.fn> };
  results: { install: any[]; activate: any[]; message: any[] };
} {
  const listeners: Record<string, Function[]> = {};
  const mockConsole = { warn: vi.fn() };

  const mockCache = {
    _store: {} as Record<string, Response>,
    add: vi.fn(),
    put: vi.fn(),
    match: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  };

  const results = {
    install: [] as any[],
    activate: [] as any[],
    message: [] as any[],
  };

  const self: Record<string, any> = {
    location: { origin: "http://127.0.0.1:4327" },
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue([]),
    },
    console: mockConsole,
    caches: {
      open: vi.fn().mockResolvedValue(mockCache),
    },
    fetch: vi.fn(),
  };

  return {
    self,
    caches: { open: vi.fn().mockResolvedValue(mockCache) },
    listeners,
    console: mockConsole,
    results,
  };
}

function loadSw(env: ReturnType<typeof createMockEnv>): void {
  const code = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf-8");
  const fn = new Function(
    "self",
    code
      .replace("self.addEventListener", "___patchedAddEventListener")
      .replace("self.skipWaiting", "___skipWaiting"),
  );
  fn(env.self);
}

function extractInnerCode(swCode: string): string {
  return swCode
    .replace("const CACHE_VERSION =", "var CACHE_VERSION =")
    .replace("const CACHE_NAME =", "var CACHE_NAME =")
    .replace("const ASSETS_TO_CACHE =", "var ASSETS_TO_CACHE =");
}

describe("service-worker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sw.js uses url.origin === self.location.origin for origin check", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    expect(code).toContain(".origin !== self.location.origin");
    const hasPrefixCheck = code.includes(".startsWith(self.location.origin");
    expect(hasPrefixCheck).toBe(false);
  });

  it("sw.js does not swallow cache.add rejections with inner .catch", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    const addLines = code.split("\n").filter((l) => l.includes("cache.add("));
    for (const line of addLines) {
      expect(line).not.toContain(".catch(");
    }
  });

  it("sw.js caches fetched responses in cacheFirst with proper promise chain", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    const cacheFirstSection = code.slice(
      code.indexOf("function cacheFirst"),
      code.indexOf("function staleWhileRevalidate"),
    );
    expect(cacheFirstSection).toContain("cache.put(event.request, clone)");
    expect(cacheFirstSection).toContain("return caches");
    expect(cacheFirstSection).toContain(".then(() => res)");
  });

  it("sw.js awaits cache.put in warm fetch", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    if (code.includes("WARM_CACHE")) {
      const warmSection = code.slice(code.indexOf("WARM_CACHE"));
      const putMatch = warmSection.match(/await\s+cache\.put\([^)]+\)/);
      expect(putMatch).not.toBeNull();
    }
  });

  it("sw.js dedup stores actual promise for in-flight requests", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    const warmSection = code.includes("WARM_CACHE")
      ? code.slice(code.indexOf("WARM_CACHE"))
      : "";
    expect(warmSection).toContain("_warmInFlight[normalized]");
    const assignmentPattern = /_warmInFlight\[normalized\]\s*=\s*(?!true)(\w+)/;
    expect(assignmentPattern.test(warmSection)).toBe(true);
  });

  it("sw.js uses Promise.allSettled for install result counting", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    const installSection = code.slice(
      code.indexOf('addEventListener("install"'),
      code.indexOf('addEventListener("activate"'),
    );
    expect(installSection).toContain("Promise.allSettled");
    expect(installSection).toContain('r.status === "rejected"');
  });

  it("sw.js ASSETS_TO_CACHE includes page routes and shared scripts", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    const assetsMatch = code.match(/ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
    expect(assetsMatch).not.toBeNull();
    const assetsStr = assetsMatch![1];
    expect(assetsStr).toContain("/play/cannonball-clash/");
    expect(assetsStr).toContain("/play/treasure-cove/");
    expect(assetsStr).toContain("/play/krakens-wake/");
    expect(assetsStr).toContain("/play/shared/game-boot-metrics.js");
    expect(assetsStr).toContain("/favicon.svg");
  });

  it("sw.js does not cache archives in ASSETS_TO_CACHE", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    const assetsMatch = code.match(/ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
    expect(assetsMatch).not.toBeNull();
    const assetsStr = assetsMatch![1];
    expect(assetsStr).not.toContain(".tar.gz");
  });

  it("sw.js does not cache web-native games in ASSETS_TO_CACHE", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    const assetsMatch = code.match(/ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
    expect(assetsMatch).not.toBeNull();
    const assetsStr = assetsMatch![1];
    expect(assetsStr).not.toContain("race-to-treasure-island");
  });

  it("sw.js has isGameShell fetch strategy covering all Pygbag games", () => {
    const code = readFileSync(
      resolve(__dirname, "../../public/sw.js"),
      "utf-8",
    );
    expect(code).toContain("isGameShell");
    expect(code).toContain('startsWith("/play/cannonball-clash/")');
    expect(code).toContain('startsWith("/play/treasure-cove/")');
    expect(code).toContain('startsWith("/play/krakens-wake/")');
  });
});
