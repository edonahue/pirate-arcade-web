---
title: "The Pirate Arcade Experiment"
description: "How far can a zero-cost, AI-assisted development workflow go? This post covers the tools, constraints, and findings from building Pirate Arcade with free models, local hardware, and open source infrastructure."
pubDate: 2026-05-31
draft: false
---

## Goal

Build a polished pirate-themed arcade collection — four classic games reimagined — using only free AI-assisted coding tools, local hardware, open source infrastructure, and no paid subscriptions. Then wrap it in a public-facing website to document the process.

The bet: a single developer with free AI assistance, a local workstation, GitHub, and Cloudflare's free tier can ship something real.

## Tools used

- **OpenCode** — AI-assisted coding in the terminal
- **Free-to-use models** — various free-to-use models accessed through OpenCode
- **Python + Pygame** — desktop game framework
- **Astro** — static site framework for the public website
- **Local X600 workstation** — all development ran locally on consumer hardware
- **GitHub** — source control, CI, releases, issue tracking
- **Cloudflare Pages** — static site hosting (free tier)
- **Procedural audio** — all game sounds generated at runtime with NumPy

## What worked

- **Full game release in a single day.** The entire game collection — four games, a launcher, high scores, procedural audio, cross-platform packaging, CI — went from start to v2.0.0 release in one extended session.
- **Zero-cost infrastructure.** GitHub free tier handles everything: CI runners, releases, package distribution. Cloudflare Pages free tier hosts the website.
- **AI-assisted code generation is fast for well-known patterns.** Classic games like Pong, Breakout, and Asteroids have been implemented thousands of times. The AI had plenty of training data and produced solid first-pass implementations.
- **Procedural asset pipeline.** Generating all visuals and audio programmatically eliminated the need for a game artist or sound designer. This is a genuine advantage for a solo developer.
- **Property-trading game variant was the most interesting.** Port Royale Tycoon required more original game design (pirate-themed board, unique rules) and correspondingly more human judgment. The AI handled the repetitive part; the human handled the creative constraints.

## What broke

- **Inconsistent AI output quality.** Different models (even different runs of the same model) produced very different code quality. Some generated clean, idiomatic Pygame code; others produced broken imports, incorrect game logic, or spurious methods.
- **Debugging AI-generated code is harder than debugging your own.** When the code doesn't match your mental model, you can't quickly spot where the logic diverges. Each bug fix required reading unfamiliar generated code carefully.
- **Test-driven workflow is essential but easy to skip.** When each iteration is fast, the temptation to skip tests is high. Several regressions snuck in and had to be fixed in follow-up commits.
- **Cross-platform packaging still needs human attention.** PyInstaller and Debian packaging worked, but the spec file needed manual tweaks for hidden imports. Not something AI handled correctly out of the box.
- **Themes beyond "well-worn patterns" require more human input.** The pirate property-trading game variant needed original board layout, property names, rule modifications, and balancing. AI generated plausible-looking structures but the human had to redesign the game logic.

## Human intervention needed

- **Game design decisions.** Each of the four games is a classic with a pirate reskin. The human chose the flavor, the visual direction, the balance tweaks.
- **Project structure and architecture.** AI tends to write monolithic scripts. The human imposed a modular structure with separate game packages, shared constants, and a launcher.
- **Cross-platform packaging.** AI doesn't know your target platform's packaging conventions. The human wrote the Debian packaging and PyInstaller spec.
- **Testing strategy.** AI generated some tests, but the human decided what to test and organized the test suite.
- **Visual and narrative consistency.** The pirate theme needed a human to name things, pick colors, write descriptions, and ensure the tone was consistent.
- **Code review.** Every AI-generated block was reviewed for correctness, security, and style before committing. AI hallucinations in method calls and import paths are real.

## What I'd try next

- **Start with tests first.** Write the test suite before the game logic, then use AI to fill in implementations that pass.
- **Use AI for targeted refactoring.** Instead of generating entire games, use it to extract patterns, write utility functions, or refactor existing code.
- **Add a human-in-the-loop code review step to the workflow.** A linter and type checker running automatically would catch the most common AI mistakes.
- **Explore AI-assisted documentation generation.** Writing docs is the least enjoyable part of shipping. AI is well-suited to first-pass documentation.
- **Consider embedding the games in the browser.** Porting Pygame games to WebAssembly or rewriting in a web-native framework would make the arcade playable without installation. This is a future project.

## Comparison notes

I've used several paid AI coding tools in professional contexts. The free-to-use models accessed through OpenCode are competitive for well-documented patterns and common frameworks. The gap shows up in:

1. **Context window management** — paid tools handle larger contexts more reliably
2. **Consistent output quality** — paid tools have less variance between runs
3. **Edge case handling** — niche frameworks or less common patterns benefit from the larger training sets of paid models
4. **Integration polish** — paid tools tend to have smoother editor integration

That said, "free and good enough to ship" is an incredible capability. The zero-cost constraint forced better engineering discipline: clearer prompts, smaller diffs, more frequent commits, and more thorough review. That discipline improved the output.

---

_This is a living document. As the project evolves, I'll update this post with new findings and updated tool comparisons._
