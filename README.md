# Kleavox Monorepo

Kleavox is an edge-native platform for identity, short links, temporary file
transfers, and infrastructure monitoring. This repository contains the browser
applications, Cloudflare Workers, shared TypeScript packages, Rust/WASM modules,
the Go monitoring Agent, and their build and deployment tooling.

The Portfolio is maintained in a separate repository. It is not part of this
workspace and is only reached by Gateway through a Cloudflare service binding.

## Runtime architecture

```text
Browser
  |
Gateway Worker ----- PORTFOLIO binding ---- external Portfolio Worker
  | PASS binding
  | LINK binding
  | PULSE binding
  |
  +-- Pass Worker  ---- D1 + session KV
  +-- Link Worker  ---- D1 + R2
  +-- Pulse Worker ---- D1 <---- Go Agent
```

| Runtime | Responsibility                                                                      |
| ------- | ----------------------------------------------------------------------------------- |
| Gateway | Public entry point, canonical routing, static Web app, and explicit service proxies |
| Pass    | Accounts, verifier-only authentication, sessions, OAuth, and account lifecycle      |
| Link    | Short links, encrypted Drops, multipart uploads, download claims, and cleanup       |
| Pulse   | Admin-only monitoring, nodes, checks, incidents, and moderation reports             |
| Agent   | Go daemon that collects metrics, executes checks, and reports to Pulse              |

Gateway routing is explicit. Adding a public API prefix requires registering its
owner deliberately; there is no catch-all proxy to another Worker.

## Repository layout

| Path                                    | Contents                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| `apps/web`                              | Static Vite + TypeScript marketing application                    |
| `apps/link`                             | React workspace for short links and Drops                         |
| `apps/pass`                             | React account and authentication application                      |
| `apps/pulse`                            | React operations console                                          |
| `workers/gateway`                       | Root-domain router and application gateway                        |
| `workers/link`                          | Link and Drop API backed by D1 and R2                             |
| `workers/pass`                          | Identity API backed by D1 and KV                                  |
| `workers/pulse`                         | Monitoring and moderation API backed by D1                        |
| `packages/*-protocol`                   | Runtime-validated messages shared across application seams        |
| `packages/topology`                     | Canonical Worker names, hosts, origins, and local ports           |
| `packages/auth`, `core`, `config`, `ui` | Shared TypeScript capabilities                                    |
| `crates/crypto`                         | Rust/WASM password derivation and streaming encryption            |
| `crates/compression`                    | Rust/WASM browser-side compression                                |
| `services/agent`                        | Go Pulse Agent                                                    |
| `tooling`                               | Deployment, E2E, health-check, lint, TypeScript, and Vite tooling |
| `../CONTEXT.md`                         | Canonical domain language and platform invariants (parent folder) |

The implementation is organised around a small set of domain modules rather
than route handlers or UI screens:

- `workers/link/src/drop/lifecycle.ts` coordinates D1/R2 Upload and Drop state.
- `apps/link/src/transfer/send.ts` owns compression, encryption, multipart send,
  completion, and abort behavior in the browser.
- `workers/pass/src/account/lifecycle.ts` owns credential rotation, session
  invalidation, and cross-service account deletion.
- `workers/pulse/src/incident/lifecycle.ts` owns concurrency-safe Incident
  transitions.
- `services/agent/internal/cycle` owns one complete Agent execution cycle.

## Technology

- TypeScript 7 native compiler, React, Vite, Hono, and Cloudflare Workers
- D1 for relational state, KV for sessions, and R2 for Drop objects
- Rust compiled to WebAssembly for cryptography and compression
- Go for the standalone Pulse Agent
- pnpm workspaces and Turborepo for orchestration

## Requirements

- Node.js 22.13 or newer
- pnpm 11.17
- Go 1.26
- Rust stable with the `wasm32-unknown-unknown` target
- `wasm-pack` 0.15
- Chromium installed through Playwright for E2E tests

## Setup

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked --version 0.15.0
pnpm install
pnpm --filter @kleavox/e2e e2e:install
```

Source-controlled Wrangler configurations use local placeholder resources.
Local development does not require production credentials. Put browser
overrides in `.env.local` and Worker secrets in `.dev.vars`; both are ignored by
Git. Each app's `.env.example` already carries the local origins from
`packages/topology`, so `cp .env.example .env.local` in `apps/*` is enough.

Those origins are baked in at build time and each Worker serves its app from
`dist/`, so an app built without them points at the production hostnames and
signs nobody in locally. `tooling/e2e/prepare.mjs` builds with the right values;
so does a plain `pnpm build` once `.env.local` exists.

## Development

Run all workspace development tasks:

```bash
pnpm dev
```

Build an application and run its Worker individually when working on one
service:

```bash
pnpm --filter @kleavox/pass-app build
pnpm --dir workers/pass exec wrangler dev --port 8787
```

Wrangler's local service registry connects Workers started in separate
terminals. The canonical local ports and service names are maintained in
`packages/topology`, and each Worker's `wrangler.jsonc` pins its own `dev.port`
to match. Without that pin every Worker takes Wrangler's default 8787, all four
bind the same socket, and only one of them answers, so `pnpm lint:ports` fails
the build if the two ever disagree.

## Commands

| Command                                 | Purpose                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm build`                            | Build all TypeScript applications, Workers, and packages                |
| `pnpm test`                             | Run workspace unit tests                                                |
| `pnpm typecheck`                        | Type-check runtime and tooling interfaces with TypeScript 7             |
| `pnpm lint`                             | Verify formatting, unused files and exports, and async error handling   |
| `pnpm lint:async`                       | Reject async event handlers that discard their failure                  |
| `pnpm lint:ports`                       | Reject a Worker dev port that drifts from `packages/topology`           |
| `pnpm format:check`                     | Verify repository formatting                                            |
| `pnpm native:check`                     | Validate Rust and Go formatting, tests, builds, vet, and dead code      |
| `pnpm check`                            | Run the complete static, unit, native, and build verification gate      |
| `pnpm e2e`                              | Reset local Wrangler state and test Gateway, Pass, and Link in Chromium |
| `pnpm health:check`                     | Verify deployed public service health endpoints                         |
| `pnpm admin:promote -- --email <email>` | Promote an existing verified account to admin                           |

Authentication or Drop protocol changes must pass both verification gates:

```bash
pnpm check
pnpm e2e
```

## Security invariants

- Passwords and Master Keys never cross the browser-to-Worker boundary.
- Account private keys are persisted only in wrapped form.
- Authenticated Drops are encrypted in the browser; guest Drops remain
  plaintext so they can be moderated.
- One encrypted streaming chunk maps to one R2 multipart part.
- Password reset rotates the account key pair, so Drops encrypted to the old
  public key become unreadable by design.
- Pulse is admin-only and exposes no public role-promotion endpoint.

See `../CONTEXT.md` for the complete domain vocabulary and invariants used by
the source and tests. It sits in the parent folder rather than in this
repository because every agent-facing document for kleavox.xyz lives there,
beside `THEME.md` and `THEME-DECISIONS.md`.

## CI, deployment, and releases

Pull requests run the `Validate` workflow, including unit, native, build, and
E2E checks selected by changed paths.

Production deployment is manual through `.github/workflows/deploy.yml` and the
protected GitHub `production` environment. Run it first with `domains=none`,
verify migrations and Workers, then run it with `domains=canonical` to attach
public domains. The workflow is the source of truth for required variables,
secrets, deployment order, migrations, and health checks.

The Go Agent is released by pushing an `agent-v*` tag. The release workflow
tests the module, builds Linux AMD64 and ARM64 binaries, publishes checksums,
and records build provenance.

No production credential is required to build or test this repository.

## TypeScript configuration

Runtime-specific compiler presets live in `tooling/typescript` and are consumed
through `@kleavox/typescript`. Browser, Worker, Node, and emitted library
projects do not share ambient types accidentally. TypeScript 7 runs one checker
per workspace process while Turborepo controls parallelism across workspaces.

Libraries built by `tsc` are checked during their build. Separate `typecheck`
tasks are reserved for Vite applications, Wrangler Workers, tests, and tooling
whose normal build step does not perform full type analysis.

### Why there is no ESLint

`typescript-eslint` refuses to load against TypeScript 7 and throws rather than
warning, so no rule that needs a TypeScript parser can run here, including ones
that need no type information at all. Support is tracked in
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940).

The rules this repository actually wanted were `no-floating-promises`,
`no-misused-promises`, and `react-hooks/exhaustive-deps`. In August 2026 the
first two would have caught fourteen event handlers across `pulse` and `link`
that awaited an API call and dropped the rejection, leaving the control looking
broken and the operator with no message. `tooling/lint/unhandled-async.mjs`
stands in for them until the parser lands: it is narrower than the real rules
and only guards that one class. Replace it with ESLint when TypeScript 7 is
supported, not before.
