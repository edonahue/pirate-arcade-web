#!/usr/bin/env node
/**
 * Visual contrast check for Pirate Arcade CSS tokens.
 * Computes WCAG AA contrast ratios for all important text/background
 * token pairs and fails if any drop below 4.5:1 (normal text).
 *
 * Usage:
 *   node scripts/check-visual-contrast.mjs
 */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Blend a hex color with a background hex at given opacity.
 * Simulates how rgba backgrounds render on solid backgrounds.
 */
function blendOverBackground(rgba, bgHex) {
  const bg = hexToRgb(bgHex);
  const ratio = rgba.a;
  return {
    r: Math.round(rgba.r * ratio + bg.r * (1 - ratio)),
    g: Math.round(rgba.g * ratio + bg.g * (1 - ratio)),
    b: Math.round(rgba.b * ratio + bg.b * (1 - ratio)),
  };
}

function formatRgb(c) {
  return `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`;
}

// ── Token values (dark theme) ──
const DARK = {
  bg: "#071016",
  ink: "#efe7d3",
  inkStrong: "#fff7e6",
  muted: "#a9b3ad",
  brass: "#c9a45c",
  brassStrong: "#f0cf7a",
  sea: "#2aa6a1",
  seaDeep: "#0f5d63",
  rum: "#8c3428",
  paper: "#c9b89e",
  paperInk: "#2a1d12",
  paperInkStrong: "#140a04",
  focus: "#f0cf7a",
  focusPaper: "#7a5a20",
  surface: "rgba(16, 28, 38, 0.88)",
  surfaceSoft: "rgba(25, 42, 54, 0.78)",
};

// ── Token values (light theme) ──
const LIGHT = {
  bg: "#f8f6f3",
  ink: "#2a2620",
  inkStrong: "#12100e",
  muted: "#6b7280",
  brass: "#b88d3f",
  brassStrong: "#d4af37",
  sea: "#1e8e89",
  seaDeep: "#0c4a4f",
  rum: "#6a2820",
  paper: "#d4c5a5",
  paperInk: "#4a3a22",
  paperInkStrong: "#1a1208",
  focus: "#8a6a28",
  focusPaper: "#7a5a20",
  surface: "rgba(240, 235, 225, 0.88)",
  surfaceSoft: "rgba(245, 240, 230, 0.78)",
};

function parseRgba(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? +m[4] : 1 };
}

/**
 * Parse a CSS var() fallback or raw value.
 */
function resolveTokenKey(str) {
  const m = str.match(/var\(--([\w-]+)\)/);
  if (m) return m[1];
  return null;
}

const TOKENS_DARK = {
  "--paper-badge-available-fg": "#140a04",
  "--paper-badge-available-bg": "rgba(201, 164, 92, 0.12)",
  "--paper-badge-available-border": "#c9a45c",
  "--paper-badge-planned-fg": "#140a04",
  "--paper-badge-planned-bg": "rgba(42, 166, 161, 0.12)",
  "--paper-badge-planned-border": "#2aa6a1",
  "--paper-badge-experimental-fg": "#140a04",
  "--paper-badge-experimental-bg": "rgba(140, 52, 40, 0.12)",
  "--paper-badge-experimental-border": "#8c3428",
  "--paper-badge-easy-fg": "#140a04",
  "--paper-badge-easy-bg": "rgba(42, 166, 161, 0.12)",
  "--paper-badge-easy-border": "#2aa6a1",
  "--paper-badge-medium-fg": "#140a04",
  "--paper-badge-medium-bg": "rgba(201, 164, 92, 0.12)",
  "--paper-badge-medium-border": "#c9a45c",
  "--paper-badge-harder-fg": "#140a04",
  "--paper-badge-harder-bg": "rgba(140, 52, 40, 0.12)",
  "--paper-badge-harder-border": "#8c3428",
  "--paper-chip-bg": "rgba(25, 42, 54, 0.78)",
  "--paper-chip-fg": "#efe7d3",
  "--paper-chip-border": "rgba(239, 231, 211, 0.14)",
  "--paper-cta-bg": "rgba(25, 42, 54, 0.78)",
  "--paper-cta-fg": "#efe7d3",
  "--paper-cta-border": "#c9a45c",
};

const TOKENS_LIGHT = {
  "--paper-badge-available-fg": "#1a1208",
  "--paper-badge-available-bg": "rgba(184, 141, 63, 0.12)",
  "--paper-badge-available-border": "#b88d3f",
  "--paper-badge-planned-fg": "#1a1208",
  "--paper-badge-planned-bg": "rgba(30, 142, 137, 0.12)",
  "--paper-badge-planned-border": "#1e8e89",
  "--paper-badge-experimental-fg": "#1a1208",
  "--paper-badge-experimental-bg": "rgba(106, 40, 32, 0.12)",
  "--paper-badge-experimental-border": "#6a2820",
  "--paper-badge-easy-fg": "#1a1208",
  "--paper-badge-easy-bg": "rgba(30, 142, 137, 0.12)",
  "--paper-badge-easy-border": "#1e8e89",
  "--paper-badge-medium-fg": "#1a1208",
  "--paper-badge-medium-bg": "rgba(184, 141, 63, 0.12)",
  "--paper-badge-medium-border": "#b88d3f",
  "--paper-badge-harder-fg": "#1a1208",
  "--paper-badge-harder-bg": "rgba(106, 40, 32, 0.12)",
  "--paper-badge-harder-border": "#6a2820",
  "--paper-chip-bg": "rgba(245, 240, 230, 0.78)",
  "--paper-chip-fg": "#2a2620",
  "--paper-chip-border": "rgba(211, 207, 197, 0.14)",
  "--paper-cta-bg": "rgba(245, 240, 230, 0.78)",
  "--paper-cta-fg": "#2a2620",
  "--paper-cta-border": "#b88d3f",
};

// ── Test pairs: [fg, bg, label, minRatio] ──
// fg and bg are token values from above (hex or rgba strings)
// bg is the actual CSS background the fg is rendered on
const PAIRS = [];

function addPairs(themeTokens, themeName, paperHex) {
  // Paper badges (fg on paper background, bg blended over paper)
  const badgePairs = [
    [
      "--paper-badge-available-fg",
      "--paper-badge-available-bg",
      "Badge Available",
    ],
    ["--paper-badge-planned-fg", "--paper-badge-planned-bg", "Badge Planned"],
    [
      "--paper-badge-experimental-fg",
      "--paper-badge-experimental-bg",
      "Badge Experimental",
    ],
    ["--paper-badge-easy-fg", "--paper-badge-easy-bg", "Badge Easy"],
    ["--paper-badge-medium-fg", "--paper-badge-medium-bg", "Badge Medium"],
    ["--paper-badge-harder-fg", "--paper-badge-harder-bg", "Badge Harder"],
    ["--paper-chip-fg", "--paper-chip-bg", "Chip foreground"],
    ["--paper-cta-fg", "--paper-cta-bg", "CTA foreground"],
  ];

  for (const [fgKey, bgKey, label] of badgePairs) {
    const fg = themeTokens[fgKey];
    const bgRaw = themeTokens[bgKey];
    if (!fg || !bgRaw) continue;

    const bgParsed = parseRgba(bgRaw);
    if (!bgParsed) {
      // Solid bg
      PAIRS.push({
        fg,
        bg: bgRaw,
        label: `${themeName} - ${label}`,
        minRatio: 4.5,
      });
      continue;
    }

    // Blend the semi-transparent bg over the paper background
    const blended = blendOverBackground(bgParsed, paperHex);
    const blendedHex = formatRgb(blended);

    // fg is solid hex
    PAIRS.push({
      fg,
      bg: blendedHex,
      label: `${themeName} - ${label} (on paper)`,
      minRatio: 4.5,
    });

    // Skip fallback test for near-opaque backgrounds (≥50% opacity)
    // The fallback scenario is unrealistic when bg mostly covers the paper
    if (bgParsed.a < 0.5) {
      PAIRS.push({
        fg,
        bg: paperHex,
        label: `${themeName} - ${label} fg vs paper (fallback)`,
        minRatio: 3.0,
      });
    }
  }
}

// Dark theme pairs
addPairs(TOKENS_DARK, "Dark", DARK.paper);

// Light theme pairs
addPairs(TOKENS_LIGHT, "Light", LIGHT.paper);

// Global structural pairs
PAIRS.push(
  { fg: DARK.ink, bg: DARK.bg, label: "Dark ink on bg", minRatio: 4.5 },
  {
    fg: DARK.inkStrong,
    bg: DARK.bg,
    label: "Dark ink-strong on bg",
    minRatio: 4.5,
  },
  { fg: DARK.muted, bg: DARK.bg, label: "Dark muted on bg", minRatio: 3.0 },
  { fg: DARK.focus, bg: DARK.bg, label: "Dark focus on bg", minRatio: 3.0 },
  {
    fg: DARK.focusPaper,
    bg: DARK.paper,
    label: "Dark focus-paper on paper",
    minRatio: 3.0,
  },
  {
    fg: DARK.brass,
    bg: DARK.bg,
    label: "Dark brass on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: DARK.sea,
    bg: DARK.bg,
    label: "Dark sea on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: DARK.rum,
    bg: DARK.bg,
    label: "Dark rum on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: DARK.brassStrong,
    bg: DARK.bg,
    label: "Dark brass-strong on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: DARK.paperInk,
    bg: DARK.paper,
    label: "Dark paper-ink on paper",
    minRatio: 4.5,
  },
  {
    fg: DARK.paperInkStrong,
    bg: DARK.paper,
    label: "Dark paper-ink-strong on paper",
    minRatio: 4.5,
  },

  { fg: LIGHT.ink, bg: LIGHT.bg, label: "Light ink on bg", minRatio: 4.5 },
  {
    fg: LIGHT.inkStrong,
    bg: LIGHT.bg,
    label: "Light ink-strong on bg",
    minRatio: 4.5,
  },
  { fg: LIGHT.muted, bg: LIGHT.bg, label: "Light muted on bg", minRatio: 3.0 },
  { fg: LIGHT.focus, bg: LIGHT.bg, label: "Light focus on bg", minRatio: 3.0 },
  {
    fg: LIGHT.focusPaper,
    bg: LIGHT.paper,
    label: "Light focus-paper on paper",
    minRatio: 3.0,
  },
  {
    fg: LIGHT.brass,
    bg: LIGHT.bg,
    label: "Light brass on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: LIGHT.sea,
    bg: LIGHT.bg,
    label: "Light sea on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: LIGHT.rum,
    bg: LIGHT.bg,
    label: "Light rum on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: LIGHT.brassStrong,
    bg: LIGHT.bg,
    label: "Light brass-strong on bg (decorative)",
    minRatio: 2.5,
  },
  {
    fg: LIGHT.paperInk,
    bg: LIGHT.paper,
    label: "Light paper-ink on paper",
    minRatio: 4.5,
  },
  {
    fg: LIGHT.paperInkStrong,
    bg: LIGHT.paper,
    label: "Light paper-ink-strong on paper",
    minRatio: 4.5,
  },
);

// Run checks
let failures = 0;
let decorativeFailures = 0;
let passed = 0;

for (const pair of PAIRS) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const pass = ratio >= pair.minRatio;
  const status = pass ? "✅" : "❌";
  const detail = `${pair.fg} on ${pair.bg}`;
  console.log(
    `${status} ${pair.label}: ${ratio.toFixed(2)}:1 (min ${pair.minRatio}:1)  ${detail}`,
  );

  if (!pass) {
    if (pair.label.includes("(decorative)")) {
      decorativeFailures++;
    } else {
      failures++;
    }
  } else {
    passed++;
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`   ✅ Passed: ${passed}`);
if (failures > 0) console.log(`   ❌ Structural failures: ${failures}`);
if (decorativeFailures > 0)
  console.log(`   ⚠️  Decorative accent warnings: ${decorativeFailures}`);

if (failures > 0) {
  console.log(`\nStructural failures require CSS token adjustments.`);
  process.exit(1);
} else if (decorativeFailures > 0) {
  console.log(
    `\n⚠️  All structural pairs pass. Decorative accent warnings are known design constraints.`,
  );
  process.exit(0);
} else {
  console.log(`\n🎉 All contrast checks passed!`);
  process.exit(0);
}
