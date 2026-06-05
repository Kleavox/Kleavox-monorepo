# Zarkiv Pulse

Pulse combines a Cloudflare Worker control plane with a small Go daemon on each
monitored Linux host.

## Security Boundary

The agent can:

- collect CPU, memory, disk, load, and uptime metrics
- perform HTTP and TCP checks
- query whether an explicitly configured systemd unit is active

The agent cannot execute arbitrary commands and exposes no inbound port or
remote shell. Browser sessions are validated by Pass; agent credentials are
separate random tokens stored in D1 only as SHA-256 hashes.

## Enrollment

Create a node in the Pulse dashboard. Pulse returns a 30-minute, single-use
enrollment token. Install the binary and run the displayed command:

```bash
curl -fsSL https://pulse.zarkiv.com/install.sh | sh
sudo zarkiv-agent enroll \
  --endpoint https://pulse.zarkiv.com \
  --token <one-time-token>
sudo zarkiv-agent install-service
```

Enrollment writes `/etc/zarkiv-agent/config.json` with mode `0600`.
`install-service` creates an unprivileged `zarkiv-agent` system user, transfers
configuration ownership, installs a hardened systemd unit, and starts it.

## Local Development

```bash
pnpm --filter @zarkiv/pass-worker exec wrangler dev --port 8787
pnpm --filter @zarkiv/pulse-worker exec wrangler dev --port 8790
pnpm exec wrangler d1 migrations apply zarkiv-pulse --local --config workers/pulse/wrangler.jsonc
```

Create a local node in `http://127.0.0.1:8790`, then enroll and run one cycle:

```bash
go -C services/agent run ./cmd/agent enroll \
  --endpoint http://127.0.0.1:8790 \
  --token <one-time-token> \
  --config ../../.cache/pulse-agent.json
go -C services/agent run ./cmd/agent once \
  --config ../../.cache/pulse-agent.json
```

## Retention

The daily Worker cron removes node metrics and check results after 30 days.
Resolved incidents are retained for 180 days. Node snapshots remain available
for the dashboard without scanning time-series tables.

## Releases

Tags matching `agent-v*` build static Linux binaries for amd64 and arm64. The
release workflow publishes SHA-256 files and GitHub build-provenance
attestations. Production release verification should check both the checksum
and repository attestation before rollout.
