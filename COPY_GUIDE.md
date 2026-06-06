# Copy Style Guide — Pirate Arcade

> A concise reference for anyone writing or editing site copy. Keep it bookmarked.

---

## Tone Zones

The site has distinct tonal zones. Match your writing to the zone.

| Zone                            | Pages                                  | Tone                               | Pirate Flavor                                                                                                                                                  |
| ------------------------------- | -------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Play Surface**                | `/`, `/play/`, `/games/*/`             | Playful, arcade-forward, clear     | Restrained. Nautical metaphors OK when they clarify. No "arrr," "matey," "scallywag," "yo-ho-ho," "shiver me timbers," "captain" (except literal game titles). |
| **Game Detail**                 | `/games/[id]/`                         | Instructional first, flavor second | Allowed in descriptions. Controls/availability must be literal.                                                                                                |
| **About**                       | `/about/`                              | Plainspoken, zero pirate voice     | None. No "arrr," "matey," "scallywag," "yo-ho-ho," "shiver me timbers," "captain" (unless literal), "set sail," "shipshape," "treasure map."                   |
| **Build Log / Technical**       | `/build-log/*/`                        | Plain technical writing            | None. Allowed: literal terms like "pirate-themed visuals," "Howard Pyle pirate illustrations," game titles.                                                    |
| **Source / Docs / Methodology** | `/source/`, `/build-log/*/`            | Professional, concise, verifiable  | None. Distinguish tested facts / assumptions / future work.                                                                                                    |
| **SEO / LLM Summaries**         | `llms.txt`, `llms-full.txt`, meta tags | Plain, crawlable, stable           | None. Include exact game status. Avoid stale "desktop-only" claims for browser-playable games.                                                                 |

---

## Vocabulary — Use Consistently

| Concept                           | Preferred Term                                   | Avoid                                                                     |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Games you can play in the browser | **browser-playable**                             | "web version," "online version"                                           |
| Games you download                | **desktop release** / **desktop download**       | "desktop version" (ambiguous)                                             |
| Runtime tech                      | **Pygbag / WebAssembly**                         | "WASM port," "web build"                                                  |
| First visit cost                  | **first visit**                                  | "cold load" (jargon)                                                      |
| Return visit speed                | **repeat visits**                                | "warm load"                                                               |
| Audio unlock                      | **first click or tap**                           | "user gesture" (jargon)                                                   |
| Captain's Log storage             | **local-only** / **stored only in your browser** | "localStorage" (implementation detail)                                    |
| AI models                         | **free-to-use models** / **free-to-use AI**      | "free AI" (ambiguous)                                                     |
| Infrastructure                    | **zero-cost** / **free-tier**                    | "free" (ambiguous — could mean "free as in beer" or "free as in freedom") |

---

## Game Copy — Centralized Fields

All per-game copy should live in `src/data/games.json` and typed in `games.ts`. Do not hardcode in page templates.

| Field                  | Purpose                            | Example                                                    |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `description`          | One-sentence pitch for cards/SEO   | "Naval cannon duel. Defend your fortress..."               |
| `shortDescription`     | One-liner for cards/SEO (optional) |                                                            |
| `howToPlay`            | 2-3 sentences for game detail page | "Defend your fortress..."                                  |
| `touchControls`        | Plain list for touch summary       | "Slide ship up/down • START • PAUSE"                       |
| `keyboardControls`     | Plain list for keyboard summary    | "ArrowUp/W — move up • ArrowDown/S — move down"            |
| `tips`                 | 1-2 practical tips                 | "AI ramps up. Power-ups make paddle bigger."               |
| `firstPlayTip`         | One-liner for /play/ page          | "Slide ship up/down, tap START. Easiest on touch."         |
| `touchDifficultyLabel` | Badge text                         | "Easiest on touch" / "Medium on touch" / "Harder on touch" |
| `availabilityNote`     | One-liner for game detail page     | "Playable in browser now via Pygbag..."                    |
| `seoDescription`       | Meta description (150-160 chars)   | "Play Cannonball Clash in your browser..."                 |

---

## Banned Words/Phrases by Zone

| Zone                                  | Banned                                                                              | Allowed Exceptions                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **All**                               | `arr`, `arrr`, `matey`, `scallywag`, `yo-ho`, `yo-ho-ho`, `shiver me timbers`       | None                                                                                                   |
| **About / Build Log / Source / Docs** | `ahoy`, `captain` (as address), `set sail`, `shipshape`, `treasure map`, `yo-ho-ho` | Literal: game titles ("Captain's Log"), "pirate-themed," "Howard Pyle pirate illustrations"            |
| **Play Surface / Game Detail**        | `ahoy`, `captain` (as address), `set sail`, `shipshape`                             | Restrained: "naval cannon duel," "pirate-themed," "pirate-themed visuals," "pirate flavor" (sparingly) |
| **SEO/LLM**                           | Any pirate-parody voice                                                             | Literal project/game terms only                                                                        |

---

## CTA Labels — Standardize

| Action              | Label                        | Variant   |
| ------------------- | ---------------------------- | --------- |
| Play a browser game | **Play in Browser**          | `primary` |
| Download desktop    | **Download Desktop Release** | `gold`    |
| Read build log      | **Read the Build Log**       | `gold`    |
| View source         | **View Source**              | `outline` |
| Return to games     | **All Games**                | `outline` |

---

## Meta / SEO Checklist (Per Page)

- [ ] Title: `<Game Title> — Pirate Arcade` (game pages) or clear page title
- [ ] Meta description: 150-160 chars, includes key terms ("playable in browser," "Pygbag," "WebAssembly")
- [ ] H1 matches page purpose
- [ ] OG title/description match page
- [ ] JSON-LD includes correct `@type` and visible data
- [ ] Canonical URL uses `https://pirate-arcade.com`
- [ ] No localhost/127.0.0.1 URLs in built HTML
- [ ] `llms.txt` / `llms-full.txt` reflect current game status
- [ ] Sitemap includes all browser-playable game routes

---

## Updating Game Status — Single Source of Truth

1. Edit `src/data/games.json` — change `status`, `statusLabel`, `browserUrl`
2. Run `npm run apply:game-versions` (updates HTML shells)
3. Update `llms.txt` / `llms-full.txt` if game status changed
4. Update `scripts/generate-sitemap.mjs` `EXTRA_STATIC_PATHS` if browser routes added/removed
5. Update `scripts/seo-audit.mjs` `importantRoutes` if browser routes changed
6. Run `npm run verify:release:fast` to validate

---

## Tone Check Commands

```bash
# Quick tone check (runs check-copy-tone.mjs if implemented)
npm run test:copy-tone

# Full validation ladder
npm run verify:release:fast
```

<tool_call>
