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
| Port    | `https://port.<root-domain>`  | Portfolio and contact form                    |

File links use `https://<root-domain>/f_<token>`. Short-link slugs cannot use the
reserved `f_` prefix, so both products share the root namespace without
collisions. Drop is an internal Worker and has no public subdomain.

## Stack

- TypeScript, React, Astro, Hono, and Cloudflare Workers
- D1 for relational state, KV for sessions, and R2 for temporary objects
- Rust compiled to WebAssembly for adaptive browser-side file compression
- Go for the lightweight Pulse agent
- pnpm workspaces and Turborepo

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

Copy each app's `.env.example` to `.env.local` when running locally. Worker
secrets belong in ignored `.dev.vars` files and must never be committed.

## File Compression

Link attempts Rust/WASM gzip compression in the browser before upload. It only
stores the compressed body when the result is at least 10% smaller. Images,
audio, video, PDF files, archives, files below 1 KiB, and files above 32 MiB
skip compression. Larger files still upload normally.

The original size remains the policy limit and download metadata. R2 stores the
smaller body with `Content-Encoding: gzip`, allowing the browser to restore the
original file during download without spending Cloudflare Worker CPU on
compression.

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
pnpm exec wrangler d1 create kleavox-drop
pnpm exec wrangler kv namespace create kleavox-pass-sessions
pnpm exec wrangler r2 bucket create kleavox-files
```

Map the returned values to GitHub environment secrets as follows:

```text
kleavox-pass -> PASS_D1_ID
kleavox-link -> LINK_D1_ID
kleavox-pulse -> PULSE_D1_ID
kleavox-drop -> DROP_D1_ID
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
PORTFOLIO_FROM_EMAIL=<portfolio-sender-address>
PORTFOLIO_CONTACT_EMAIL=<portfolio-recipient-address>
PUBLIC_PORTFOLIO_NAME=<display name>
PUBLIC_PORTFOLIO_LOCATION=<location>
PUBLIC_GITHUB_URL=<public profile URL>
PUBLIC_LINKEDIN_URL=<public profile URL>
```

Add these environment secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
PASS_D1_ID
PASS_KV_ID
LINK_D1_ID
PULSE_D1_ID
DROP_D1_ID
RESEND_API_KEY
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
IP_HASH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
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

1. Open Google Cloud Console and select or create a project.
2. Configure the OAuth consent screen with the Kleavox name, homepage, privacy
   URL, and support email.
3. Create an OAuth client with application type `Web application`.
4. Add `https://pass.<root-domain>` under Authorized JavaScript origins.
5. Add `https://pass.<root-domain>/api/oauth/callback/google` under Authorized
   redirect URIs.
6. Store the client ID and secret in the GitHub `production` environment.

The application requests `openid email profile` at runtime. Google may not show
`openid` as a selectable consent-screen scope; that is normal. The redirect URI
must match exactly, including HTTPS and the full path.

## GitHub OAuth

1. Open GitHub Settings, Developer settings, OAuth Apps.
2. Create a new OAuth App.
3. Set Homepage URL to `https://<root-domain>`.
4. Set Authorization callback URL to
   `https://pass.<root-domain>/api/oauth/callback/github`.
5. Store the generated client ID and client secret in the GitHub `production`
   environment.

## Resend

Verify the production domain for sending and add the SPF and DKIM records supplied by
Resend to Cloudflare DNS. The configured sender addresses can then send account
and portfolio email.

For receiving:

1. Add `inbound.<root-domain>` as a receiving domain in Resend.
2. Add its MX record to Cloudflare DNS.
3. Set `PORTFOLIO_CONTACT_EMAIL` to
   an address on the receiving domain.
4. Submit the portfolio form and confirm the message appears under Resend
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

Store the site key and secret in the GitHub `production` environment. Remove
previous hostnames only after the new domain has passed signup, login, upload,
and contact-form checks.

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
