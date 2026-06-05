# Zarkiv Link

Link owns short-link records and analytics. The dashboard runs on
`link.zarkiv.com`, while public routes resolve through the Gateway at
`zarkiv.com/{slug}`.

## Local Development

Run the three Workers in separate terminals:

```bash
pnpm --filter @zarkiv/gateway-worker exec wrangler dev --port 8786
pnpm --filter @zarkiv/pass-worker exec wrangler dev --port 8787
pnpm --filter @zarkiv/link-worker exec wrangler dev --port 8788
```

Wrangler connects the local `PASS` and `LINK` Service Bindings automatically.
Apply Link migrations before the first run:

```bash
pnpm exec wrangler d1 migrations apply zarkiv-link --local --config workers/link/wrangler.jsonc
```

Use `http://127.0.0.1:8788` for the dashboard and
`http://127.0.0.1:8786/{slug}` for public resolution.

## Privacy

Link stores coarse country, browser, operating system, device type, and
referrer-host dimensions. Raw visitor IP addresses are not persisted.

## Production

Render the production config as described in `docs/production.md`. It sets
`PUBLIC_SHORT_ORIGIN` to `https://zarkiv.com`, routes the Link Worker to
`link.zarkiv.com`, and binds:

- Link Worker `PASS` to the production Pass Worker
- Gateway Worker `LINK` to the production Link Worker

Legacy shortlinks should be imported before old domains redirect to Zarkiv.
Keep old redirect hosts active until parity checks confirm every migrated slug.
