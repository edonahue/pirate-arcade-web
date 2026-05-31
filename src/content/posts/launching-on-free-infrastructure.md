---
title: "Launching Pirate Arcade on Free Infrastructure"
description: "How Pirate Arcade v2.0.0 ships to users with zero cloud spend — GitHub free tier for CI and releases, Cloudflare Pages for the site, and a local workstation for everything else."
pubDate: 2026-05-31
draft: false
---

## The Setup

Pirate Arcade v2.0.0 is live. The desktop game collection — four pirate-themed arcade games, a launcher, procedural audio, high score tracking — and this website all run on infrastructure that costs exactly zero dollars per month.

Here's how.

## Website: Cloudflare Pages (Free Tier)

This site is an Astro static site deployed on Cloudflare Pages. The free tier gives:

- **Unlimited static sites** — one project, zero worrying about site count
- **500 builds per month** — more than enough for a personal project
- **1 GB storage** — the entire site, including screenshots and assets, fits comfortably
- **Unlimited bandwidth** — no surprise bills if a post gets popular
- **Global CDN** — automatic SSL, edge caching, worldwide distribution

No Workers, no D1 database, no R2 object storage. The site is fully static, served directly from Cloudflare's edge.

## Desktop Releases: GitHub Releases (Free Tier)

The game binaries live on GitHub Releases. The free tier includes:

- **500 MB release storage** — the Windows .exe is ~35 MB, the Linux .deb is ~30 MB. Room to grow.
- **Unlimited downloads** — no transfer limits
- **CI-built packaging** — GitHub Actions builds and uploads both platforms on every tagged push

The release pipeline:

1. Push a tag
2. GitHub Actions builds the game with PyInstaller
3. CI packages Windows `.exe` and Linux `.deb`
4. Action creates a GitHub Release and uploads both assets
5. Website links point directly to the release download URLs

## Source Control and CI: GitHub Free Tier

- **Unlimited public repositories** — game code and website code live in separate repos
- **2000 CI minutes per month** — plenty for a project that builds on tag pushes and PRs
- **Issue tracking** — free project management

## Everything Else: Local Hardware

All development, inference, testing, and packaging runs on a locally-owned X600 workstation. No cloud compute, no rented GPUs, no SaaS subscriptions.

## The Cost Breakdown

| Service                  | What It Provides               | Monthly Cost  |
| ------------------------ | ------------------------------ | ------------- |
| Cloudflare Pages         | Site hosting, CDN, SSL         | $0            |
| GitHub Free              | Source control, CI, releases   | $0            |
| Local workstation        | Development, inference, builds | Already owned |
| AI models (via OpenCode) | Code generation assistance     | $0            |
| **Total**                |                                | **$0/month**  |

## What This Means

For a solo developer building a public-facing project, the free tiers of GitHub and Cloudflare are genuinely sufficient. No paid upgrade is needed until you need:

- Private repositories with many collaborators
- More than 2000 CI minutes per month
- Large-scale binary distribution (500 MB+ of release artifacts)
- Server-side logic (auth, databases, API endpoints)

For a static site distributing a few desktop game binaries, free infrastructure is not a compromise — it's the right tool for the job.
