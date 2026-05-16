# deauport

Personal portfolio of Hafidh Musyafa (VorDeau). Built with Astro and deployed on Cloudflare Workers.

## Stack

| Layer | Technology |
|---|---|
| Framework | Astro 6 |
| UI | React 19, Tailwind CSS v4 |
| Runtime | Cloudflare Workers |
| Email | Resend |
| Bot protection | Cloudflare Turnstile |
| Fonts | Inter Variable, JetBrains Mono Variable |

## Local Development

```bash
npm install
npm run dev          # Astro dev server at localhost:4321
```

To test with the actual Workers runtime (contact form, Turnstile):

```bash
# 1. Create .env in root
PUBLIC_TURNSTILE_SITE_KEY=your_site_key

# 2. Create .dev.vars in root
RESEND_API_KEY=your_resend_key
TURNSTILE_SECRET_KEY=your_turnstile_secret

# 3. Build and run with Wrangler
npm run workers      # builds then runs at localhost:8787
```

## Deployment

Deployed automatically via GitHub Actions on push to `main`.

Required GitHub Secrets:

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | CF API token with Workers edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key (injected at build time) |

Required Wrangler Secrets (set once via CLI):

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Astro dev server (localhost:4321) |
| `npm run build` | Build to ./dist |
| `npm run workers` | Build + Wrangler dev (localhost:8787) |
| `npm run generate-types` | Generate Wrangler type definitions |
