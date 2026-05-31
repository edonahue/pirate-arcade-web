# Deployment

This site deploys to Cloudflare Pages from the GitHub repo.

## Cloudflare Pages Setup

1. Go to Cloudflare Dashboard > Workers & Pages > Create application.
2. Choose **Pages**, not Worker.
3. Choose **Connect to Git** and select the repository.
4. Use these build settings:

```text
Project name: pirate-arcade-com
Framework preset: Astro
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 22
```

This is a static Cloudflare Pages site. The setup flow should not ask for
a deploy command, version command, Worker URL, bindings, or compatibility
date. If those fields appear, the project is in the Workers flow; back out
and create a new Pages project instead.

If Cloudflare asks for an environment variable, set:

```text
NODE_VERSION=22
```

## DNS

After the Pages project is created, configure DNS:

```text
pirate-arcade.com      CNAME  pirate-arcade-com.pages.dev  proxied
www.pirate-arcade.com  CNAME  pirate-arcade-com.pages.dev  proxied
```

## Canonical www Redirect

Cloudflare Pages `_redirects` does not support domain-level redirects, so the
`www` to apex redirect must be configured in Cloudflare, not in
`public/_redirects`.

Create a Bulk Redirect List and rule in Cloudflare Dashboard:

1. Go to Cloudflare Dashboard > Rules > Redirect Rules > Bulk Redirects.
2. Create a redirect list entry:

```text
Source URL: www.pirate-arcade.com
Target URL: https://pirate-arcade.com
Status: 301
Preserve query string: enabled
Subpath matching: enabled
Preserve path suffix: enabled
Include subdomains: disabled
```

3. Create or enable a Bulk Redirect rule using that list.

## Static Headers

Cloudflare Pages reads `public/_headers` during deploy. The current
configuration sets HSTS, content-type sniffing protection, referrer policy,
permissions policy, and a CSP that allows Google Fonts and inline theme
scripts.

## Local Verification

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
npm run build
```

The build should create static output in `dist/` and generate a sitemap.

## Troubleshooting

### Cloudflare asks for a deploy or version command

If the build log says:

```text
Executing user deploy command: npx wrangler deploy
```

or the dashboard requires:

```text
Deploy command
Version command
```

the Cloudflare project is configured like a Worker deployment. Create a new
Pages project using the setup steps above.

### `npm ci` reports package/lock mismatch

`package.json` and `package-lock.json` must stay in sync because Cloudflare
uses `npm clean-install`. Run this locally before pushing dependency changes:

```bash
source ~/.nvm/nvm.sh
nvm use
npm ci
npm run build
```
