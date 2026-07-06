# Local Validation

Quick reference for what to run based on what changed.

## Fast sanity, no browser (before handing OpenCode a prompt)

```sh
npm run test:unit:js
npm run test:unit:python
npm run typecheck
npm run format:check
```

## Pygbag shell, archive, or cache-policy changes

Generate shells, then validate:

```sh
npm run generate:pygbag-shells
npm run test:pygbag-shell-drift
npm run test:archive-parity
npm run audit:game-archives
npm run test:cache-versioning
npm run test:service-worker
npm run test:game-shell-integrity
npm run test:game-versions
npm run test:pygbag-boot-contract
npm run test:pygbag-boot-program
```

## Gameplay logic changes

```sh
npm run test:unit:python
npm run test:unit:js
npm run test:game-matches
npm run test:browser-games:chromium
```

## Site, Astro, or UI changes

```sh
npm run typecheck
npm run format:check
npm run build
npm run test:docs
npm run test:css-tokens
npm run test:visual-contrast
npm run test:copy-tone
```

## Pre-commit or CI gate

```sh
npm run verify:release:fast
```

This runs 29 deterministic checks (no browser needed).

## Full browser matrix

```sh
npm run verify:release:full
```

Adds accessibility, mobile, iPad, theming, Lighthouse, and all browser game tests. Runs the full Playwright matrix.

## Known caveats

- `verify:release:full` has a flaky `site-theme` test that passes in isolation but fails unpredictably in the full gate. Pre-existing, unrelated to recent changes.
- `verify:release:fast` typecheck can OOM on memory-constrained machines. Use `NODE_OPTIONS="--max-old-space-size=8192" npm run typecheck` if needed.
