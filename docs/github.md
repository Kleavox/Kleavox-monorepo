# Publish to GitHub

No remote is configured by this repository. Publishing and authentication are
owner-operated tasks. The commands below use placeholders and do not require
sharing a password, token, SSH key, or browser session with another person or
agent.

## 0. Trust the Local Repository if Needed

The repository was initialized inside an isolated build environment. If Git on
your Windows account reports `dubious ownership`, review the path and then run
this one-time command yourself:

```powershell
git config --global --add safe.directory D:/Web/zarkiv.com
```

This trusts only this repository path. It does not grant access to GitHub or
Cloudflare and does not store a credential.

## 1. Create an Empty Repository

In GitHub, create a repository without initializing a README, `.gitignore`, or
license. The local repository already contains those files and its complete
history.

Example placeholder:

```text
https://github.com/<OWNER>/<REPOSITORY>
```

## 2. Add Your Remote

Choose HTTPS:

```bash
git remote add origin https://github.com/<OWNER>/<REPOSITORY>.git
```

Or SSH:

```bash
git remote add origin git@github.com:<OWNER>/<REPOSITORY>.git
```

Confirm that only the intended remote exists:

```bash
git remote -v
```

## 3. Push Main and Legacy History

Push the current monorepo:

```bash
git push -u origin main
```

Push every imported legacy branch:

```bash
git push origin --all
```

Push the namespaced legacy tag:

```bash
git push origin --tags
```

Do not use `git push --mirror` unless you intentionally want every internal Git
ref copied to GitHub. `--all` plus `--tags` publishes the branches and tags that
matter without publishing implementation refs.

## 4. Repository Settings

After the first push:

1. Set `main` as the default branch.
2. Protect `main` and require the `Validate` workflow.
3. Disable force pushes and branch deletion for `main`.
4. Optionally protect `legacy/*` from force pushes.
5. Create a protected environment named `production`.
6. Require manual approval for the production environment if the repository
   has more than one administrator.

## 5. Add Deployment Values

Open repository settings, then:

```text
Settings
  Environments
    production
```

Add the variables and secrets listed in
[Production Deployment](production.md). Enter them directly in GitHub. Do not
commit them, paste them into issues, or place them in workflow YAML.

## 6. First GitHub Validation

The push to `main` starts `.github/workflows/ci.yml`. It validates the
TypeScript workspace and Go agent according to changed paths.

The Cloudflare deployment workflow is manual. It does not run merely because
the repository was pushed.
