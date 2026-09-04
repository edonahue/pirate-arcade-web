export type ToolingStatus = "current" | "historical";
export type ModelRunEra = "historical" | "current";

export interface ToolingEntry {
  name: string;
  category:
    | "ai-agent"
    | "ai-model"
    | "hosting"
    | "framework"
    | "hardware"
    | "platform"
    | "tool";
  usedFor: string[];
  cost: "free" | "free-tier" | "already-owned";
  notes: string;
  /** Whether this row describes the current stack ("current") or a
   *  past session's tooling ("historical"). Every row must declare it. */
  status: ToolingStatus;
  /** YYYY-MM when the status was last verified, where known. */
  asOf?: string;
}

export interface ModelRun {
  model: string;
  task: string;
  observed: string[];
  /** Session notes are historical records. New rows may use "current"
   *  only for actively ongoing model usage. */
  era: ModelRunEra;
}

export const tooling: ToolingEntry[] = [
  {
    name: "OpenCode",
    category: "ai-agent",
    usedFor: [
      "Terminal-based AI-assisted coding",
      "File generation and editing",
      "Multi-step task orchestration",
    ],
    cost: "free",
    notes:
      "Terminal coding agent. Primary interface for the initial desktop-game and website work covered in the session log below; later site sessions are not yet covered by this log.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "DeepSeek V4 Flash Free",
    category: "ai-model",
    usedFor: [
      "Game logic generation (Pong, Breakout, Asteroids variants)",
      "Python/Pygame boilerplate",
      "CSS and layout generation",
    ],
    cost: "free",
    notes:
      "Primary model used during desktop game development. Provided clean, idiomatic code for well-known game patterns. Required human review for edge cases and game-specific logic.",
    status: "historical",
  },
  {
    name: "Nemotron 3 Super Free",
    category: "ai-model",
    usedFor: [
      "Alternative generation runs",
      "Comparison against DeepSeek output",
      "Cross-platform packaging scripts",
    ],
    cost: "free",
    notes:
      "Tested as alternative to DeepSeek. Output quality was comparable for simple patterns but showed more variance on complex multi-file tasks.",
    status: "historical",
  },
  {
    name: "Big Pickle OpenCode Zen",
    category: "ai-model",
    usedFor: [
      "UI component generation",
      "CSS token system generation",
      "Documentation first drafts",
    ],
    cost: "free",
    notes:
      "Used primarily for Astro/website work and documentation tasks. Strong on structure and boilerplate; weaker on game-specific logic.",
    status: "historical",
  },
  {
    name: "Ollama (local inference)",
    category: "ai-model",
    usedFor: [
      "Local free-model inference on the builder workstation",
      "Narrow documented patches",
    ],
    cost: "free",
    notes:
      "Local inference tier. Documented use: Nemotron narrow patches on the Race Phaser game (see build log). Coverage beyond that is not recorded here.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "GitHub",
    category: "platform",
    usedFor: [
      "Source control",
      "CI/CD (GitHub Actions)",
      "Release hosting",
      "Issue tracking",
    ],
    cost: "free-tier",
    notes:
      "Free tier handles everything needed: unlimited public repos, 2000 CI minutes/month, 500MB release storage, issue tracking.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "Cloudflare Pages",
    category: "hosting",
    usedFor: ["Static site hosting", "SSL/TLS", "Global CDN"],
    cost: "free-tier",
    notes:
      "Free tier includes unlimited static sites, 500 builds/month, 1GB storage, unlimited bandwidth, and global CDN. No Worker scripts needed for a static Astro site.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "X600 Workstation",
    category: "hardware",
    usedFor: ["All development", "AI model inference", "Builds and testing"],
    cost: "already-owned",
    notes:
      "Local consumer workstation. No cloud compute, no GPU instances, no paid compute used for any development or AI inference task in this project.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "Astro",
    category: "framework",
    usedFor: [
      "Static site generation",
      "Content collections",
      "Component model",
    ],
    cost: "free",
    notes:
      "Astro 7 with static output. Content collections for the build log, component islands where needed, zero client JS on most pages.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "Python + Pygame",
    category: "framework",
    usedFor: [
      "Desktop game engine",
      "Procedural rendering",
      "Input handling",
      "Audio generation",
    ],
    cost: "free",
    notes:
      "All four games built with Python 3.10+ and Pygame 2.5.0+. All graphics and audio are generated procedurally at runtime — no external asset files required.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "NumPy",
    category: "tool",
    usedFor: [
      "Procedural audio generation",
      "Signal processing for sound effects",
    ],
    cost: "free",
    notes:
      "Used to synthesize all game audio: paddle hits, explosions, coin jingles, ship horns, and ambient sounds. Zero audio files needed.",
    status: "current",
    asOf: "2026-09",
  },
  {
    name: "PyInstaller",
    category: "tool",
    usedFor: ["Cross-platform executable packaging"],
    cost: "free",
    notes:
      "Packages the Python game collection into standalone Windows and macOS executables. The .spec file required manual hidden import configuration.",
    status: "current",
    asOf: "2026-09",
  },
];

// Observations are based on session notes and recollection, not
// controlled measurement. They capture what stood out during development
// rather than formal evaluation metrics.
//
// Coverage ends with the initial game implementations, the website
// scaffold, and early Race polish work. Later site sessions are not yet
// recorded here — do not backfill provenance from guesswork.
export const modelRuns: ModelRun[] = [
  {
    model: "DeepSeek V4 Flash Free",
    task: "Cannonball Clash (Pong variant) — full game implementation",
    era: "historical",
    observed: [
      "First-pass implementation was functional but lacked collision edge cases",
      "Required 3 intervention cycles for paddle/top-wall collision fix",
      "AI correctly structured the game loop, scoring, and input handling",
    ],
  },
  {
    model: "DeepSeek V4 Flash Free",
    task: "Treasure Cove (Breakout variant) — brick layout and ball physics",
    era: "historical",
    observed: [
      "Solid first-pass brick generation and collision detection",
      "Ball-angle-on-paddle logic needed manual correction",
      "Score and life system was correct on first attempt",
    ],
  },
  {
    model: "Nemotron 3 Super Free",
    task: "Kraken's Wake (Asteroids variant) — ship movement and enemy AI",
    era: "historical",
    observed: [
      "Ship movement was functional but acceleration curve felt wrong",
      "Enemy barrel spawning logic had an off-by-one error",
      "Overall structure was usable after 2 review cycles",
    ],
  },
  {
    model: "DeepSeek V4 Flash Free",
    task: "Port Royale Tycoon (property-trading game) — board and game rules",
    era: "historical",
    observed: [
      "Generated plausible board structure but incorrect game-state transitions",
      "Human had to redesign the entire game-flow state machine",
      "Property purchase and rent logic needed complete rewrite",
      "This was the task that required the most human intervention",
    ],
  },
  {
    model: "Big Pickle OpenCode Zen",
    task: "Astro website scaffold — layout, components, styles",
    era: "historical",
    observed: [
      "Clean component structure and CSS generation",
      "Theme toggle and layout patterns were correct on first pass",
      "Content collection schema needed manual type adjustment",
    ],
  },
  {
    model: "Big Pickle OpenCode Zen",
    task: "Build log post and documentation",
    era: "historical",
    observed: [
      "Generated reasonable first-draft markdown structure",
      "Tone needed human adjustment — AI defaulted to marketing language",
      "Factual claims needed verification against actual project state",
    ],
  },
  {
    model: "DeepSeek V4 Flash Free",
    task: "Race to Treasure Island (Phaser racer) — game scene, physics, AI rival",
    era: "historical",
    observed: [
      "Generated a functional Phaser 3 scene with boost/wind/overtake mechanics",
      "Rival AI path and deterministic seed logic needed manual refinement",
      "Obstacle collision and bump mechanic required multiple iteration cycles",
      "Debug hooks added for deterministic testability — useful pattern",
    ],
  },
  {
    model: "DeepSeek V4 Flash Free",
    task: "Race to Treasure Island — HUD, overlays, finish, touch controls",
    era: "historical",
    observed: [
      "HUD layout and boost meter generation were solid on first attempt",
      "Touch input handling needed the most iteration (button sizing, coordinate mapping)",
      "Finish/win/loss state management required manual wiring",
      "Overtake cue and restart logic were added iteratively over several sessions",
    ],
  },
];
