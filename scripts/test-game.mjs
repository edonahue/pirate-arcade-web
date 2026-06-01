import { chromium } from "playwright";
import { spawn, execSync } from "child_process";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = parseInt(process.env.TEST_PORT || "4328", 10);
const PREVIEW_URL = `http://localhost:${PORT}`;
const PROTOTYPE_URL = `${PREVIEW_URL}/play/cannonball-clash/`;
const NODE_BIN = resolve(process.execPath, "..");

// Build + serve
execSync(`PATH="${NODE_BIN}:${process.env.PATH}" npm run build`, {
  cwd: ROOT,
  stdio: "pipe",
  shell: true,
});
const server = spawn("npx", ["astro", "preview", "--port", String(PORT)], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
  env: { ...process.env, PATH: `${NODE_BIN}:${process.env.PATH}` },
});
await new Promise((resolve_) => {
  const onData = (chunk) => {
    if (
      chunk.toString().includes("Local") ||
      chunk.toString().includes("ready")
    )
      setTimeout(resolve_, 1000);
  };
  server.stdout.on("data", onData);
  server.stderr.on("data", onData);
  setTimeout(() => resolve_(), 15000);
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const allLogs = [];
page.on("console", (m) => {
  const t = m.text().substring(0, 500);
  if (
    t.includes("custom_site") ||
    t.includes("JS_INJECT") ||
    t.includes("VM.") ||
    t.includes("cross_file") ||
    t.includes("Error") ||
    t.includes("pygame") ||
    t.includes("fetch") ||
    t.includes("pip_install")
  )
    allLogs.push(`[${m.type()}] ${t}`);
});

await page.goto(PROTOTYPE_URL, {
  waitUntil: "load",
  timeout: 30000,
});

// Wait for the game to load (infobox changes from default to "loaded")
await page.waitForFunction(
  () => document.getElementById("infobox")?.innerText?.includes("loaded"),
  { timeout: 120000 },
);

// Short extra wait for a couple render frames
await new Promise((r) => setTimeout(r, 5000));

console.log("=== LOGS ===");
allLogs.forEach((l) => console.log(l));

const state = await page
  .evaluate(() => {
    const canvas = document.getElementById("canvas");
    let pixels = null;
    let hasContent = false;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        hasContent = data.some((v) => v !== 0);
        pixels = `${canvas.width}x${canvas.height} ${hasContent ? "non-zero pixels" : "all black"}`;
      }
    }
    return {
      infoboxText: (
        document.getElementById("infobox")?.innerText || ""
      ).substring(0, 300),
      canvasVis: canvas?.style?.visibility || "none",
      canvasPixels: pixels,
    };
  })
  .catch((e) => ({ error: e.message }));

console.log("\n=== STATE ===");
console.log(JSON.stringify(state, null, 2));

const tests = [];
tests.push({
  name: "infobox loaded",
  pass: state.infoboxText?.includes("loaded"),
});
tests.push({ name: "canvas visible", pass: state.canvasVis === "visible" });
tests.push({
  name: "canvas has content",
  pass: state.canvasPixels?.includes("non-zero"),
});

let passed = 0,
  failed = 0;
for (const t of tests) {
  if (t.pass) {
    console.log(`  PASS  ${t.name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${t.name}`);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.kill("SIGTERM");
process.exit(failed > 0 ? 1 : 0);
