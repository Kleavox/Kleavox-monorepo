# DeauOne

Central auth service built on Cloudflare Workers. Provides SSO across subdomains via a shared secure cookie, supporting email/password and OAuth.

## Stack

- **Runtime**: Cloudflare Workers
- **Language**: Go (compiled to WASM) + TypeScript
- **Database**: Cloudflare D1
- **Sessions**: Cloudflare KV
- **Email**: Resend

## Features

- Email/password registration with OTP verification
- Password reset via OTP
- Google and GitHub OAuth
- JWT-based sessions with server-side invalidation
- SSO via shared HttpOnly cookie across subdomains

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create Cloudflare resources

```bash
wrangler d1 create deauone
wrangler kv namespace create deauone-sessions
```

Fill the returned IDs into `wrangler.toml`.

### 3. Run schema migration

```bash
wrangler d1 execute deauone --remote --file=./schema.sql
```

### 4. Set secrets

```bash
wrangler secret put DEAUONE_JWT_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

### 5. Configure wrangler.toml

```toml
[vars]
BASE_URL = "https://auth.yourdomain.com"
COOKIE_DOMAIN = ".yourdomain.com"
FROM_EMAIL = "noreply@yourdomain.com"
```

### 6. Deploy

```bash
npm run deploy
```

## OAuth Setup

Register these callback URLs in Google Console and GitHub OAuth app:

```
https://auth.yourdomain.com/oauth/callback/google
https://auth.yourdomain.com/oauth/callback/github
```

## CI/CD

Deployment via GitHub Actions on push to `master`. Required GitHub Secrets:

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
D1_DATABASE_ID
KV_NAMESPACE_ID
BASE_URL
COOKIE_DOMAIN
FROM_EMAIL
```
