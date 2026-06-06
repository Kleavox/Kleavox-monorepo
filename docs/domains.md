# Domains and Routes

## Canonical Domains

| Domain             | Owner                                |
| ------------------ | ------------------------------------ |
| `zarkiv.com`       | Web and public short-link resolution |
| `pass.zarkiv.com`  | Pass                                 |
| `link.zarkiv.com`  | Link routes and temporary files      |
| `pulse.zarkiv.com` | Pulse                                |
| `port.zarkiv.com`  | Personal portfolio                   |

`drop.zarkiv.com` is a compatibility hostname owned by the Link Worker. It
redirects `/` to `https://link.zarkiv.com/files` and preserves existing
`/d/{token}` paths on `link.zarkiv.com`.

## Apex Routing

Known website paths are served by Web. An unknown single-segment path is offered
to Link as a possible public slug. Missing slugs return the Web 404 page.

Reserved paths include:

```text
about
account
api
assets
contact
drop
favicon.ico
link
login
pass
privacy
projects
pulse
robots.txt
sitemap.xml
terms
```

Reserved paths are defined once in `@zarkiv/core` and consumed by both Web and
Link.

## Legacy Transition

| Legacy            | Canonical          |
| ----------------- | ------------------ |
| `port.deau.site`  | `port.zarkiv.com`  |
| `bit.deau.site`   | `link.zarkiv.com`  |
| `one.deau.site`   | `pass.zarkiv.com`  |
| `board.deau.site` | `pulse.zarkiv.com` |

`deau.site/{slug}` continues resolving existing links until migration is
verified. Afterwards it may resolve from the same Link database or redirect
directly to the final target.
