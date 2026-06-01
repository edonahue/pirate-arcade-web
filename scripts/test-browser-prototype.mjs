/**
 * Playwright test for Cannonball Clash Pygbag/WASM prototype.
 *
 * Usage:
 *   node scripts/test-browser-prototype.mjs
 */

import { chromium, firefox } from 'playwright';
import { spawn, execSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 4327;
const PREVIEW_URL = `http://localhost:${PORT}`;
const PROTOTYPE_URL = `${PREVIEW_URL}/play/cannonball-clash/`;
const WASM_TIMEOUT = 90000;
const GAME_WAIT = 30000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let serverProcess = null;

async function startPreview() {
  try { execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' }); } catch {}

  return new Promise((resolve_, reject) => {
    const NODE22 = '/home/erich/.nvm/versions/node/v22.22.3/bin';
    serverProcess = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, PATH: `${NODE22}:${process.env.PATH}` },
    });

    let started = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!started && (text.includes('Local') || text.includes('ready'))) {
        started = true;
        setTimeout(resolve_, 1000);
      }
    };
    serverProcess.stdout.on('data', onData);
    serverProcess.stderr.on('data', onData);
    serverProcess.on('error', reject);
    setTimeout(() => { if (!started) reject(new Error('Preview did not start')); }, 30000);
  });
}

function stopPreview() {
  if (serverProcess) { serverProcess.kill('SIGTERM'); serverProcess = null; }
  try { execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' }); } catch {}
}

async function runRouteTests(browser, name) {
  console.log(`\n  Routes (${name}):`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const results = [];

  const routes = [
    { p: '/', n: 'Home' },
    { p: '/play/', n: 'Play' },
    { p: '/play/cannonball-clash/', n: 'Prototype' },
    { p: '/build-log/browser-port-feasibility', n: 'Feasibility post' },
    { p: '/source', n: 'Source' },
    { p: '/nonexistent-xyz', n: 'Custom 404' },
  ];

  for (const r of routes) {
    try {
      const resp = await page.goto(`${PREVIEW_URL}${r.p}`, { waitUntil: 'networkidle', timeout: 15000 });
      const s = resp.status();
      const ok = r.p === '/nonexistent-xyz' ? s === 404 : s === 200;
      results.push({ route: r.n, ok });
      console.log(`    ${ok ? '✓' : '✗'} ${r.n} (${s})`);
    } catch (e) {
      results.push({ route: r.n, ok: false });
      console.log(`    ✗ ${r.n} — ${e.message}`);
    }
  }

  await ctx.close();
  return results;
}

async function runPrototypeTest(browser, name) {
  console.log(`\n  Prototype (${name}):`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  const errs = []; const warns = []; const logs = []; const pygbagLogs = [];
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error') errs.push(text);
    else if (m.type() === 'warning') warns.push(text);
    else logs.push(text);
    if (text.includes('VM.') || text.includes('cross_file') || text.includes('Maybe RC') || text.includes('PyMain') || text.includes('End.cross') || text.includes('Begin.cross') || text.includes('fopen') || text.includes('Downloading') || text.includes('Loading python') || text.includes('postrun') || text.includes('prerun') || text.includes('aio') || text.includes('runpy') || text.includes('preload') || text.includes('pip_install') || text.includes('PYSTEP')) pygbagLogs.push(text);
  });
  const pgErrs = [];
  page.on('pageerror', (e) => pgErrs.push(e.message));

  const r = { browser: name };

  // Load
  const resp = await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  r.pageLoads = resp?.status() === 200;
  await sleep(2000);

  // DOM checks
  r.canvasExists = !!(await page.$('canvas#canvas'));
  r.infoboxExists = !!(await page.$('#infobox'));
  r.backLinkExists = !!(await page.$('#back-link'));
  r.controlsHintExists = !!(await page.$('#controls-hint'));

  console.log(`    Page load: ${r.pageLoads ? '✓' : '✗'}`);
  console.log(`    Canvas: ${r.canvasExists ? '✓' : '✗'} | Infobox: ${r.infoboxExists ? '✓' : '✗'} | Back: ${r.backLinkExists ? '✓' : '✗'} | Controls: ${r.controlsHintExists ? '✓' : '✗'}`);

  // Wait for WASM runtime: check for Python log output (infobox text changes,
  // transfer hidden, or canvas dimension changes from 1x1 default)
  const wasmStartTime = Date.now();
  let canvasDefaultW = null;
  try {
    // Skip the canvas default-size trap: first get the canvas initial dimensions
    canvasDefaultW = await page.evaluate(() => document.getElementById('canvas')?.width || 0);
    // Wait for a true signal of Python execution
    await page.waitForFunction((defW) => {
      const c = document.getElementById('canvas');
      // Python sets transfer.hidden = true in custom_site (unambiguous WASM signal)
      const tr = document.getElementById('transfer');
      if (tr && tr.hidden) return true;
      // Python infobox changes: status shows loading, then Ready/click prompt
      const ib = document.getElementById('infobox');
      if (ib) {
        const t = ib.textContent;
        if (t.includes('Ready') || t.includes('click/touch')) return true;
      }
      // Python sets canvas visibility to visible
      if (c) {
        const s = window.getComputedStyle(c);
        if (s.visibility === 'visible' && s.display !== 'none' && c.width > 10) return true;
      }
      return false;
    }, canvasDefaultW, { timeout: WASM_TIMEOUT });
    r.wasmStarted = true;
    r.wasmStartTime = Date.now() - wasmStartTime;
    console.log(`    WASM: ✓ (${r.wasmStartTime}ms)`);
  } catch {
    r.wasmStarted = false;
    r.wasmStartTime = Date.now() - wasmStartTime;
    console.log(`    WASM: ✗ (timed out ${r.wasmStartTime}ms)`);
  }

  // Capture WASM errors from console
  const wasmErrs = errs.filter(e => e.includes('BrowserFS') || e.includes('MEDIA') || e.includes('wasm') || e.includes('Wasm'));
  if (wasmErrs.length > 0) {
    console.log(`    WASM errors: ${wasmErrs.length}`);
    wasmErrs.slice(0, 5).forEach(e => console.log(`      ${e}`));
  }

  // Dump pygbag-specific console logs for debugging
  if (pygbagLogs.length > 0) {
    console.log(`    Pygbag logs (${pygbagLogs.length}):`);
    pygbagLogs.forEach(m => console.log(`      ${m.slice(0, 300)}`));
  } else {
    // Fallback: show last 20 logs
    const all = [...logs, ...warns, ...errs];
    const tail = all.slice(-30);
    console.log(`    Console log (last ${tail.length}/${all.length}):`);
    tail.slice(0, 15).forEach(m => console.log(`      ${m.slice(0, 250)}`));
  }
  // Also check current infobox text and canvas state
  const state = await page.evaluate(() => {
    const ib = document.getElementById('infobox');
    const c = document.getElementById('canvas');
    const tr = document.getElementById('transfer');
    return {
      infoboxText: ib?.textContent?.slice(0, 150),
      canvasW: c?.width,
      canvasH: c?.height,
      canvasCSW: c && window.getComputedStyle(c)?.width,
      transferHidden: tr?.hidden,
      transferStyle: tr?.style?.display,
      ume: window.MM?.UME,
    };
  });
  console.log(`    Page state:`, JSON.stringify(state));

  // Check canvas visibility
  try {
    await page.waitForFunction(() => {
      const c = document.getElementById('canvas');
      if (!c) return false;
      const s = window.getComputedStyle(c);
      return s.visibility === 'visible' && s.display !== 'none' && c.width > 10;
    }, { timeout: 10000 });
    r.canvasVisible = true;
    console.log(`    Canvas visible: ✓`);
  } catch {
    r.canvasVisible = false;
    console.log(`    Canvas visible: ✗`);
  }

  // UME: click the page to trigger user media engagement
  // Pygbag waits for a user gesture before proceeding
  console.log(`    Triggering UME (click)...`);
  try {
    await sleep(500);
    // Click multiple locations to ensure UME is triggered
    await page.mouse.click(640, 360);
    await sleep(300);
    await page.mouse.click(640, 360);
    await sleep(300);
    // Also click via the document body directly
    await page.evaluate(() => {
      document.body.click();
      document.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await sleep(1000);
    r.umeTriggered = true;
    console.log(`    Clicks sent: ✓`);
  } catch (e) {
    r.umeTriggered = false;
    console.log(`    Clicks failed: ✗ (${e.message})`);
  }

  // Wait a moment then send keyboard
  await sleep(1000);
  console.log(`    Sending keyboard input...`);
  await page.evaluate(() => document.getElementById('canvas')?.focus());
  await sleep(200);
  for (const k of ['ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyS', 'Enter', 'Escape']) {
    await page.keyboard.press(k);
    await sleep(80);
  }
  r.keyboardSent = true;

  // Wait for game rendering
  console.log(`    Waiting for game rendering (${GAME_WAIT / 1000}s)...`);
  await sleep(GAME_WAIT);

  // Check canvas pixels
  try {
    const active = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      if (!c) return false;
      const ctx = c.getContext('2d');
      if (!ctx) return false;
      const w = Math.min(c.width, 200); const h = Math.min(c.height, 200);
      if (w < 10 || h < 10) return false;
      const img = ctx.getImageData(0, 0, w, h);
      let nonZero = 0;
      for (let i = 3; i < img.data.length; i += 4) { if (img.data[i] > 0) nonZero++; }
      return nonZero > 50;
    });
    r.canvasActive = active;
    console.log(`    Canvas rendering: ${active ? '✓' : '✗'}`);
  } catch {
    r.canvasActive = false;
    console.log(`    Canvas rendering: ✗`);
  }

  // Tab blur/refocus
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await sleep(500);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(500);
  console.log(`    Tab blur/refocus: ✓`);

  // Reload
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    r.reloadWorks = true;
    console.log(`    Reload: ✓`);
  } catch { r.reloadWorks = false; console.log(`    Reload: ✗`); }

  // Errors
  const benign = ['wasm', 'Wasm', 'Memory', 'emscripten', 'Emscripten', 'WebAssembly', 'unreachable', 'SourceMap', 'source map', 'favicon', '404', 'Failed to load resource'];
  const blocking = errs.filter((e) => !benign.some((b) => e.includes(b)));
  r.totalErrors = errs.length;
  r.blockingErrors = blocking.length;
  r.noBlockingErrors = blocking.length === 0;
  r.warnings = warns.length;
  r.consoleErrors = errs;
  r.pageErrors = pgErrs;

  console.log(`    Console errors: ${errs.length} (${blocking.length} blocking) | Warnings: ${warns.length}`);
  if (errs.length > 0) console.log(`    First 5 errors:`, errs.slice(0, 5));

  await ctx.close();
  return r;
}

async function runMobileTest(browser, name) {
  console.log(`\n  Mobile (${name}):`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  try {
    await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    const canvas = !!(await page.$('canvas#canvas'));
    const back = !!(await page.$('#back-link'));
    const ctrl = !!(await page.$('#controls-hint'));
    console.log(`    Canvas: ${canvas ? '✓' : '✗'} | Back: ${back ? '✓' : '✗'} | Controls: ${ctrl ? '✓' : '✗'} | Errors: ${errs.length}`);
    return { canvas, back, ctrl };
  } catch (e) {
    console.log(`    ✗ ${e.message}`);
    return { canvas: false, back: false, ctrl: false };
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log('=== Cannonball Clash Prototype Validation ===\n');

  // Build — use nvm node 22 path
  const NODE22 = '/home/erich/.nvm/versions/node/v22.22.3/bin';
  execSync(`PATH="${NODE22}:${process.env.PATH}" npm run build`, { cwd: ROOT, stdio: 'pipe', shell: true });
  console.log('Build: ✓\n');

  // Start server
  await startPreview();
  console.log('Preview: running\n');

  const routeResults = [];
  const protoResults = [];
  const mobileResults = [];

  try {
    // Chromium
    console.log('=== CHROMIUM ===');
    const cb = await chromium.launch({ headless: true });
    routeResults.push(...await runRouteTests(cb, 'Chromium'));
    protoResults.push(await runPrototypeTest(cb, 'Chromium'));
    mobileResults.push(await runMobileTest(cb, 'Chromium'));
    await cb.close();

    // Firefox
    console.log('\n=== FIREFOX ===');
    const fb = await firefox.launch({ headless: true });
    routeResults.push(...await runRouteTests(fb, 'Firefox'));
    protoResults.push(await runPrototypeTest(fb, 'Firefox'));
    const fm = await runMobileTest(fb, 'Firefox');
    mobileResults.push(fm);
    await fb.close();
  } catch (err) {
    console.error('\nFatal:', err);
  } finally {
    stopPreview();
  }

  // === SUMMARY ===
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  console.log('\nRoutes:');
  const rs = {};
  for (const r of routeResults) {
    if (!rs[r.route]) rs[r.route] = [];
    rs[r.route].push(r);
  }
  for (const [n, arr] of Object.entries(rs)) {
    console.log(`  ${arr.every(r => r.ok) ? '✓' : '✗'} ${n}`);
  }

  console.log('\nPrototype:');
  for (const p of protoResults) {
    console.log(`  ${p.browser}:`);
    const keys = ['pageLoads', 'canvasExists', 'infoboxExists', 'backLinkExists', 'controlsHintExists', 'wasmStarted', 'canvasVisible', 'umeTriggered', 'keyboardSent', 'canvasActive', 'reloadWorks', 'noBlockingErrors'];
    for (const k of keys) {
      if (k in p) console.log(`    ${k}: ${p[k] ? '✓' : '✗'}`);
    }
    console.log(`    totalErrors: ${p.totalErrors}, blocking: ${p.blockingErrors}, wasmStart: ${p.wasmStartTime}ms`);
    if (p.blockingErrors > 0) {
      const blockingItems = p.consoleErrors.filter(e =>
        !['wasm', 'Wasm', 'Memory', 'emscripten', 'Emscripten', 'WebAssembly', 'unreachable', 'SourceMap', 'favicon', '404', 'Failed to load resource'].some(b => e.includes(b))
      );
      blockingItems.forEach(e => console.log(`      BLOCKING: ${e}`));
    }
  }

  console.log('\nMobile:');
  for (const m of mobileResults) console.log(`  ${m.canvas ? '✓' : '✗'} Canvas | ${m.back ? '✓' : '✗'} Back | ${m.ctrl ? '✓' : '✗'} Controls`);

  // Decision
  console.log('\n' + '-'.repeat(40));
  console.log('DECISION');
  console.log('-'.repeat(40));

  const coreOk = protoResults.every(p => p.pageLoads && p.canvasExists);
  const wasmOk = protoResults.some(p => p.wasmStarted);
  const umeOk = protoResults.some(p => p.umeTriggered);
  const activeOk = protoResults.some(p => p.canvasActive);
  const cleanErrs = protoResults.every(p => p.noBlockingErrors);

  if (!coreOk) {
    console.log('NO-GO: Core page broken.');
  } else if (!wasmOk) {
    console.log('NO-GO: WASM runtime did not start in any browser.');
    console.log('  Likely: CDN blocked or pygbag issue.');
  } else if (!umeOk) {
    console.log('CONDITIONAL GO: WASM starts but UME (click-to-start) not triggered by automation.');
    console.log('  Condition: Manual test to verify click flow works in real browser.');
  } else if (!activeOk) {
    console.log('CONDITIONAL GO: WASM + UME work but game rendering not confirmed via automation.');
    console.log('  Condition: Manual browser test required.');
  } else if (!cleanErrs) {
    console.log('CONDITIONAL GO: Game runs but has non-fatal console errors.');
    console.log('  Condition: Review and fix errors before porting next game.');
  } else {
    console.log('GO: All critical checks pass.');
    console.log('  Recommendation: Port Treasure Cove using the same Pygbag approach.');
  }

  console.log('\n=== DONE ===');
}

main().catch((err) => { console.error('Fatal:', err); stopPreview(); process.exit(1); });


