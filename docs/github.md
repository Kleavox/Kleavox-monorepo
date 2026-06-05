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

Complete the first `main` push before configuring these settings. GitHub needs
the branch and status check to exist before they can be selected.

### 4.1 Confirm the Validation Workflow

1. Open the repository's **Actions** tab.
2. Open the latest **Validate** run.
3. Wait until the run is green.
4. Confirm that the final job is displayed as `Validate / validate`.

The final `validate` job is intentionally stable even when JavaScript or Go
checks are skipped by path filtering. Use this final job as the required status
check; do not require the conditional `javascript` or `agent` jobs directly.

GitHub decorates the check in the pull request as
`Validate / validate (pull_request)`, but its required-check context is only
the job name `validate`:

```text
Validate          = workflow name
validate          = required status-check context
(pull_request)    = event label
```

Do not type the combined display label into the ruleset.

### 4.2 Set `main` as the Default Branch

1. Open **Settings**.
2. Open **General**.
3. Find **Default branch**.
4. Click the edit/switch button beside the current branch.
5. Select `main`.
6. Click **Update**, then confirm the warning.

If `main` is already displayed, no change is needed.

### 4.3 Protect `main` with a Ruleset

Rulesets are preferred over a classic branch protection rule because their
targeting and effective rules are easier to inspect.

1. Open **Settings**.
2. Under **Code and automation**, open **Rules**, then **Rulesets**.
3. Select **New ruleset** -> **New branch ruleset**.
4. Enter the name `Protect main`.
5. Set **Enforcement status** to **Active**.
6. Leave **Bypass list** empty for strict protection. If this is a single-owner
   repository and emergency maintenance is important, add only
   **Repository administrators** with bypass mode **For pull requests only**.
7. Under **Target branches**, add **Include default branch**. Alternatively,
   use **Include by pattern** with the exact value `main`.
8. Enable **Restrict deletions**.
9. Enable **Block force pushes**.
10. Enable **Require a pull request before merging**.
11. Set required approvals to `0` for a solo repository or `1` when another
    maintainer can review changes.
12. Enable **Require status checks to pass**.
13. Search for `validate`, then select the recent check supplied by
    **GitHub Actions**. The stored required-check name must be exactly
    lowercase `validate`.
14. Enable **Require branches to be up to date before merging**.
15. Leave **Require deployments to succeed before merging** disabled.
    Production deployment happens after merge and must not gate the merge.
16. Click **Create**.

Recommended optional pull-request settings when there is another maintainer:

- dismiss stale approvals after new commits
- require approval of the most recent reviewable push
- require conversation resolution before merging

Do not enable signed commits until every local machine and automation identity
has been configured to sign commits. Enabling it prematurely can block normal
maintenance.

### 4.4 Protect Imported Legacy Branches

These branches are archives. They should remain visible but never be rewritten.

1. Return to **Settings** -> **Rules** -> **Rulesets**.
2. Select **New ruleset** -> **New branch ruleset**.
3. Enter the name `Preserve legacy history`.
4. Set **Enforcement status** to **Active**.
5. Under **Target branches**, select **Include by pattern**.
6. Enter `legacy/**/*`.
7. Enable **Restrict deletions**.
8. Enable **Block force pushes**.
9. Do not require pull requests or status checks for these archive branches.
10. Click **Create**.

GitHub rulesets use `fnmatch` syntax where `*` does not cross `/`. The
`legacy/**/*` pattern covers nested names such as
`legacy/deaubit/archive/worktree-2026-06-06`.

### 4.5 Create the `production` Environment

1. Open **Settings** -> **Environments**.
2. Click **New environment**.
3. Enter the exact lowercase name `production`.
4. Click **Configure environment**.
5. Under **Deployment branches and tags**, select **Selected branches and
   tags**.
6. Add the branch rule `main`.
7. Keep environment secrets empty until the values in
   [Production Deployment](production.md) are ready.

The workflow already references `environment: production`, so this exact name
connects the environment to the `Deploy Zarkiv` job.

### 4.6 Add Manual Deployment Approval

Under **Deployment protection rules**:

1. Enable **Required reviewers**.
2. Add one trusted administrator other than the person normally starting the
   deployment.
3. Enable **Prevent self-review** if deployments must always be approved by a
   second person.
4. Save the protection rule.

Required reviewers must approve before the deploy job starts or receives the
environment's secrets. GitHub plan and repository visibility affect
availability: on GitHub Free, Pro, and Team, required reviewers are available
for public repositories; private/internal repository support for this
protection requires GitHub Enterprise. If the option is absent, keep deployment
manual through `workflow_dispatch` and restrict the environment to `main`.

### 4.7 Verify the Effective Protection

1. Open **Code** -> **Branches** and confirm `main` shows a rules icon.
2. Open the repository URL ending in `/rules` to inspect effective rules.
3. Create a temporary branch and pull request.
4. Confirm direct or force pushes to `main` are rejected.
5. Confirm the pull request requires `validate`; GitHub may display the
   successful run as `Validate / validate (pull_request)`.
6. Run **Actions** -> **Deploy Zarkiv** only after environment secrets exist.
7. Confirm the production job waits for approval when required reviewers are
   enabled.

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
