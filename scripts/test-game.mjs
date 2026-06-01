import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const allLogs = [];
page.on('console', m => {
  const t = m.text().substring(0,500);
  if (t.includes('custom_site') || t.includes('JS_INJECT') || t.includes('VM.') || 
      t.includes('cross_file') || t.includes('Error') || t.includes('pygame') ||
      t.includes('fetch') || t.includes('pip_install'))
    allLogs.push(`[${m.type()}] ${t}`);
});

await page.goto('http://localhost:4327/play/cannonball-clash/', { waitUntil: 'load', timeout: 30000 });

// Wait for the game to load (infobox changes from default to "loaded")
await page.waitForFunction(
  () => document.getElementById('infobox')?.innerText?.includes('loaded'),
  { timeout: 120000 }
);

// Short extra wait for a couple render frames
await new Promise(r => setTimeout(r, 5000));

console.log('=== LOGS ===');
allLogs.forEach(l => console.log(l));

const state = await page.evaluate(() => {
  const canvas = document.getElementById('canvas');
  let pixels = null;
  let hasContent = false;
  if (canvas && canvas.width > 0 && canvas.height > 0) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      hasContent = data.some(v => v !== 0);
      pixels = `${canvas.width}x${canvas.height} ${hasContent ? 'non-zero pixels' : 'all black'}`;
    }
  }
  return {
    infoboxText: (document.getElementById('infobox')?.innerText || '').substring(0,300),
    canvasVis: canvas?.style?.visibility || 'none',
    canvasPixels: pixels,
  };
}).catch(e => ({ error: e.message }));

console.log('\n=== STATE ===');
console.log(JSON.stringify(state, null, 2));

const tests = [];
tests.push({ name: 'infobox loaded', pass: state.infoboxText?.includes('loaded') });
tests.push({ name: 'canvas visible', pass: state.canvasVis === 'visible' });
tests.push({ name: 'canvas has content', pass: state.canvasPixels?.includes('non-zero') });

let passed = 0, failed = 0;
for (const t of tests) {
  if (t.pass) { console.log(`  PASS  ${t.name}`); passed++; }
  else { console.log(`  FAIL  ${t.name}`); failed++; }
}
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
