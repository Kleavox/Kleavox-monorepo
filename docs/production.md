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

## Deployment Model

The recommended production model is:

1. Create the Cloudflare resources once through the Cloudflare dashboard.
2. Store their identifiers and credentials in GitHub's protected
   `production` environment.
3. Start deployments from GitHub Actions.
4. Let the workflow run the repository's pinned Wrangler version inside the
   GitHub runner.

GitHub Actions is the deployment controller; Wrangler is the Cloudflare CLI
used inside that controller. This does not require `wrangler login` on the
owner's computer.

## 1. Create Cloudflare Resources in the Dashboard

In the Cloudflare dashboard, select the account that owns `zarkiv.com` and
create:

| Product | Resource type | Exact name |
| --- | --- | --- |
| Pass | D1 database | `zarkiv-pass` |
| Link | D1 database | `zarkiv-link` |
| Pulse | D1 database | `zarkiv-pulse` |
| Drop | D1 database | `zarkiv-drop` |
| Pass | Workers KV namespace | `zarkiv-pass-sessions` |
| Drop | R2 bucket | `zarkiv-drop` |

Use **Workers & Pages** or **Storage & Databases** in the dashboard navigation:

1. Open **D1 SQL database**, click **Create database**, and create each of the
   four names above.
2. Open **KV**, click **Create instance**, and create
   `zarkiv-pass-sessions`.
3. Open **R2 object storage**, click **Create bucket**, and create
   `zarkiv-drop`.

Keep the legacy D1 databases unchanged until the migration audit is complete.

## 2. Collect Every GitHub Value

Add values only under:

```text
GitHub repository
  Settings
    Environments
      production
        Environment secrets and variables
```

### Cloudflare Authentication

#### `CLOUDFLARE_ACCOUNT_ID`

1. Open the Cloudflare dashboard.
2. Select the correct account.
3. Open **Workers & Pages**.
4. Copy **Account ID** from the account details section.
5. Create a GitHub environment secret named `CLOUDFLARE_ACCOUNT_ID`.

This identifier is not a password, but keep it in the environment with the
other deployment configuration.

#### `CLOUDFLARE_API_TOKEN`

1. In Cloudflare, open the user menu -> **My Profile** -> **API Tokens**.
2. Click **Create Token**.
3. Start with **Edit Cloudflare Workers**, then customize the permissions.
4. Use a descriptive name such as `zarkiv-github-production`.
5. Grant these account permissions:
   - **Workers Scripts: Edit**
   - **D1: Edit**
   - **Workers KV Storage: Edit**
   - **Workers R2 Storage: Edit**
6. Grant these zone permissions:
   - **Workers Routes: Edit**
   - **Zone: Read**
7. Restrict account resources to the account containing Zarkiv.
8. Restrict zone resources to `zarkiv.com` and, while legacy routes are used,
   `deau.site`.
9. Create the token and copy it immediately.
10. Create a GitHub environment secret named `CLOUDFLARE_API_TOKEN`.

Do not create an R2 S3 access key. The workflow deploys through Wrangler and
uses the Cloudflare API token above.

### D1 Database IDs

For each database, open **D1 SQL database**, select the database, and copy its
**Database ID** from its overview or settings page:

| Cloudflare database | GitHub environment secret |
| --- | --- |
| `zarkiv-pass` | `ZARKIV_PASS_D1_ID` |
| `zarkiv-link` | `ZARKIV_LINK_D1_ID` |
| `zarkiv-pulse` | `ZARKIV_PULSE_D1_ID` |
| `zarkiv-drop` | `ZARKIV_DROP_D1_ID` |

The D1 ID is a UUID. Do not paste the database name where the workflow expects
the ID.

### Workers KV Namespace ID

1. Open **KV** in Cloudflare.
2. Select `zarkiv-pass-sessions`.
3. Copy its **Namespace ID**.
4. Store it as GitHub environment secret `ZARKIV_PASS_KV_ID`.

The KV namespace ID is typically a 32-character hexadecimal identifier.

### R2 Bucket Name

R2 needs its bucket name, not an ID. Under the GitHub environment's
**Environment variables**, optionally create:

```text
ZARKIV_DROP_BUCKET=zarkiv-drop
```

Omitting it is safe because the workflow defaults to `zarkiv-drop`.

### Turnstile Keys

One production widget is shared by Pass and Drop:

1. In Cloudflare, open **Turnstile**.
2. Click **Add widget**.
3. Name it `zarkiv-production`.
4. Add hostnames `pass.zarkiv.com` and `drop.zarkiv.com`.
5. Select **Managed** mode.
6. Create the widget.
7. Copy both generated values.

Store them as:

| Turnstile value | GitHub environment secret |
| --- | --- |
| Sitekey, public browser identifier | `ZARKIV_TURNSTILE_SITE_KEY` |
| Secret key, server-side credential | `ZARKIV_TURNSTILE_SECRET_KEY` |

The sitekey is technically public, but the current workflow consumes it as an
environment secret for one consistent setup.

### Resend API Key

Pass uses Resend to deliver login and verification email:

1. Create or open a Resend account.
2. In **Domains**, add a sending domain. A subdomain such as
   `mail.zarkiv.com` is recommended for reputation isolation.
3. Add the DNS records displayed by Resend to Cloudflare DNS.
4. Keep mail verification records **DNS only**, not proxied.
5. Wait until Resend marks the domain verified.
6. Open **API Keys** -> **Create API Key**.
7. Name it `zarkiv-production`.
8. Select **Sending access** and restrict it to the verified domain.
9. Copy the key when it is shown.
10. Store it as `ZARKIV_PASS_RESEND_API_KEY`.

The current production sender is `Zarkiv <no-reply@zarkiv.com>`. If the Resend
sending domain is a subdomain, update `FROM_EMAIL` in the deployment renderer
to an address covered by that verified domain before deploying.

### Application-Generated Secrets

These are not obtained from Cloudflare or GitHub. Generate four independent
random values locally. In PowerShell:

```powershell
function New-ZarkivSecret {
  $bytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  [Convert]::ToBase64String($bytes)
}

1..4 | ForEach-Object { New-ZarkivSecret }
```

The command prints four random values. Assign each line to exactly one GitHub
environment secret:

| Generated value | GitHub environment secret | Purpose |
| --- | --- | --- |
| Line 1 | `ZARKIV_PASS_IP_HASH_SECRET` | Pseudonymize Pass audit IP addresses |
| Line 2 | `ZARKIV_DROP_GUEST_HASH_SECRET` | Pseudonymize Drop guest identity |
| Line 3 | `ZARKIV_DROP_DOWNLOAD_SIGNING_SECRET` | Sign Drop download tokens |
| Line 4 | `ZARKIV_DROP_PASSWORD_HASH_SECRET` | Add server-side secret material to protected Drop files |

Do not reuse one value across the four names. Store the values in a password
manager as a recovery record, then place them directly into GitHub.

### Final GitHub Checklist

The `production` environment must contain these 14 secrets:

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

It may also contain the optional environment variable
`ZARKIV_DROP_BUCKET=zarkiv-drop`.

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
