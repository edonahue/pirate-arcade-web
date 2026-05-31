# Free AI Coding Experiment

This project is a structured experiment in zero-cost AI-assisted development.

## The Question

How much of a real software project can a single developer ship using only free AI coding tools, free cloud infrastructure, and locally-owned hardware?

## The Constraint

- No paid AI subscriptions (no ChatGPT Pro, no Claude Pro, no Copilot paid tier)
- No cloud compute credits (no AWS/GCP/Azure GPU instances)
- No SaaS subscriptions for tooling
- No enterprise or employer-provided licenses
- Only hardware already owned

## The Tools (all free tier or already owned)

| Tool                                             | Category                     | Cost          |
| ------------------------------------------------ | ---------------------------- | ------------- |
| [OpenCode](https://opencode.ai)                  | AI terminal coding agent     | Free          |
| DeepSeek V4 Flash Free                           | AI model                     | Free          |
| Nemotron 3 Super Free                            | AI model                     | Free          |
| Big Pickle OpenCode Zen                          | AI model                     | Free          |
| [GitHub](https://github.com)                     | Source control, CI, releases | Free tier     |
| [Cloudflare Pages](https://pages.cloudflare.com) | Static site hosting          | Free tier     |
| X600 local workstation                           | Hardware                     | Already owned |
| [Astro](https://astro.build)                     | Web framework (OSS)          | Free          |
| Python + Pygame                                  | Game framework (OSS)         | Free          |

## What Was Built

1. **Desktop Game Collection** — four classic arcade games reimagined with a pirate theme (Python/Pygame)
2. **Public Website** — landing page, build log, experiment documentation (Astro/Cloudflare Pages)
3. **Release Pipeline** — cross-platform packaging, CI, GitHub Releases

## The Workflow

1. Human specifies task with natural language and acceptance criteria
2. AI generates initial implementation
3. Human reviews every line
4. Human tests, debugs, and corrects
5. Human commits only after sign-off

## Key Findings

See [The Pirate Arcade Experiment](/build-log/the-pirate-arcade-experiment) and [Method & Findings](/build-log/the-free-ai-coding-experiment) for detailed findings.

## What Is Not Claimed

- No benchmark scores or quantitative model comparisons
- No general claims about AI model quality
- No claims that paid tools are "not worth it"
- No claims about AI replacing developers
- No claims that this workflow is optimal for everyone

## See Also

- [Asset Inventory](./ASSETS.md)
- [Roadmap](./ROADMAP.md)
- [Desktop Game Repo](https://github.com/edonahue/pirate-arcade)
