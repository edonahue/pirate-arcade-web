#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PYBAG_GAMES = ["cannonball-clash", "treasure-cove", "krakens-wake"];
const VISIBLE_TAG_NAMES = new Set([
  "STYLE",
  "SCRIPT",
  "TEMPLATE",
  "PRE",
  "CODE",
]);

const INLINE_SIGNATURES = [
  "function renderTab(",
  "content.style.cssText",
  "pa-debug-content",
  "bridgeCalls.slice(",
  "renderTab('input')",
  "refreshInterval = setInterval",
];

const MOJIBAKE_PATTERNS = [
  /Ã[ˆ„]/,
  /Â[¨°¢]/,
  /â€[œ˜š™]/,
  /â€¦/,
  /â€”/,
  /â€¢/,
  /\uFFFD/,
];

let failures = 0;

function fail(msg) {
  console.error("  [FAIL] " + msg);
  failures++;
}

function ok(msg) {
  console.log("  [PASS] " + msg);
}

function checkEncoding(html, gameId) {
  const buf = Buffer.from(html, "utf-8");
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    ok("valid UTF-8");

    for (const pattern of MOJIBAKE_PATTERNS) {
      if (pattern.test(decoded)) {
        fail(gameId + ": mojibake pattern " + pattern + " detected");
      }
    }

    return decoded;
  } catch (e) {
    fail(gameId + ": invalid UTF-8: " + e.message);
    return null;
  }
}

function checkDocumentOrder(html, gameId) {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const doctypeIdx = noComments.search(/<!DOCTYPE\s+html>/i);
  const htmlIdx = noComments.search(/<html[\s>]/i);
  const headIdx = noComments.search(/<head[\s>]/i);
  const bodyIdx = noComments.search(/<body[\s>]/i);

  if (doctypeIdx === -1) fail(gameId + ": missing DOCTYPE");
  else ok("DOCTYPE present");

  if (htmlIdx === -1) fail(gameId + ": missing <html>");
  else ok("<html> present");

  if (headIdx === -1) fail(gameId + ": missing <head>");
  else ok("<head> present");

  if (bodyIdx === -1) fail(gameId + ": missing <body>");
  else ok("<body> present");

  if (doctypeIdx >= 0 && htmlIdx >= 0 && doctypeIdx > htmlIdx) {
    fail(gameId + ": DOCTYPE must precede <html>");
  }

  if (headIdx >= 0 && bodyIdx >= 0 && headIdx > bodyIdx) {
    fail(gameId + ": <head> must precede <body>");
  }

  const charsetIdx = html.indexOf('<meta charset="UTF-8">');
  if (charsetIdx < 0) {
    fail(gameId + ': missing <meta charset="UTF-8">');
  } else if (charsetIdx > 1024) {
    fail(
      gameId +
        ": charset not within first 1024 bytes (offset " +
        charsetIdx +
        ")",
    );
  } else {
    ok("charset within first 1024 bytes");
  }

  if (html.indexOf("<title>") < 0) {
    fail(gameId + ": missing <title>");
  }
}

function checkScriptIntegrity(html, gameId) {
  const scriptOpens = (html.match(/<script\b[^>]*>/gi) || []).length;
  const scriptCloses = (html.match(/<\/script\s*>/gi) || []).length;

  if (scriptOpens !== scriptCloses) {
    fail(
      gameId +
        ": unmatched <script> tags (" +
        scriptOpens +
        " open, " +
        scriptCloses +
        " close)",
    );
  } else {
    ok("script tags balanced (" + scriptOpens + ")");
  }

  const headOpen = (html.match(/<head[\s>]/gi) || []).length;
  const headClose = (html.match(/<\/head\s*>/gi) || []).length;
  const bodyOpen = (html.match(/<body[\s>]/gi) || []).length;
  const bodyClose = (html.match(/<\/body\s*>/gi) || []).length;

  if (headOpen !== 1 || headClose !== 1) {
    fail(gameId + ": expected 1 <head>, found " + headOpen + "/" + headClose);
  }
  if (bodyOpen !== 1 || bodyClose !== 1) {
    fail(gameId + ": expected 1 <body>, found " + bodyOpen + "/" + bodyClose);
  }

  const extDebugJs = (html.match(/debug-panel\.js\?v=/g) || []).length;
  if (extDebugJs !== 1) {
    fail(gameId + ": expected exactly 1 debug-panel.js, found " + extDebugJs);
  } else {
    ok("exactly 1 debug-panel.js");
  }

  const pygbagCdn = (
    html.match(
      /<script[^>]*src="https:\/\/pygame-web\.github\.io\/cdn\/[^"]*pythons\.js"[^>]*>/g,
    ) || []
  ).length;
  if (pygbagCdn !== 1) {
    fail(gameId + ": expected 1 pygbag module script, found " + pygbagCdn);
  } else {
    ok("exactly 1 pygbag module script");
  }

  for (const sig of INLINE_SIGNATURES) {
    if (html.includes(sig)) {
      fail(
        gameId + ": contains leftover inline debug signature: '" + sig + "'",
      );
    }
  }
}

function checkParsedDOM(html, gameId) {
  let dom;
  try {
    dom = new JSDOM(html);
  } catch (e) {
    fail(gameId + ": JSDOM parse error: " + e.message);
    return;
  }

  const doc = dom.window.document;
  const body = doc.body;

  const directTextNodes = [];
  for (let i = 0; i < body.childNodes.length; i++) {
    const child = body.childNodes[i];
    if (child.nodeType === 3) {
      const text = child.nodeValue.trim();
      if (text) directTextNodes.push(text);
    }
  }

  if (directTextNodes.length > 0) {
    fail(
      gameId +
        ": non-whitespace direct text node(s) in body: " +
        JSON.stringify(directTextNodes.slice(0, 5)),
    );
  } else {
    ok("no non-whitespace direct body text nodes");
  }

  const allElements = body.getElementsByTagName("*");
  let visibleText = "";
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (!VISIBLE_TAG_NAMES.has(el.tagName) && el.childNodes.length > 0) {
      for (let j = 0; j < el.childNodes.length; j++) {
        const child = el.childNodes[j];
        if (child.nodeType === 3) {
          visibleText += child.nodeValue;
        }
      }
    }
  }

  for (const pattern of MOJIBAKE_PATTERNS) {
    if (pattern.test(visibleText)) {
      fail(gameId + ": mojibake in visible text: " + pattern);
    }
  }

  if (!doc.querySelector("#game-loading")) {
    fail(gameId + ": missing #game-loading");
  } else {
    ok("#game-loading present");
  }
  if (!doc.querySelector("#back-link")) {
    fail(gameId + ": missing #back-link");
  } else {
    ok("#back-link present");
  }
  if (!doc.querySelector("#controls-hint")) {
    fail(gameId + ": missing #controls-hint");
  } else {
    ok("#controls-hint present");
  }
  if (!doc.querySelector("#infobox")) {
    fail(gameId + ": missing #infobox");
  } else {
    ok("#infobox present");
  }
  if (!doc.querySelector("#touch-overlay")) {
    fail(gameId + ": missing #touch-overlay");
  } else {
    ok("#touch-overlay present");
  }
  if (!doc.querySelector("canvas#canvas")) {
    fail(gameId + ": missing canvas#canvas");
  } else {
    ok("canvas#canvas present");
  }
  if (!doc.querySelector("#rotate-device")) {
    fail(gameId + ": missing #rotate-device");
  } else {
    ok("#rotate-device present");
  }

  const ids = {};
  const allIdElements = doc.querySelectorAll("*[id]");
  for (let i = 0; i < allIdElements.length; i++) {
    const id = allIdElements[i].id;
    if (ids[id]) {
      fail(gameId + ": duplicate ID '" + id + "'");
    } else {
      ids[id] = true;
    }
  }
}

function checkCrossShellParity() {
  const contents = PYBAG_GAMES.map(function (id) {
    const p = resolve(root, "public/play", id, "index.html");
    return { id: id, html: readFileSync(p, "utf-8") };
  });

  const getPos = function (html, re) {
    const m = html.match(re);
    return m ? m.index : -1;
  };

  const structures = contents.map(function (c) {
    return {
      doctypeBeforeHtml:
        getPos(c.html, /<!DOCTYPE\s+html>/i) < getPos(c.html, /<html[\s>]/i),
      headBeforeBody:
        getPos(c.html, /<head[\s>]/i) < getPos(c.html, /<body[\s>]/i),
      charsetInHead: /<head[\s>][\s\S]*?charset="UTF-8"/i.test(c.html),
    };
  });

  const allSame = function (arr, key) {
    return arr.every(function (o) {
      return o[key];
    });
  };

  if (allSame(structures, "doctypeBeforeHtml")) {
    ok("all shells: DOCTYPE before <html>");
  } else {
    fail("cross-shell: DOCTYPE position differs");
  }
  if (allSame(structures, "headBeforeBody")) {
    ok("all shells: <head> before <body>");
  } else {
    fail("cross-shell: <head>/<body> order differs");
  }
  if (allSame(structures, "charsetInHead")) {
    ok("all shells: charset in <head>");
  } else {
    fail("cross-shell: charset position differs");
  }
}

console.log("Game shell integrity check\n");

for (const gameId of PYBAG_GAMES) {
  const indexPath = resolve(root, "public/play", gameId, "index.html");
  console.log("-- " + gameId + " --");

  if (!existsSync(indexPath)) {
    fail(gameId + ": index.html not found");
    continue;
  }

  const html = readFileSync(indexPath, "utf-8");

  const decoded = checkEncoding(html, gameId);
  checkDocumentOrder(decoded || html, gameId);
  checkScriptIntegrity(html, gameId);

  if (decoded) {
    checkParsedDOM(decoded, gameId);
  }

  console.log("");
}

console.log("-- cross-shell parity --");
checkCrossShellParity();

console.log("");
if (failures > 0) {
  console.error("FAILED: " + failures + " check(s) failed.");
  process.exit(1);
} else {
  console.log("PASSED: All game shell integrity checks passed.");
}
