# Delivery Roadmap

## Phase 0: Foundation

- Establish workspace, ownership, naming, and coding standards
- Preserve legacy projects as read-only migration references
- Add shared contracts and test infrastructure
- Produce buildable application and Worker skeletons

## Phase 1: Pass

- Define user, identity, and opaque session schemas
- Implement email verification and password authentication
- Add OAuth only after the base session lifecycle is tested
- Add internal identity verification Service Binding
- Complete security and session tests

## Phase 2: Web and Link

- Rebuild the public website
- Implement apex reserved-route and slug resolution
- Migrate link management, redirects, analytics, expiry, and abuse reporting
- Import existing link data with reversible migration tooling

## Phase 3: Pulse

- Rebuild the dashboard and Worker in TypeScript
- Implement Go agent enrollment, metrics, buffering, and signed updates
- Migrate projects, notes, checks, and node registrations
- Add operational alerts and agent release automation

## Phase 4: Drop

- Implement direct R2 upload and download
- Enforce guest, account, and global active-storage quotas
- Add lifecycle deletion, metadata cleanup, and abuse controls
- Add download limits and optional password protection

## Phase 5: Production Transition

- Add path-filtered CI/CD and Cloudflare environments
- Run integration, browser, security, and migration tests
- Deploy canonical domains in staged order
- Keep legacy domains available during validation
- Enable permanent redirects only after parity and rollback checks pass

## Completion Gates

The project is production-ready only when:

- All five products deploy from the monorepo
- Pass is the sole authentication source
- Each product has isolated data ownership
- Existing short links and required data are migrated and verified
- Pulse agent installation and update paths are tested on amd64 and arm64 Linux
- Drop quotas prevent unbounded storage cost
- CI, observability, backups, rollback, and domain transition are documented and
  tested
