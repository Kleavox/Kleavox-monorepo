# DeauOne

Central auth service built on Cloudflare Workers. Provides SSO via a shared cookie across subdomains, supporting email/password and OAuth (Google, GitHub).

## Stack

- **Runtime**: Cloudflare Workers
- **Language**: Go (compiled to WASM) + TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Sessions**: Cloudflare KV
- **Email**: Resend

## Features

- Email/password registration with OTP email verification
- Password reset via OTP
- Google OAuth (popup flow)
- GitHub OAuth (popup flow)
- JWT signed with HMAC-SHA256
- SSO via `HttpOnly` cookie shared across subdomains
- Session invalidation on logout (KV blocklist)

## Endpoints

```
GET  /                       → health check
POST /auth/register          → register + send verification OTP
POST /auth/verify            → verify OTP, activate account
POST /auth/login             → email/password → JWT + set cookie
POST /auth/logout            → invalidate session + clear cookie
POST /auth/forgot-password   → send password reset OTP
POST /auth/reset-password    → verify OTP + set new password
GET  /auth/me                → return user from session
GET  /auth/verify-token      → validate JWT (for other workers)
GET  /oauth/google           → start Google OAuth (popup)
GET  /oauth/github           → start GitHub OAuth (popup)
GET  /oauth/callback/google  → Google OAuth callback
GET  /oauth/callback/github  → GitHub OAuth callback
```

## JWT Payload

```json
{
  "sub":   "user-id",
  "email": "user@example.com",
  "name":  "User Name",
  "role":  "USER",
  "iss":   "deauone",
  "exp":   1234567890
}
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create D1 database and KV namespace

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

### 5. Update wrangler.toml

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

## OAuth Redirect URIs

Register these in Google Console and GitHub:

```
https://auth.yourdomain.com/oauth/callback/google
https://auth.yourdomain.com/oauth/callback/github
```

## Popup Flow (client side)

```javascript
function loginWithOAuth(provider) {
  const popup = window.open(
    `https://auth.yourdomain.com/oauth/${provider}?origin=${encodeURIComponent(window.location.origin)}`,
    'oauth',
    'width=500,height=600'
  );

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'deauone:oauth:done') {
      popup.close();
      // cookie is now set, reload or redirect
    }
  });
}
```

## Verifying JWT in other workers

```typescript
const cookie = parseCookie(request.headers.get('Cookie'))['sid'];
const res = await fetch('https://auth.yourdomain.com/auth/verify-token', {
  headers: { Authorization: `Bearer ${cookie}` }
});
const { valid, payload } = await res.json();
```

Or verify locally with the shared `DEAUONE_JWT_SECRET` using HMAC-SHA256.
