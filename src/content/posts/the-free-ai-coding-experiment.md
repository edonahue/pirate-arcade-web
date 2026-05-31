---
title: "The Free AI Coding Experiment: Method & Findings"
description: "How this project evaluates free-to-use AI coding tools: the constraint, the workflow, the evaluation rubric, and what will and will not be claimed."
pubDate: 2026-05-31
draft: false
---

## The Constraint

Build a complete, polished, public-facing software project — both a desktop game collection and its marketing website — using **only free AI coding tools, free infrastructure, and locally owned hardware.**

No paid AI subscriptions. No cloud compute credits. No SaaS lock-in. No team budget.

The question isn't "Is AI-generated code as good as a senior engineer?" It's "How much of a real project can a single developer ship with zero financial outlay for tooling?"

## Hardware and Environment

All work was done on a locally-owned X600 consumer workstation. No cloud GPU instances, no rented compute, no corporate hardware. The exact same hardware anyone could use at home.

Node.js 22 for the website, Python 3.10+ for the games. All inference ran through OpenCode's terminal interface — no IDE plugins, no web UIs, no proprietary platforms.

## Free Models Tested

| Model                       | Primary Use                    | Notes                        |
| --------------------------- | ------------------------------ | ---------------------------- |
| **DeepSeek V4 Flash Free**  | Game logic (Python/Pygame)     | Primary model for game tasks |
| **Nemotron 3 Super Free**   | Alternative game generation    | Comparison baseline          |
| **Big Pickle OpenCode Zen** | Website (Astro), documentation | Strong on structure          |

Each model was accessed through OpenCode's model routing. No direct API calls, no per-token billing, no rate limits beyond what OpenCode's free tier provides.

## Prompting Workflow

The workflow was structured as iterative task files, not conversational chat:

1. **Specify the task** in natural language with acceptance criteria
2. **Generate initial implementation** via AI
3. **Review every line** for correctness, security, and style
4. **Test the output** (automated tests where they existed, manual smoke tests otherwise)
5. **Iterate on failures** with targeted correction prompts
6. **Commit** only after human sign-off

This is slower than accepting AI output blindly but produces maintainable code. The review step is the bottleneck — and it should be.

## Evaluation Rubric

Each task was evaluated (informally) on these dimensions:

| Dimension                          | Scale                           | Description                                   |
| ---------------------------------- | ------------------------------- | --------------------------------------------- |
| **Time to working implementation** | Minutes / Hours / Days          | How long from prompt to first working version |
| **Intervention cycles**            | Count                           | Number of human correction prompts needed     |
| **Build/test failures**            | Count                           | CI or local test failures caused by AI output |
| **Human review required**          | None / Light / Moderate / Heavy | How much code needed editing after generation |
| **Code maintainability**           | Poor / Fair / Good / Excellent  | Readability, structure, naming, comments      |
| **Output polish**                  | Rough / Functional / Polished   | Visual and UX quality of the result           |
| **Would use again?**               | Yes / With caveats / No         | Overall recommendation for similar tasks      |

No scores are published per-task because the sample is too small for meaningful comparison. The rubric is shared here as a framework for future structured evaluation.

## What Counts as Success

Success is measured by shipped, working, publicly-available software that a real person could download, install, and enjoy. Not by benchmark scores, not by lines of code generated, not by speed alone.

For this project, success means:

- Four playable arcade games available as a desktop download
- A public-facing website that accurately describes the project
- A transparent account of what the AI did and what the human did
- A reproducible workflow that could be applied to future projects

## What Will Be Compared Against Paid Tools

The comparison notes in this project are based on the author's professional experience using paid AI coding tools (GitHub Copilot, Cursor, and similar) in enterprise settings. The comparisons are:

- Observable, not measured — no controlled benchmarks were run
- Specific to the task types in this project
- Limited to what the free models could or could not do
- Stated as observations, not product reviews

Specific comparisons are documented in each build post where relevant.

## What Will Not Be Claimed

- **No benchmark results.** No standardized test suites, no leaderboard comparisons, no quantitative scores across models.
- **No general claims about model quality.** Results may vary by task, domain, framework, and prompt quality.
- **No claims about paid tools being "not worth it."** Paid tools provide real value in specific contexts. This project just didn't need them.
- **No claims about AI replacing developers.** The human wrote zero lines of production code in the traditional sense but still did hours of architecture, review, testing, and debugging. AI is a force multiplier, not a replacement.
- **No claims about this workflow being optimal.** This is one approach, tested once, on one project. Your mileage will vary.

## Next Steps for This Experiment

1. Test additional free models as they become available
2. Run structured side-by-side comparisons on the same task
3. Document time-to-implementation more precisely
4. Add automated quality gates that catch common AI mistakes (type errors, missing imports, incorrect APIs)
5. Try the same workflow on a less well-known problem domain
6. Port one game to the browser and document where AI helps or hinders

---

_This methodology is a living document. As the project evolves and more models are tested, this page will be updated with new findings._
