# Legacy Git History

The Zarkiv repository was initialized after the replacement monorepo was built.
Before the old working directories were removed, every reachable commit,
branch, remote-tracking branch, and tag from the five legacy repositories was
imported into namespaced refs.

The modern monorepo tree was committed first. A later `ours` merge connected
the unique legacy history tips to `main` without copying legacy files over the
new architecture. As a result:

- `main` contains the current monorepo files.
- all legacy commits are ancestors of `main`
- legacy branches remain independently browsable
- no legacy remote is configured on the new repository
- the removed legacy folders are not needed to inspect old source

## Branch Namespaces

```text
legacy/deaubit/*
legacy/deauboard/*
legacy/deauone/*
legacy/deauport/*
legacy/deauvault/*
```

The final uncommitted working state found in DeauBit and DeauVault was preserved
before import:

```text
legacy/deaubit/archive/worktree-2026-06-06
legacy/deauvault/archive/worktree-2026-06-06
```

The DeauBoard release tag is available as:

```text
legacy/deauboard/agent-v0.1.0
```

## Inspect Old Source

List imported refs:

```bash
git branch --list "legacy/*"
git tag --list "legacy/*"
```

Inspect a file without changing branches:

```bash
git show legacy/deaubit/main:README.md
```

Browse a complete legacy tree:

```bash
git ls-tree -r --name-only legacy/deauboard/master
```

Create a temporary worktree when old code needs to be run or compared:

```bash
git worktree add ../zarkiv-deaubit-archive legacy/deaubit/archive/worktree-2026-06-06
```

Remove it afterwards:

```bash
git worktree remove ../zarkiv-deaubit-archive
```

Do not merge a legacy branch into `main` with the normal recursive/ort strategy.
Use the old branches as read-only references and port intentional changes into
the current product packages.
