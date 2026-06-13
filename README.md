# Kleavox

Kleavox is a Cloudflare-first suite for identity, short links, temporary file
sharing, infrastructure monitoring, and a portfolio.

## Services

| Service | Production address            | Purpose                                       |
| ------- | ----------------------------- | --------------------------------------------- |
| Gateway | `https://<root-domain>`       | Website, short links, and file links          |
| Link    | `https://link.<root-domain>`  | Short-link and file-sharing workspace         |
| Pass    | `https://pass.<root-domain>`  | Account, email auth, Google, and GitHub OAuth |
| Pulse   | `https://pulse.<root-domain>` | Infrastructure monitoring                     |
| Port    | `https://port.<root-domain>`  | Portfolio (separate private repo, own CI/CD)  |

File links use `https://<root-domain>/f_<token>`. Short-link slugs cannot use the
reserved `f_` prefix, so both products share the root namespace without
collisions. The Link Worker serves both short links and the file-sharing API
(R2 uploads, downloads, moderation, and the cleanup cron) — there is no separate
file Worker.

The portfolio lives in the separate private `Kleavox/portfolio` repository and
deploys independently; the gateway reaches it through the `PORTFOLIO` service
binding, which only requires the worker name `${WORKER_PREFIX}-portfolio` to
stay in sync between the two repos.

## Repository layout

| Path                   | Contents                                                                   |
| ---------------------- | -------------------------------------------------------------------------- |
| `apps/link`            | React workspace for short links and file drops (includes the receive page) |
| `apps/pass`            | React auth app: sign in, register, account, security challenge             |
| `apps/pulse`           | React monitoring dashboard                                                 |
| `apps/web`             | Astro marketing site served by the gateway                                 |
| `workers/gateway`      | Root-domain router: short links, file links, subdomain proxying            |
| `workers/link`         | Short-link + file API: resolution, R2 multipart uploads, quotas, cleanup cron |
| `workers/pass`         | Auth API: sessions (KV), users (D1), OAuth, email, challenge verification  |
| `workers/pulse`        | Monitoring API: nodes, checks, incidents, agent enrollment                 |
| `packages/auth`        | Shared session/challenge/Turnstile verification helpers                    |
| `packages/core`        | Shared types, constants, `apiFetch`/`ApiError` client, `renderErrorPage`   |
| `packages/config`      | Shared origins, hosts, and cookie names                                    |
| `packages/crypto`      | Rust/WASM wrapper: Argon2 password hashing, AES-256-GCM encryption         |
| `packages/compression` | Rust/WASM wrapper: browser-side gzip before upload                         |
| `packages/ui`          | Shared stylesheet: `--kvx-*` design tokens and base utilities              |
| `packages/testing`     | Test factories and mocks                                                   |
| `crates/crypto`        | Rust source for the crypto WASM module                                     |
| `crates/compression`   | Rust source for the compression WASM module                                |
| `services/agent`       | Go monitoring daemon installed on nodes (systemd, hardened)                |
| `tooling/`             | Deploy renderer and health-check scripts used by CI                        |

## Stack

- TypeScript, React, Astro, Hono, and Cloudflare Workers
- D1 for relational state, KV for sessions, and R2 for temporary objects
- Rust compiled to WebAssembly for browser-side compression and password hashing
- Go for the lightweight Pulse agent
- pnpm workspaces (with catalog version pinning) and Turborepo

## Requirements

- Node.js 22.12 or newer
- pnpm 10.24
- Go 1.26
- Rust stable with the `wasm32-unknown-unknown` target
- `wasm-pack` 0.15
- A Cloudflare account for production deployment

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked --version 0.15.0
pnpm install
pnpm check
```

## Local development

No environment variables or production credentials are needed for local work:

- Wrangler configs in source control use local placeholder IDs for D1/KV/R2;
  `wrangler dev` provisions local emulations automatically.
- Dev builds of Pass fall back to Cloudflare's public always-pass
  Turnstile test key, and the workers skip Turnstile verification outside
  production, so signup and login work out of the box.
- Dev email delivery is logged to the worker console instead of being sent.

Run a worker locally (each serves its app's built assets):

```bash
pnpm --filter @kleavox/pass-app build
cd workers/pass && pnpm exec wrangler dev --port 8787
```

Workers that call each other (gateway → link → pass) connect through the
Wrangler dev registry when run in separate terminals.

Root scripts (Turbo orchestrates per-workspace tasks):

| Script            | Action                                           |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Run dev tasks across workspaces                  |
| `pnpm build`      | Build every app, worker, and package             |
| `pnpm test`       | Run all test suites                              |
| `pnpm typecheck`  | Typecheck all workspaces                         |
| `pnpm lint`       | Lint all workspaces                              |
| `pnpm check`      | lint + typecheck + test + build + Go agent tests |
| `pnpm agent:test` | Go agent tests only                              |

Copy each app's `.env.example` to `.env.local` only when overriding defaults.
Worker secrets belong in ignored `.dev.vars` files and must never be committed.

## Architecture notes

**Auth and the security challenge.** Pass guards account creation and password
resets behind a Turnstile challenge that runs invisibly in the background while
the user fills the form (login needs no challenge at all); `POST /api/challenge`
sets a short-lived verification cookie (`fresh` 30 min, `basic` 24 h, scoped to
the root domain). Guest actions across the suite — creating public short links,
uploading files, and filing reports — require a `basic` verification, enforced
server-side via the Pass service binding. Accounts use a unique `username`
(set at registration, or during the `/welcome` onboarding after a first OAuth
sign-in, where a password is optional). Signing in with Google/GitHub using an
email that already has an account never auto-links: a confirmation email must
be approved first. Sessions are KV-backed with hashed tokens; passwords use
Argon2 from the Rust crypto crate.

**WASM in Workers.** The Workers runtime forbids compiling WASM from bytes at
runtime. Workers import the module as precompiled WASM — an import specifier
ending in `.wasm` plus the `CompiledWasm` rule in `wrangler.jsonc` — and pass
it to `initCrypto()`. Browsers and Node use the inlined base64 fallback.

**Error convention.** All APIs return errors as flat `{ code, message }` JSON.
Frontends consume them through the shared `apiFetch`/`ApiError` client in
`@kleavox/core`. User-facing worker HTML errors (expired links, gateway 500s)
render through `renderErrorPage` from the same package.

**File compression.** Link attempts Rust/WASM gzip compression in the browser
before upload and only stores the compressed body when it is at least 10%
smaller. Images, audio, video, PDF files, archives, files below 1 KiB, and
files above 32 MiB skip compression. R2 stores the smaller body with
`Content-Encoding: gzip`, so the browser restores the original during download
without spending Worker CPU.

**File lifecycle.** A 15-minute cron in the Link Worker aborts stale upload
sessions, finalizes stuck completions, deletes expired or exhausted drops, and
garbage-collects old rows.

## Admin

Pulse is the operator console and is restricted to the `ADMIN` role: every
Pulse API endpoint rejects non-admin sessions, the dashboard shows a
"restricted" panel for signed-in non-admins, and Pulse links on the gateway
home page only appear for an admin session. The abuse-report inbox lives in
the Pulse dashboard (Moderation section): it lists short-link and file
reports, and supports resolve/reject, disabling a reported link, and deleting
a reported file. Pulse proxies these actions to the Link Worker via a service
binding; Link re-checks the `ADMIN` role itself.

**First-admin bootstrap.** A fresh deploy has no admin — every account starts
as `USER`, and there is deliberately no promotion endpoint (Pass is the public
identity provider, so auto-promoting "the first user" would be a race). After
the first deploy, register and verify your own account in Pass, then promote it
once:

```bash
# Local:
pnpm admin:promote -- --email you@example.com --local

# Production (resolves the deployed database from these values):
WORKER_PREFIX=<prefix> PASS_D1_ID=<pass-d1-id> pnpm admin:promote -- --email you@example.com

# List current admins:
pnpm admin:promote -- --list [--local]
```

The helper validates the email, refuses to promote a non-existent account, and
warns if the address is unverified (only verified admins receive Pulse report
emails).

Two hard rules: admins cannot delete user accounts (no such endpoint exists —
account deletion is strictly self-service, and works for OAuth-only accounts
too since it requires only a session, a fresh challenge, and typing the
account email), and admins cannot read users' passwords or session tokens
(only hashes are stored).

## Cloudflare Resources

Authenticate Wrangler only on the operator's machine:

```bash
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Create these resources and keep the returned IDs outside the repository:

```bash
pnpm exec wrangler d1 create kleavox-pass
pnpm exec wrangler d1 create kleavox-link
pnpm exec wrangler d1 create kleavox-pulse
pnpm exec wrangler kv namespace create kleavox-pass-sessions
pnpm exec wrangler r2 bucket create kleavox-files
```

Map the returned values to GitHub environment secrets as follows:

```text
kleavox-pass -> PASS_D1_ID
kleavox-link -> LINK_D1_ID
kleavox-pulse -> PULSE_D1_ID
kleavox-pass-sessions -> PASS_KV_ID
```

R2 uses the bucket name `kleavox-files`; it does not require a bucket ID.

The deploy renderer creates Worker configurations from GitHub environment
values. Source-controlled Wrangler files contain local placeholders only.

## GitHub Production Environment

Create a protected GitHub environment named `production`. Add these environment
variables:

```text
APP_ROOT_DOMAIN=<root-domain>
WORKER_PREFIX=<worker-prefix>
DROP_BUCKET_NAME=<bucket-name>
AUTH_FROM_EMAIL=<auth-sender-address>
```

Add these environment secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
PASS_D1_ID
PASS_KV_ID
LINK_D1_ID
PULSE_D1_ID
RESEND_API_KEY
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
IP_HASH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OAUTH_GITHUB_CLIENT_ID
OAUTH_GITHUB_CLIENT_SECRET
GUEST_HASH_SECRET
DOWNLOAD_SIGNING_SECRET
PASSWORD_HASH_SECRET
```

Create a custom Cloudflare API token scoped to the deployment account and
production zone with:

```text
Account / Workers Scripts / Edit
Account / D1 / Edit
Account / Workers KV Storage / Edit
Account / Workers R2 Storage / Edit
Zone / Workers Routes / Edit
```

Do not add `Account Settings / Edit`. Rate-limit namespace IDs are
application-defined integers and do not require a separately provisioned
Cloudflare resource.

Generate independent random values for the four application secrets. Do not
reuse an OAuth secret or API token.

## Google OAuth

1. Open Google Cloud Console, select or create a project, and open Google Auth
   Platform.
2. Under Branding, set the application name, support email, home page,
   `https://<root-domain>/privacy`, and `https://<root-domain>/terms`.
3. Under Audience, choose External.
4. Under Data Access, declare the basic identity scopes used by the application:
   `openid`, `userinfo.email`, and `userinfo.profile`.
5. Under Clients, create a `Web application` client.
6. Leave Authorized JavaScript origins empty because authentication uses the
   server authorization-code flow.
7. Add `https://pass.<root-domain>/api/oauth/callback/google` as the exact
   Authorized redirect URI.
8. Store the client ID and secret as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` in the GitHub `production` environment.
9. After the public home, privacy, and terms pages are live, verify ownership of
   the root domain in Google Search Console, publish the app from Audience, and
   complete brand verification when Google offers or requires it.

The application requests `openid email profile` at runtime. Google may not show
`openid` as a separately selectable scope; it can be prefilled or represented
by the OpenID Connect identity scopes. The redirect URI must match exactly,
including HTTPS and the full path. These basic identity scopes are
non-sensitive; do not add unrelated Google API scopes.

## GitHub OAuth

1. Open GitHub Settings, Developer settings, OAuth Apps.
2. Create a new OAuth App.
3. Set Homepage URL to `https://<root-domain>`.
4. Set Authorization callback URL to
   `https://pass.<root-domain>/api/oauth/callback/github`.
5. Store the generated values as `OAUTH_GITHUB_CLIENT_ID` and
   `OAUTH_GITHUB_CLIENT_SECRET` in the GitHub `production` environment. GitHub
   reserves secret names beginning with `GITHUB_`.

## Resend

Verify the production domain for sending and add the SPF and DKIM records
supplied by Resend to Cloudflare DNS. The configured sender addresses can then
send account and portfolio email.

For receiving:

1. Add `inbound.<root-domain>` as a receiving domain in Resend.
2. Add its MX record to Cloudflare DNS.
3. Submit the portfolio form and confirm the message sent to
   `portfolio@inbound.<root-domain>` appears under Resend
   Receiving.

Resend stores inbound messages even without a webhook. Add an `email.received`
webhook later only when automatic forwarding or processing is required.
Sending and receiving both count toward the Resend account quota.

## Turnstile

Create one managed Turnstile widget and authorize:

```text
<root-domain>
link.<root-domain>
pass.<root-domain>
port.<root-domain>
```

Store the site key and secret in the GitHub `production` environment. The site
key is injected at build time (`VITE_TURNSTILE_SITE_KEY` for Pass,
`PUBLIC_TURNSTILE_SITE_KEY` for the portfolio repo); the secret is a Worker secret
(`TURNSTILE_SECRET_KEY`) on the pass worker (and on the portfolio worker, managed in its own repo). Dev builds fall
back to Cloudflare's public test key automatically. Remove previous hostnames
only after the new domain has passed signup, login, upload, and contact-form
checks.

## Deploy

Push through a pull request and wait for `Validate / validate`. Then open
Actions, choose `Deploy Kleavox`, and run:

1. `domains=none` for the first deployment.
2. Confirm every Worker deploys and migrations complete.
3. Run again with `domains=canonical` to attach the production domains.

The workflow builds Rust/WASM, builds every application and Worker, renders
temporary Wrangler files, applies D1 migrations, deploys in dependency order,
and checks all public services.

After the canonical deployment, verify:

```text
https://<root-domain>/health
https://pass.<root-domain>/ready
https://link.<root-domain>/health
https://pulse.<root-domain>/health
https://port.<root-domain>/health
```

Also test email signup, Google login, GitHub login, short-link resolution, a
compressible file upload, an incompressible file upload, download restoration,
expiration, deletion, Pulse enrollment, and the portfolio contact form.

## Domain Migration Checklist

- Update the Git remote to the new GitHub account and repository.
- Add the production domain to Cloudflare before attaching Worker custom domains.
- Recreate or update Google and GitHub OAuth callbacks.
- Update Turnstile hostname management.
- Verify Resend sending and receiving DNS records.
- Replace production GitHub environment values and secrets.
- Deploy with `domains=none`, then `domains=canonical`.
- Keep previous OAuth callbacks and routes only during verification.
- Remove previous domain routes, OAuth callbacks, and integration settings
  after every Kleavox service passes the production checks.

No production credential is required to build or test this repository.
