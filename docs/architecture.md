# Zarkiv Architecture

## Principles

1. The public product feels unified, but each product deploys independently.
2. Pass is the only source of identity and session truth.
3. Each product owns its database and stores the Pass user ID as an external
   identity.
4. Browser and Cloudflare code use TypeScript.
5. The Pulse host agent uses Go and ships as a single native binary.
6. Rust is introduced only when profiling or security requirements justify it.
7. Legacy repositories are references, not constraints on the new design.

## Runtime Topology

```text
zarkiv.com
  web application
  reserved routes
  unknown /{slug} -> gateway -> Link service binding

pass.zarkiv.com
  Pass application
  Pass Worker
  Pass D1 + session KV

link.zarkiv.com
  Link application
  Link Worker
  Link D1
  /files and /d/{token} -> Drop service binding
  Drop Worker (internal)
  Drop D1 + R2

pulse.zarkiv.com
  Pulse application
  Pulse Worker
  Pulse D1
  Go agents on managed hosts

port.zarkiv.com
  Portfolio application
  Portfolio Worker
```

Workers communicate through Service Bindings. Public HTTP calls between Zarkiv
services are avoided unless an external callback requires them.

## Product Boundaries

### Web

- Public brand website and portfolio
- Product discovery
- Reserved route ownership
- Resolution of `zarkiv.com/{slug}` through Link
- No user or product database

### Pass

- Registration, verification, login, logout, and account recovery
- OAuth providers
- Session issuance and revocation
- User profile and global role
- Email delivery boundary for account email

Pass does not store product permissions. Product-specific roles remain in each
product database.

### Link

- Short-link creation and management
- Public redirect resolution
- Expiration and password protection
- Click analytics and abuse reports
- Reserved-slug enforcement
- Temporary file upload and download workspace
- Public `/d/{token}` file receipts
- Proxies file operations to the internal Drop Worker

### Pulse

- Node enrollment
- Heartbeats and host metrics
- HTTP and service health checks
- Alerts, incidents, notes, and project status
- Signed agent updates

Pulse agents never expose a general-purpose remote shell.

### Drop Service

- Temporary file uploads and downloads
- Account and guest quotas
- Expiration and download limits
- Abuse reporting
- Multipart R2 upload and streamed download flows through the Worker

Drop is not a public product or permanent cloud storage. It remains an
independently deployed internal Worker because file storage, cleanup, D1, and
R2 have a different failure and cost boundary from short links.

### Port

- Personal portfolio for Hafidh Musyafa
- Selected embedded, software, and infrastructure work
- Static Astro output served by a dedicated Worker

## Data Ownership

| Product | Storage | Primary records                                   |
| ------- | ------- | ------------------------------------------------- |
| Pass    | D1 + KV | users, identities, sessions, verification tokens  |
| Link    | D1      | links, clicks, reports, product memberships       |
| Pulse   | D1      | nodes, checks, heartbeats, incidents, memberships |
| Link Files | D1 + R2 | drops, objects, downloads, memberships         |

Cross-database joins are forbidden. Product Workers validate identity through a
Pass Service Binding and persist stable `user_id` values locally.

## Authentication

Pass issues one opaque `__Secure-zarkiv_session` cookie scoped to
`.zarkiv.com`. The cookie is `Secure`, `HttpOnly`, and `SameSite=Lax`. Its value
is a random session identifier, not a long-lived JWT containing mutable user
claims.

Each protected Worker:

1. Reads the session cookie.
2. Calls Pass through a Service Binding.
3. Receives a bounded identity object.
4. Applies product-local authorization.

The browser never receives service secrets.

## Languages

### TypeScript

Used for applications, Workers, contracts, validation, database access, and
tests. This keeps the product surface homogeneous and Cloudflare-native.

### Go

Used only for the Pulse agent. The agent is a long-running native daemon where
simple cross-compilation, networking, and operational maintenance matter more
than sharing browser code.

### Rust

Reserved for measured needs such as high-throughput hashing, archive inspection,
cryptography, or browser WASM. No generic `system` crate is created before a
real consumer and performance requirement exist.

## Deployment

Every application and Worker has an independent package and deployment target.
CI uses path-based filtering and Turborepo dependency calculation. Production
bindings and secrets are configured in Cloudflare, never committed.

Legacy domains remain active until data migration and parity checks pass. Old
short links resolve directly during transition to avoid unnecessary redirect
chains.
