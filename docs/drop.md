# Zarkiv Files

Files is the temporary file-transfer area inside Zarkiv Link, not permanent
cloud storage. Files are stored
in R2, metadata and quota reservations are stored in an isolated D1 database,
and identity is verified through the Pass service binding.

## Cost Envelope

The default policy intentionally stays inside Cloudflare's free allowances for
small personal use:

- Guest file: 50 MiB, one hour, up to five downloads
- Account file: 250 MiB, up to 24 hours, up to 100 downloads
- Guest active quota: 100 MiB per pseudonymous actor
- Account active quota: 1 GiB
- Global active storage quota: 8 GiB
- Multipart part size: 10 MiB

As of June 5, 2026, R2 Standard includes 10 GB-month storage, one million
Class A operations, ten million Class B operations, and free Internet egress
each month. Workers Free includes 100,000 requests per day and accepts request
bodies up to 100 MB on a Cloudflare Free zone. These are allowances, not a
guarantee that arbitrary public traffic remains free.

Sources:

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/

## Storage Protocol

1. The client requests an upload reservation.
2. D1 atomically checks per-file, actor, account, and global active quotas.
3. The Worker creates an R2 multipart upload.
4. Each browser request sends one 10 MiB part through the Worker.
5. The Worker records the R2 ETag and exact byte count for each part.
6. Completion is accepted only when every recorded part matches the expected
   layout.
7. The public drop record is activated after R2 confirms completion.

Public and management tokens are random. Management tokens are stored only as
SHA-256 hashes. Password verifiers use HMAC-SHA256 with a production secret,
which prevents offline guessing from a D1-only leak without spending the
Workers Free CPU budget on a large password KDF.

## Local Setup

```bash
copy workers\drop\.dev.vars.example workers\drop\.dev.vars
copy apps\link\.env.example apps\link\.env
pnpm --filter @zarkiv/link-app build
pnpm --dir workers/drop exec wrangler d1 migrations apply DB --local
pnpm --filter @zarkiv/pass-worker dev
pnpm --filter @zarkiv/drop-worker dev
pnpm --filter @zarkiv/link-worker dev
```

The public UI is served by Link. The Drop Worker remains an internal service
binding and uses Link's public origin for generated `/d/{token}` URLs.
Separate Wrangler processes discover their service binding by Worker name.

To test scheduled cleanup, start Drop with `--test-scheduled`, then request:

```text
http://127.0.0.1:8791/__scheduled?cron=*/15+*+*+*+*
```

## Production Secrets

Set each secret independently:

```bash
pnpm --dir workers/drop exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm --dir workers/drop exec wrangler secret put GUEST_HASH_SECRET
pnpm --dir workers/drop exec wrangler secret put DOWNLOAD_SIGNING_SECRET
pnpm --dir workers/drop exec wrangler secret put PASSWORD_HASH_SECRET
```

Provide `VITE_TURNSTILE_SITE_KEY` when building the Link application.
Production intentionally refuses guest identity hashing, password creation, or
password unlock when the corresponding secret is absent.

## Cleanup

The Drop cron runs every 15 minutes. It:

- aborts upload sessions older than 30 minutes
- reconciles interrupted completion records
- deletes expired, exhausted, and owner-deleted R2 objects
- removes old upload metadata after two days
- removes deleted drop metadata after 30 days
- removes resolved abuse reports after 180 days

Configure an R2 bucket lifecycle rule as a second safety layer to abort
incomplete multipart uploads after one day and delete `objects/` content after
two days. Lifecycle deletion may be delayed by about 24 hours, so application
cleanup remains the primary policy.

Reference:
https://developers.cloudflare.com/r2/buckets/object-lifecycles/
