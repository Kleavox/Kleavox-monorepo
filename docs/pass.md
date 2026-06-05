# Zarkiv Pass

Pass is the identity boundary for every Zarkiv product. It owns registration,
email verification, password authentication, account recovery, session
issuance, and global account state.

## Local Development

Copy the example environment files and provide local values when the related
integration is enabled:

```text
workers/pass/.dev.vars.example -> workers/pass/.dev.vars
apps/pass/.env.example -> apps/pass/.env
```

`IP_HASH_SECRET` should be a long random value. Resend and Turnstile may remain
unset during local development; account email is written to the Worker log and
challenge verification is skipped outside production.

Apply the local D1 migrations and start Pass from the repository root:

```bash
pnpm exec wrangler d1 migrations apply zarkiv-pass --local --config workers/pass/wrangler.jsonc
pnpm --filter @zarkiv/pass-worker exec wrangler dev --port 8787
```

The Pass application is then available at `http://127.0.0.1:8787`.

## Production Resources

Production configs are rendered outside source control from GitHub environment
values. Follow `docs/production.md` to configure:

- D1 database bound as `DB`
- KV namespace bound as `SESSIONS`
- static application assets bound as `ASSETS`
- route for `pass.zarkiv.com`
- Service Binding from protected product Workers to Pass

Set these Worker secrets with Wrangler or the Cloudflare dashboard:

```text
RESEND_API_KEY
TURNSTILE_SECRET_KEY
IP_HASH_SECRET
```

Set `VITE_TURNSTILE_SITE_KEY` when building the production frontend. Configure
`PUBLIC_ORIGIN` as `https://pass.zarkiv.com`, `ROOT_DOMAIN` as `zarkiv.com`, and
use a verified sender for `FROM_EMAIL`.

## Session Contract

The browser receives an opaque `__Secure-zarkiv_session` cookie. Only a hash of
that token is used as the KV key. Product Workers validate the cookie through
the private Pass Service Binding and receive a bounded identity response.

Password reset and explicit global sign-out increment the account auth version,
which invalidates every previously issued session.

## Verification

Run the focused Pass checks:

```bash
pnpm --filter @zarkiv/pass-worker typecheck
pnpm --filter @zarkiv/pass-worker test
pnpm --filter @zarkiv/pass-app typecheck
pnpm --filter @zarkiv/pass-app build
pnpm --filter @zarkiv/pass-worker build
```
