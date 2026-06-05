# Legacy Data Migration

The migration tools read JSON emitted by `wrangler d1 execute --json` and create
idempotent SQL files under the ignored `.migration/` directory. Source
databases remain unchanged.

## Security Decisions

- DeauBit bcrypt account hashes are not copied into Pass.
- Migrated users receive a password identity with no usable password hash.
- Verified users reclaim access through Pass password reset.
- Unverified users may complete registration with the same email.
- Password-protected legacy links are imported disabled with a reset-required
  marker. The owner must set a new password before enabling them.
- Raw click IP, city, and report contact fields are deliberately dropped.
- DeauBoard nodes are imported disabled and require enrollment with the Go
  agent. Projects, notes, and checks remain available.

## Export DeauBit

After `wrangler login`, create the ignored working directory:

```powershell
New-Item -ItemType Directory -Force .migration\source\deaubit

pnpm exec wrangler d1 execute deaubit-db --remote --json `
  --command "SELECT id,email,name,role,NULL AS verified_at,created_at FROM users" |
  Set-Content -Encoding utf8 .migration\source\deaubit\users.json

pnpm exec wrangler d1 execute deaubit-db --remote --json `
  --command "SELECT id,slug,target_url,password,expires_at,user_id,created_at FROM short_links" |
  Set-Content -Encoding utf8 .migration\source\deaubit\links.json

pnpm exec wrangler d1 execute deaubit-db --remote --json `
  --command "SELECT id,short_link_id,browser,os,device,country,city,ip,referrer,clicked_at FROM clicks" |
  Set-Content -Encoding utf8 .migration\source\deaubit\clicks.json

pnpm exec wrangler d1 execute deaubit-db --remote --json `
  --command "SELECT id,short_link_id,reason,details,contact,status,created_at FROM reports" |
  Set-Content -Encoding utf8 .migration\source\deaubit\reports.json
```

Generate SQL:

```powershell
pnpm migrate deaubit `
  --users .migration\source\deaubit\users.json `
  --links .migration\source\deaubit\links.json `
  --clicks .migration\source\deaubit\clicks.json `
  --reports .migration\source\deaubit\reports.json `
  --out .migration\generated\deaubit
```

`manifest.json` includes the stable Pass user ID for every legacy email. Apply
`001-pass-users.sql` to Pass. Apply every `link` SQL file in lexical order to
Link.

## Export DeauBoard

```powershell
New-Item -ItemType Directory -Force .migration\source\deauboard

pnpm exec wrangler d1 execute deauboard --remote --json `
  --command "SELECT * FROM projects" |
  Set-Content -Encoding utf8 .migration\source\deauboard\projects.json

pnpm exec wrangler d1 execute deauboard --remote --json `
  --command "SELECT * FROM uptime_checks" |
  Set-Content -Encoding utf8 .migration\source\deauboard\checks.json

pnpm exec wrangler d1 execute deauboard --remote --json `
  --command "SELECT * FROM notes" |
  Set-Content -Encoding utf8 .migration\source\deauboard\notes.json
```

Use the Pass user ID that will own the imported workspace:

```powershell
pnpm migrate deauboard `
  --owner-user-id "<pass-user-id>" `
  --projects .migration\source\deauboard\projects.json `
  --checks .migration\source\deauboard\checks.json `
  --notes .migration\source\deauboard\notes.json `
  --out .migration\generated\deauboard
```

Apply the generated Pulse files in lexical order.

## Apply and Verify

Use the rendered production configs described in
[production.md](production.md):

```powershell
pnpm exec wrangler d1 execute DB --remote `
  --config .wrangler\deploy\pass.json `
  --file .migration\generated\deaubit\001-pass-users.sql
```

Run each remaining generated file against the owning database. Compare source
counts with the generated manifests and remote target counts before attaching
legacy domains. Spot-check every disabled protected link and enroll each legacy
Pulse node again rather than reusing old agent credentials.
