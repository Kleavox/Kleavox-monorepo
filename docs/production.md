# Production Deployment

Production deployment is intentionally split into resource bootstrap, Worker
staging, canonical domain attachment, data migration, and legacy cutover.

## 1. Authenticate and Create Resources

Restore Wrangler authentication:

```powershell
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Create fresh resources and record their IDs:

```powershell
pnpm exec wrangler d1 create zarkiv-pass
pnpm exec wrangler d1 create zarkiv-link
pnpm exec wrangler d1 create zarkiv-pulse
pnpm exec wrangler d1 create zarkiv-drop
pnpm exec wrangler kv namespace create zarkiv-pass-sessions
pnpm exec wrangler r2 bucket create zarkiv-drop
```

Keep the legacy D1 databases unchanged until the migration audit is complete.

## 2. Configure GitHub

Create a protected GitHub environment named `production`. Add:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
ZARKIV_PASS_D1_ID
ZARKIV_PASS_KV_ID
ZARKIV_LINK_D1_ID
ZARKIV_PULSE_D1_ID
ZARKIV_DROP_D1_ID
ZARKIV_PASS_RESEND_API_KEY
ZARKIV_TURNSTILE_SECRET_KEY
ZARKIV_TURNSTILE_SITE_KEY
ZARKIV_PASS_IP_HASH_SECRET
ZARKIV_DROP_GUEST_HASH_SECRET
ZARKIV_DROP_DOWNLOAD_SIGNING_SECRET
ZARKIV_DROP_PASSWORD_HASH_SECRET
```

Optionally set environment variable `ZARKIV_DROP_BUCKET`; it defaults to
`zarkiv-drop`.

The Cloudflare token needs Worker Scripts, D1, Workers KV, R2, and zone route
permissions for the two owned zones. Use the narrowest account and zone scope
that permits those operations.

## 3. Stage on workers.dev

Run the `Deploy Zarkiv` workflow with:

```text
domains: none
apply_migrations: true
```

This deploys all five Workers without attaching public domains. Verify every
`workers.dev` health endpoint, browser application, Pass email flow, Link
redirect, Pulse enrollment, and Drop upload/download lifecycle.

## 4. Migrate Legacy Data

Follow [migration.md](migration.md). Keep `deau.site`, `bit.deau.site`, and
`board.deau.site` on their existing Workers while target counts and sampled
records are checked.

## 5. Attach Canonical Domains

Run the deployment workflow again with:

```text
domains: canonical
apply_migrations: false
```

Verify:

```text
https://zarkiv.com/health
https://pass.zarkiv.com/health
https://link.zarkiv.com/health
https://pulse.zarkiv.com/health
https://drop.zarkiv.com/health
```

Also test an existing migrated slug through `https://zarkiv.com/{slug}` and
confirm the shared Pass cookie works across protected products.

## 6. Legacy Cutover

Only after parity checks pass, run:

```text
domains: legacy
apply_migrations: false
```

The Gateway then owns:

- `deau.site/{slug}` for direct legacy slug resolution
- `port.deau.site` redirecting to `zarkiv.com`
- `bit.deau.site` redirecting to `link.zarkiv.com`
- `one.deau.site` redirecting to `pass.zarkiv.com`
- `board.deau.site` redirecting to `pulse.zarkiv.com`

Keep database exports and the previous Worker deployments available through
the validation window.

## Rollback

1. Reattach canonical or legacy domains to the previous Worker deployment.
2. Do not roll back migrated databases destructively.
3. Restore reads from the legacy databases while investigating.
4. Redeploy with `domains: none` when a new build must be isolated from public
   traffic.

Generated configs and secret files live under ignored `.wrangler/deploy/`.
