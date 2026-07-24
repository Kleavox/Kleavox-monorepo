# Kleavox domain context

This file defines the product language used by source, tests, documentation, and architecture work.

## Platform

**Kleavox** is an edge-native platform delivered through four Cloudflare Workers in this repository.

- **Gateway** is the public front door. It owns host routing, canonical redirects, the marketing Web app, and explicit proxy prefixes.
- **Pass** owns accounts, identities, zero-knowledge credentials, sessions, OAuth, verification, and account deletion.
- **Link** owns short links and Drops.
- **Pulse** is an admin-only operations console. It owns monitored nodes, Checks, Check Results, Incidents, and Reports.
- **Agent** is the Go program installed on a monitored node. It enrolls with Pulse, collects metrics, executes Checks, and reports results.
- **Portfolio** is an external Worker maintained in a separate repository. Gateway reaches it only through a Cloudflare binding; its implementation is not part of this repository.

## Identity

- **Account** is a Kleavox user identified publicly by `username` and privately by email.
- **Identity** is a password or OAuth login method attached to an Account.
- **Account Credential** is the zero-knowledge key record containing a public KDF salt, hashed authentication verifier, account public key, and wrapped private key.
- **Session** is the server-issued browser authentication state stored by Pass and consumed by the other Workers.
- **Master Key** is derived in the browser from the account password. It never reaches a Worker.
- **Account Key Pair** is the P-256 key pair used to receive encrypted Drops. Its private key is wrapped by the Master Key and never stored unwrapped.

## Link and Drop

- **Short Link** maps a short slug to a destination URL and records aggregate click data.
- **Drop** is a temporary file transfer with retention, download, quota, ownership, and moderation rules.
- **Upload** is the in-progress multipart R2 transaction that becomes a Drop only after completion.
- **Public Drop** is available through a token. An authenticated sender puts its file key in the URL fragment; a guest Drop remains plaintext and moderatable.
- **Recipient Drop** is encrypted to one or more Account public keys. Its URL carries no file key.
- **File Key** is a fresh random key used once for one Drop.
- **Download Claim** reserves one allowed download before bytes are streamed and finalizes or releases that reservation afterward.
- **Drop lifecycle** is the ordered set of Upload creation, part recording, completion, download claim, expiry, abort, and deletion transitions.

## Pulse

- **Node** is one machine enrolled in Pulse.
- **Metric Snapshot** is the Agent's current host resource measurement.
- **Check** is a configured HTTP probe executed by an Agent.
- **Check Result** is one execution outcome for a Check.
- **Incident** is the open-to-resolved record produced by consecutive Check failures and recovery.
- **Report** is a user-submitted moderation report forwarded to Pulse administrators.
- **Agent cycle** is one metrics collection, heartbeat, Check execution, and result-reporting iteration.

## Invariants

- Passwords and Master Keys never cross the browser-to-Worker seam.
- Unwrapped account private keys are never persisted in the browser or on the server.
- Authenticated Drops are encrypted; guest Drops are plaintext so they remain moderatable.
- A streaming encrypted part aligns with one R2 multipart part.
- Gateway proxy ownership is explicit; a new public prefix must be registered deliberately.
- Pulse has no public role-promotion or admin-driven account-deletion path.
- `apps/web` remains a static Vite and TypeScript app.
- Portfolio remains an independent repository.
