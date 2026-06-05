# Production Deployment

Production deployment is intentionally split into resource bootstrap, Worker
staging, canonical domain attachment, data migration, and legacy cutover.

## Credential Boundary

Repository code and documentation contain placeholders only. Authentication,
resource creation, secret entry, GitHub publishing, and Cloudflare deployment
are performed by the repository owner.

Never place credentials in:

- committed `.env` or `.dev.vars` files
- Wrangler configuration committed to the repository
- shell history shared with another person
- issues, pull requests, screenshots, or chat

Use your own local Wrangler session for interactive work. Use GitHub's
`production` environment for automated deployment. The deployment renderer
reads environment variable names but does not contain their values.

## 1. Authenticate and Create Resources

Restore Wrangler authentication:

```powershell
pnpm exec wrangler login
pnpm exec wrangler whoami
```

These commands open or inspect your local Cloudflare session. Run them
yourself. No credential value needs to be copied into this repository.

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

Enter the token directly into the GitHub `production` environment as
`CLOUDFLARE_API_TOKEN`.

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

## Direct CLI Alternative

GitHub Actions is the recommended repeatable path. To deploy from your own
machine instead, export the required placeholder-named environment values in
your private shell session, then render:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "<ACCOUNT_ID>"
$env:ZARKIV_PASS_D1_ID = "<PASS_D1_ID>"
$env:ZARKIV_PASS_KV_ID = "<PASS_KV_ID>"
$env:ZARKIV_LINK_D1_ID = "<LINK_D1_ID>"
$env:ZARKIV_PULSE_D1_ID = "<PULSE_D1_ID>"
$env:ZARKIV_DROP_D1_ID = "<DROP_D1_ID>"

pnpm build
pnpm deploy:render --domains none
```

Set Worker secrets interactively so they are never written to a command:

```powershell
pnpm exec wrangler secret put RESEND_API_KEY --config .wrangler\deploy\pass.json
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --config .wrangler\deploy\pass.json
pnpm exec wrangler secret put IP_HASH_SECRET --config .wrangler\deploy\pass.json

pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --config .wrangler\deploy\drop.json
pnpm exec wrangler secret put GUEST_HASH_SECRET --config .wrangler\deploy\drop.json
pnpm exec wrangler secret put DOWNLOAD_SIGNING_SECRET --config .wrangler\deploy\drop.json
pnpm exec wrangler secret put PASSWORD_HASH_SECRET --config .wrangler\deploy\drop.json
```

Apply migrations and deploy in dependency order:

```powershell
pnpm exec wrangler d1 migrations apply DB --remote --config .wrangler\deploy\pass.json
pnpm exec wrangler d1 migrations apply DB --remote --config .wrangler\deploy\link.json
pnpm exec wrangler d1 migrations apply DB --remote --config .wrangler\deploy\pulse.json
pnpm exec wrangler d1 migrations apply DB --remote --config .wrangler\deploy\drop.json

pnpm exec wrangler deploy --strict --config .wrangler\deploy\pass.json
pnpm exec wrangler deploy --strict --config .wrangler\deploy\link.json
pnpm exec wrangler deploy --strict --config .wrangler\deploy\pulse.json
pnpm exec wrangler deploy --strict --config .wrangler\deploy\drop.json
pnpm exec wrangler deploy --strict --config .wrangler\deploy\gateway.json
```

Render again with `--domains canonical` only after workers.dev validation.
Render with `--domains legacy` only after migration parity checks.
