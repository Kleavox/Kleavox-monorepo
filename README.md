# Zarkiv

Zarkiv is a Cloudflare-first product ecosystem built as a scalable monorepo.

## Products

| Product | Domain             | Purpose                                |
| ------- | ------------------ | -------------------------------------- |
| Zarkiv  | `zarkiv.com`       | Public website and short-link resolver |
| Link    | `link.zarkiv.com`  | Short-link management                  |
| Pass    | `pass.zarkiv.com`  | Identity and single sign-on            |
| Pulse   | `pulse.zarkiv.com` | Infrastructure monitoring              |
| Drop    | `drop.zarkiv.com`  | Temporary file sharing                 |

## Technology

- TypeScript for browser applications and Cloudflare Workers
- Go for the lightweight Pulse agent installed on VPS hosts
- Rust only for proven system or compute workloads
- Cloudflare Workers, D1, R2, KV, Queues, and Service Bindings
- pnpm workspaces and Turborepo for JavaScript orchestration

The legacy `deau*` working directories have been removed. Their complete Git
histories remain available under namespaced `legacy/*` branches and are
connected to `main` without replacing the current monorepo tree.

See [docs/architecture.md](docs/architecture.md),
[docs/roadmap.md](docs/roadmap.md), and the
[Pass](docs/pass.md), [Link](docs/link.md), [Pulse](docs/pulse.md), and
[Drop](docs/drop.md) operations guides. Production transition is documented in
[docs/production.md](docs/production.md) and
[docs/migration.md](docs/migration.md). See
[docs/git-history.md](docs/git-history.md) for the imported repository graph
and [docs/github.md](docs/github.md) for owner-operated publishing.

## Workspace Commands

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```
