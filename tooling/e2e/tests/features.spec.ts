import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { localWorkerOrigin } from "@kleavox/topology";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const PASS = localWorkerOrigin("pass", "localhost");
const LINK = localWorkerOrigin("link", "localhost");
const PULSE = localWorkerOrigin("pulse", "localhost");
const GATEWAY = localWorkerOrigin("gateway", "localhost");

const password = "probe-password-1";
const run = Date.now().toString().slice(-6);
const admin = { user: "probeops", email: "probeops@example.com" };

let context: BrowserContext;
let page: Page;
let problems: string[] = [];

const passDir = path.join(repoRoot, "workers", "pass");

function passSql(command: string): void {
  execSync(
    `pnpm exec wrangler d1 execute local-pass --local --command "${command}"`,
    { cwd: passDir, stdio: "pipe" },
  );
}

function clearRateLimits(): void {
  let listed = "";
  try {
    listed = execSync(
      "pnpm exec wrangler kv key list --binding SESSIONS --local",
      { cwd: passDir, stdio: "pipe" },
    ).toString();
  } catch {
    return;
  }
  const start = listed.indexOf("[");
  if (start < 0) return;
  let keys: Array<{ name: string }> = [];
  try {
    keys = JSON.parse(listed.slice(start)) as Array<{ name: string }>;
  } catch {
    return;
  }
  for (const key of keys) {
    if (!key.name.startsWith("rate:")) continue;
    try {
      execSync(
        `pnpm exec wrangler kv key delete --binding SESSIONS --local "${key.name}"`,
        { cwd: passDir, stdio: "pipe" },
      );
    } catch {
      // a key that expired between listing and deleting is not a problem
    }
  }
}

async function freshAccount(
  target: Page,
  label: string,
): Promise<{ user: string; email: string }> {
  clearRateLimits();
  const account = {
    user: `${label}${run}`.slice(0, 20),
    email: `${label}-${run}@example.com`,
  };
  await target.goto(`${PASS}/`);
  await target.getByRole("button", { name: "Create an account" }).click();
  await target.locator('input[name="username"]').fill(account.user);
  await target.locator('input[name="email"]').fill(account.email);
  await target.locator('input[name="password"]').fill(password);
  await target.locator('input[name="confirm-password"]').fill(password);
  await target
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(target.getByText("Check your email")).toBeVisible({
    timeout: 20000,
  });
  passSql(
    `UPDATE users SET email_verified_at = datetime('now') WHERE email = '${account.email}'`,
  );
  return account;
}

async function attempt(): Promise<string | null> {
  await page.goto(`${PASS}/`);
  await page.locator('input[name="email"]').fill(admin.email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const landed = page.getByRole("heading", { name: admin.user });
  const failed = page.locator(".pass-status-error");
  await expect(landed.or(failed)).toBeVisible({ timeout: 20000 });
  if (await landed.isVisible()) return null;
  return (await failed.textContent()) ?? "sign-in failed with no message";
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push("console: " + message.text());
  });
  page.on("pageerror", (error) => problems.push("pageerror: " + error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/")) {
      problems.push(response.status() + " " + response.url());
    }
  });

  const first = await attempt();
  if (first === null) return;
  if (!/incorrect|not found|no account|invalid/i.test(first)) {
    throw new Error(
      `Cannot sign the probe account in, and this is not a missing account: "${first}". ` +
        `Clear the local limiter with: pnpm exec wrangler kv key list --binding SESSIONS --local`,
    );
  }

  await page.goto(`${PASS}/`);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.locator('input[name="username"]').fill(admin.user);
  await page.locator('input[name="email"]').fill(admin.email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirm-password"]').fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Check your email")).toBeVisible({
    timeout: 20000,
  });
  passSql(
    `UPDATE users SET email_verified_at = datetime('now'), role = 'ADMIN' WHERE email = '${admin.email}'`,
  );
  expect(await attempt()).toBeNull();
  problems.length = 0;
});

test.afterAll(async () => {
  await context?.close();
});

test("pulse: enroll a node and manage its checks", async () => {
  await page.goto(`${PULSE}/`);
  await expect(
    page.getByRole("heading", { name: "See every host." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Enroll node" }).click();
  await page.getByLabel("Node label").fill(`probe-node-${run}`);
  await page.getByRole("button", { name: "Create token" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").locator("pre")).not.toBeEmpty();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const node = page.locator(".pulse-node", { hasText: `probe-node-${run}` });
  await expect(node).toBeVisible();

  await node.getByRole("button", { name: "Add check" }).click();
  await node.getByLabel("Check name").fill(`probe-check-${run}`);
  await node.getByLabel("Check target").fill("https://example.com/health");
  await node.getByRole("button", { name: "Save" }).click();
  await expect(node.getByText(`probe-check-${run}`)).toBeVisible();

  await node
    .locator(".pulse-check", { hasText: `probe-check-${run}` })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(node.getByText(`probe-check-${run}`)).toHaveCount(0);
});

test("pulse: projects and notes round trip", async () => {
  await page.goto(`${PULSE}/`);

  await page.getByLabel("New project").fill(`probe-project-${run}`);
  await page.getByLabel("New project").press("Enter");
  await expect(page.getByText(`probe-project-${run}`)).toBeVisible();

  const status = page.getByLabel(`probe-project-${run} status`);
  await status.selectOption("PAUSED");
  await expect(status).toHaveValue("PAUSED");

  await page.getByLabel("Operational note").fill(`probe note ${run}`);
  await page.getByLabel("Operational note").press("Enter");
  await expect(page.getByText(`probe note ${run}`)).toBeVisible();

  const note = page.locator("article", { hasText: `probe note ${run}` }).last();
  await note.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(
    note.getByRole("button", { name: "Unpin", exact: true }),
  ).toBeVisible();
  await note.getByRole("button", { name: "Unpin", exact: true }).click();
  await note.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText(`probe note ${run}`)).toHaveCount(0);

  await page
    .getByRole("button", { name: `Delete probe-project-${run}` })
    .click();
  await expect(page.getByText(`probe-project-${run}`)).toHaveCount(0);
});

test("link: short link lifecycle and edit", async () => {
  await page.goto(`${LINK}/`);

  const slug = `probeslug${run}`;
  await page
    .locator('input[placeholder="https://example.com/launch"]')
    .fill("https://example.com/destination");
  await page.locator('input[placeholder="optional"]').fill(slug);
  await page.getByRole("button", { name: "Create link" }).click();

  const row = page.locator(".link-row", { hasText: slug });
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(
    page.locator(".link-row").first(),
    "a link created a second ago belongs at the top of the activity list",
  ).toContainText(slug);

  await row.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await row.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();

  await row.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.locator(".link-stats")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".link-stats")).toHaveCount(0);

  await row.getByRole("button", { name: "QR", exact: true }).click();
  await expect(page.locator(".link-qr")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".link-qr")).toHaveCount(0);

  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.locator(".link-edit");
  await expect(editor).toBeVisible();
  await editor
    .locator('input[type="url"]')
    .fill("https://example.com/moved-here");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0, { timeout: 20000 });
  await expect(
    page.locator(".link-row", { hasText: "example.com/moved-here" }),
  ).toBeVisible();

  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".link-row", { hasText: slug })).toHaveCount(0, {
    timeout: 20000,
  });
});

test("link: an abuse report reaches the Pulse inbox", async () => {
  await page.goto(`${LINK}/`);
  const slug = `probereport${run}`;
  await page
    .locator('input[placeholder="https://example.com/launch"]')
    .fill("https://example.com/reported");
  await page.locator('input[placeholder="optional"]').fill(slug);
  await page.getByRole("button", { name: "Create link" }).click();
  await expect(page.locator(".link-row", { hasText: slug })).toBeVisible({
    timeout: 20000,
  });

  await page.goto(`${LINK}/report`);
  await expect(
    page.getByRole("heading", { name: "Report a link" }),
  ).toBeVisible();

  const form = page.locator("form");
  await form.locator("input").first().fill(slug);
  await form.locator("select").selectOption({ index: 1 });
  await form.locator("textarea").fill(`probe report ${run}`);
  await form.getByRole("button", { name: "Send report" }).click();
  await expect(form.locator(".link-form-status-success")).toHaveText(
    "Report received.",
    { timeout: 20000 },
  );

  await page.goto(`${PULSE}/`);
  await expect(page.getByText(slug).first()).toBeVisible({ timeout: 20000 });
});

async function ringless(selectors: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const selector of selectors) {
    const control = page.locator(selector).first();
    if ((await control.count()) === 0) continue;
    await control.focus();
    const visible = await control.evaluate((node) => {
      const style = getComputedStyle(node);
      const outline =
        style.outlineStyle !== "none" &&
        Number.parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
      return outline || shadow;
    });
    if (!visible) missing.push(selector);
  }
  return missing;
}

test("every form control shows where the keyboard is", async () => {
  await page.goto(`${LINK}/`);
  expect(
    await ringless([
      ".drop-options select",
      ".drop-options input",
      ".link-field input",
      ".link-prefix-input input",
    ]),
  ).toEqual([]);

  await page.goto(`${PULSE}/`);
  await page.getByRole("button", { name: "Enroll node" }).click();
  expect(await ringless([".pulse-inline-form input"])).toEqual([]);
  await page.getByRole("button", { name: "Cancel" }).first().click();

  await page.getByRole("button", { name: "Add check" }).first().click();
  expect(
    await ringless([".pulse-check-form input", ".pulse-check-form select"]),
  ).toEqual([]);
  await page.getByRole("button", { name: "Cancel" }).first().click();

  expect(await ringless([".pulse-projects input"])).toEqual([]);
});

test("a modal opened from a hovered row still covers the page", async () => {
  await page.goto(`${LINK}/`);
  const slug = `probemodal${run}`;
  await page
    .locator('input[placeholder="https://example.com/launch"]')
    .fill("https://example.com/modal");
  await page.locator('input[placeholder="optional"]').fill(slug);
  await page.getByRole("button", { name: "Create link" }).click();

  const row = page.locator(".link-row", { hasText: slug });
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.hover();
  await row.getByRole("button", { name: "Stats", exact: true }).click();

  const backdrop = page.locator(".link-modal-backdrop");
  await expect(backdrop).toBeVisible();
  const covers = await backdrop.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return (
      Math.round(box.width) >= window.innerWidth &&
      Math.round(box.height) >= window.innerHeight &&
      node.parentElement === document.body
    );
  });
  expect(covers).toBe(true);

  await page.keyboard.press("Escape");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".link-row", { hasText: slug })).toHaveCount(0, {
    timeout: 20000,
  });
});

test("every placeholder is readable against what sits behind it", async () => {
  const guest = await context.browser()!.newContext();
  const guestPage = await guest.newPage();
  const failures: string[] = [];

  const visits = [
    ["link signed in", `${LINK}/`, page],
    ["link/report", `${LINK}/report`, page],
    ["pulse console", `${PULSE}/`, page],
    ["pass account", `${PASS}/`, page],
    ["link signed out", `${LINK}/`, guestPage],
    ["pass signed out", `${PASS}/`, guestPage],
  ] as const;

  for (const [label, url, target] of visits) {
    await target.goto(url);
    const weak = await target.evaluate(() => {
      const parse = (value: string) => {
        const m = value.match(
          /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
        );
        if (!m) return null;
        return [
          Number(m[1]),
          Number(m[2]),
          Number(m[3]),
          m[4] === undefined ? 1 : Number(m[4]),
        ] as const;
      };
      const luminance = (rgb: readonly number[]) =>
        [rgb[0]!, rgb[1]!, rgb[2]!]
          .map((v) => {
            const c = v / 255;
            return c <= 0.03928
              ? c / 12.92
              : Math.pow((c + 0.055) / 1.055, 2.4);
          })
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const contrast = (a: readonly number[], b: readonly number[]) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi! + 0.05) / (lo! + 0.05);
      };
      const ground = (el: Element): readonly number[] => {
        let node: Element | null = el;
        while (node && node !== document.documentElement) {
          const bg = parse(getComputedStyle(node).backgroundColor);
          if (bg && bg[3] > 0.5) return bg;
          node = node.parentElement;
        }
        return [7, 9, 8, 1];
      };
      const out: string[] = [];
      for (const el of document.querySelectorAll("input, textarea")) {
        const placeholder = el.getAttribute("placeholder");
        if (!placeholder) continue;
        const style = getComputedStyle(el, "::placeholder");
        const fg = parse(style.color);
        if (!fg) continue;
        const ratio = contrast(fg, ground(el)) * Number(style.opacity || 1);
        if (ratio < 4.5) {
          out.push(`"${placeholder}" ${ratio.toFixed(2)}:1 ${style.color}`);
        }
      }
      return out;
    });
    failures.push(...weak.map((entry) => `${label}: ${entry}`));
  }
  await guest.close();
  expect(failures).toEqual([]);
});

test("a modal names itself, keeps the keyboard, and freezes the page behind", async () => {
  test.setTimeout(120_000);

  const slug = `probedlg${run}`;
  await page.goto(`${LINK}/`);
  await page
    .locator('input[placeholder="https://example.com/launch"]')
    .fill("https://example.com/dialog");
  await page.locator('input[placeholder="optional"]').fill(slug);
  await page.getByRole("button", { name: "Create link" }).click();
  await expect(page.locator(".link-row", { hasText: slug })).toBeVisible({
    timeout: 20000,
  });

  const openers: Array<[string, () => Promise<void>]> = [
    [
      "Stats",
      async () => {
        await page.goto(`${LINK}/`);
        await page
          .locator(".link-row", { hasText: slug })
          .getByRole("button", { name: "Stats", exact: true })
          .click();
      },
    ],
    [
      "QR",
      async () => {
        await page.goto(`${LINK}/`);
        await page
          .locator(".link-row", { hasText: slug })
          .getByRole("button", { name: "QR", exact: true })
          .click();
      },
    ],
    [
      "Edit",
      async () => {
        await page.goto(`${LINK}/`);
        await page
          .locator(".link-row", { hasText: slug })
          .getByRole("button", { name: "Edit", exact: true })
          .click();
      },
    ],
    [
      "Enrollment",
      async () => {
        await page.goto(`${PULSE}/`);
        await page.getByRole("button", { name: "Enroll node" }).click();
        await page.getByLabel("Node label").fill(`dlg-node-${run}`);
        await page.getByRole("button", { name: "Create token" }).click();
      },
    ],
  ];

  const problemsFound: string[] = [];
  for (const [label, open] of openers) {
    await open();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 20000 });

    const named = await dialog.evaluate((node) => {
      const byId = node.getAttribute("aria-labelledby");
      const target = byId ? document.getElementById(byId) : null;
      return Boolean(
        node.getAttribute("aria-label") || target?.textContent?.trim(),
      );
    });
    if (!named) problemsFound.push(`${label}: dialog has no accessible name`);

    const locked = await page.evaluate(
      () => getComputedStyle(document.body).overflow === "hidden",
    );
    if (!locked)
      problemsFound.push(`${label}: page behind is not scroll locked`);

    let escaped = false;
    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press("Tab");
      const outside = await page.evaluate(() => {
        const node = document.querySelector('[role="dialog"]');
        const active = document.activeElement;
        return Boolean(
          node && active && active !== document.body && !node.contains(active),
        );
      });
      if (outside) {
        escaped = true;
        break;
      }
    }
    if (escaped) problemsFound.push(`${label}: Tab escapes to the page behind`);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const released = await page.evaluate(
      () => getComputedStyle(document.body).overflow !== "hidden",
    );
    if (!released)
      problemsFound.push(`${label}: the page stayed locked after closing`);
  }

  expect(problemsFound).toEqual([]);

  await page.goto(`${LINK}/`);
  await page
    .locator(".link-row", { hasText: slug })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator(".link-row", { hasText: slug })).toHaveCount(0, {
    timeout: 20000,
  });
});

test("the hidden file picker is not a keyboard trap", async () => {
  await page.goto(`${LINK}/`);
  const hidden = page.locator('.drop-zone input[type="file"]');
  await expect(hidden).toHaveAttribute("tabindex", "-1");
  await expect(hidden).toHaveAttribute("aria-hidden", "true");
});

test("pass: the account page lists devices and can revoke one", async () => {
  await page.goto(`${PASS}/`);
  await expect(page.getByRole("heading", { name: admin.user })).toBeVisible();
  await expect(page.getByText("Devices", { exact: true })).toBeVisible();

  const revokable = page.getByRole("button", { name: /^Revoke / });
  const before = await revokable.count();
  if (before > 0) {
    await revokable.first().click();
    await expect(page.getByText("Device signed out.")).toBeVisible({
      timeout: 20000,
    });
    await expect(revokable).toHaveCount(before - 1);
  }
});

test("pass: every session control says which device it acts on", async () => {
  await page.goto(`${PASS}/`);
  await expect(page.locator(".pass-device").first()).toBeVisible({
    timeout: 20000,
  });
  const names = await page
    .locator(".pass-device button")
    .evaluateAll((nodes) =>
      nodes.map(
        (node) => node.getAttribute("aria-label") || node.textContent || "",
      ),
    );
  expect(names.length).toBeGreaterThan(0);
  expect(new Set(names).size).toBe(names.length);
});

test("link: a drop can be created, opened by its link, and deleted", async () => {
  await page.goto(`${LINK}/`);
  await page.locator('.drop-zone input[type="file"]').setInputFiles({
    name: `probe-${run}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(`payload for run ${run}`),
  });
  await expect(page.getByText(`probe-${run}.txt`)).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Create transfer" }).click();

  const share = page.getByLabel("Share URL");
  await expect(share).toBeVisible({ timeout: 40000 });
  const shareUrl = await share.inputValue();
  expect(shareUrl, "the drop result should show a share URL").toMatch(
    /^https?:\/\//,
  );

  const viewer = await context.newPage();
  await viewer.goto(shareUrl!);
  await expect(viewer.getByText(`probe-${run}.txt`)).toBeVisible({
    timeout: 20000,
  });
  await viewer.close();

  await page.goto(`${LINK}/`);
  const dropRow = page.locator(".link-row", { hasText: `probe-${run}.txt` });
  await expect(dropRow).toBeVisible({ timeout: 20000 });
  await dropRow.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dropRow.locator(".link-tags")).toContainText("Deleted", {
    timeout: 20000,
  });
  await expect(dropRow.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(dropRow.locator(".link-row-error")).toHaveCount(0);
});

test("gateway: resolves a live slug, refuses a paused one, 404s an unknown one", async () => {
  await page.goto(`${LINK}/`);
  const slug = `probegw${run}`;
  await page
    .locator('input[placeholder="https://example.com/launch"]')
    .fill("https://example.com/gateway-target");
  await page.locator('input[placeholder="optional"]').fill(slug);
  await page.getByRole("button", { name: "Create link" }).click();
  const row = page.locator(".link-row", { hasText: slug });
  await expect(row).toBeVisible({ timeout: 20000 });

  const hop = await page.request.get(`${GATEWAY}/${slug}`, { maxRedirects: 0 });
  expect(hop.status()).toBeGreaterThanOrEqual(300);
  expect(hop.status()).toBeLessThan(400);
  expect(hop.headers()["location"]).toBe("https://example.com/gateway-target");

  const missing = await page.request.get(`${GATEWAY}/probemissing${run}`, {
    maxRedirects: 0,
  });
  expect(missing.status()).toBe(404);

  await row.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const blocked = await page.request.get(`${GATEWAY}/${slug}`, {
    maxRedirects: 0,
  });
  expect(blocked.status()).toBeGreaterThanOrEqual(400);

  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".link-row", { hasText: slug })).toHaveCount(0, {
    timeout: 20000,
  });
});

test("link: a password-protected short link asks before it resolves", async () => {
  await page.goto(`${LINK}/`);
  const slug = `probelock${run}`;
  await page
    .locator('input[placeholder="https://example.com/launch"]')
    .fill("https://example.com/locked");
  await page.locator('input[placeholder="optional"]').fill(slug);
  await page
    .locator('input[placeholder="Optional, at least 8 characters"]')
    .fill("probe-passphrase");
  await page.getByRole("button", { name: "Create link" }).click();

  const row = page.locator(".link-row", { hasText: slug });
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row.locator(".link-tags")).toContainText("Protected");

  const guarded = await page.request.get(`${GATEWAY}/${slug}`, {
    maxRedirects: 0,
  });
  expect(
    guarded.headers()["location"],
    "a protected link must not hand out its destination",
  ).not.toBe("https://example.com/locked");

  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".link-row", { hasText: slug })).toHaveCount(0, {
    timeout: 20000,
  });
});

test("link: a drop stops at its download limit", async () => {
  await page.goto(`${LINK}/`);
  await page.locator('.drop-zone input[type="file"]').setInputFiles({
    name: `limit-${run}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(`limited payload ${run}`),
  });
  await expect(page.getByText(`limit-${run}.txt`)).toBeVisible({
    timeout: 20000,
  });
  await page.getByLabel("Downloads").fill("1");
  await page.getByRole("button", { name: "Create transfer" }).click();

  const share = page.getByLabel("Share URL");
  await expect(share).toBeVisible({ timeout: 40000 });
  const shareUrl = await share.inputValue();
  const token = new URL(shareUrl).pathname.split("/").pop()!;

  const first = await page.request.get(`${LINK}/api/public/${token}/download`);
  expect(first.status()).toBe(200);
  const second = await page.request.get(`${LINK}/api/public/${token}/download`);
  expect(
    second.status(),
    "a second download must be refused once the limit is spent",
  ).toBe(410);
});

test("pass: the username can be changed and changed back", async () => {
  await page.goto(`${PASS}/`);
  await page.getByRole("button", { name: "Edit username" }).click();
  await page.locator('input[name="username"]').fill(`${admin.user}x`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Username updated.")).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByRole("heading", { name: `${admin.user}x` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit username" }).click();
  await page.locator('input[name="username"]').fill(admin.user);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: admin.user })).toBeVisible({
    timeout: 20000,
  });
});

async function mintToken(
  email: string,
  purpose: "EMAIL" | "PASSWORD_RESET",
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  const token = btoa(raw)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest))
    binary += String.fromCharCode(byte);
  const hash = btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");

  passSql(
    `INSERT INTO verification_tokens (id, user_id, purpose, token_hash, expires_at) ` +
      `SELECT '${purpose}-${run}-${Date.now()}', id, '${purpose}', '${hash}', ` +
      `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 minutes') ` +
      `FROM users WHERE email = '${email}'`,
  );
  return token;
}

test("pass: an emailed verification token activates the account", async () => {
  test.setTimeout(180_000);
  const fresh = await context.browser()!.newContext();
  const worker = await fresh.newPage();
  const account = await freshAccount(worker, "probeverify");
  passSql(
    `UPDATE users SET email_verified_at = NULL WHERE email = '${account.email}'`,
  );
  const token = await mintToken(account.email, "EMAIL");

  await worker.goto(`${PASS}/verify?token=${encodeURIComponent(token)}`);
  await expect(worker.getByText(/verified/i)).toBeVisible({ timeout: 20000 });

  await worker.goto(`${PASS}/`);
  await worker.locator('input[name="email"]').fill(account.email);
  await worker.locator('input[name="password"]').fill(password);
  await worker.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(worker.getByRole("heading", { name: account.user })).toBeVisible(
    { timeout: 20000 },
  );
  await fresh.close();
});

test("pass: a password reset token sets a new password", async () => {
  test.setTimeout(180_000);
  const fresh = await context.browser()!.newContext();
  const worker = await fresh.newPage();
  const account = await freshAccount(worker, "probereset");
  const token = await mintToken(account.email, "PASSWORD_RESET");
  const nextPassword = "probe-password-2";

  await worker.goto(`${PASS}/reset?token=${encodeURIComponent(token)}`);
  const field = worker.locator('input[name="password"]');
  await expect(field).toBeVisible({ timeout: 20000 });
  await field.fill(nextPassword);
  await worker.getByRole("button", { name: "Update password" }).click();
  await expect(
    worker.getByRole("link", { name: "Return to sign in" }),
  ).toBeVisible({ timeout: 20000 });

  clearRateLimits();
  await worker.goto(`${PASS}/`);
  await worker.locator('input[name="email"]').fill(account.email);
  await worker.locator('input[name="password"]').fill(nextPassword);
  await worker.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(worker.getByRole("heading", { name: account.user })).toBeVisible(
    { timeout: 20000 },
  );
  await fresh.close();
});

test("link: a signed-out visitor can send a plaintext drop", async () => {
  test.setTimeout(120_000);
  const guest = await context.browser()!.newContext();
  const guestPage = await guest.newPage();
  const linkHere = localWorkerOrigin("link");
  const passHere = localWorkerOrigin("pass");

  const attach = async () => {
    await guestPage.locator('.drop-zone input[type="file"]').setInputFiles({
      name: `guest-${run}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`guest payload ${run}`),
    });
    await expect(guestPage.getByText(`guest-${run}.txt`)).toBeVisible({
      timeout: 20000,
    });
    await guestPage.getByRole("button", { name: "Create transfer" }).click();
  };

  await guestPage.goto(`${linkHere}/`);
  await attach();

  await guestPage.waitForURL((url) => url.pathname === "/challenge", {
    timeout: 40000,
  });
  await guestPage.waitForURL(
    (url) => url.origin === linkHere && url.pathname === "/",
    { timeout: 40000 },
  );
  await attach();

  const share = guestPage.getByLabel("Share URL");
  await expect(share).toBeVisible({ timeout: 40000 });
  const shareUrl = await share.inputValue();
  expect(shareUrl).not.toContain("#");

  const viewer = await guest.newPage();
  await viewer.goto(shareUrl);
  await expect(viewer.getByText(`guest-${run}.txt`)).toBeVisible({
    timeout: 20000,
  });
  await guest.close();
});

test("pass: an account can delete itself", async () => {
  test.setTimeout(180_000);
  const fresh = await context.browser()!.newContext();
  const worker = await fresh.newPage();
  const account = await freshAccount(worker, "probegone");
  clearRateLimits();
  await worker.goto(`${PASS}/`);
  await worker.locator('input[name="email"]').fill(account.email);
  await worker.locator('input[name="password"]').fill(password);
  await worker.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(worker.getByRole("heading", { name: account.user })).toBeVisible(
    { timeout: 20000 },
  );

  await worker.getByRole("button", { name: "Delete this account" }).click();
  const confirm = worker.locator('input[type="email"]').last();
  await expect(confirm).toBeVisible({ timeout: 20000 });
  await confirm.fill(account.email);
  await worker
    .getByRole("button", { name: /delete|confirm/i })
    .last()
    .click();
  await expect(
    worker.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible({ timeout: 20000 });

  clearRateLimits();
  await worker.goto(`${PASS}/`);
  await worker.locator('input[name="email"]').fill(account.email);
  await worker.locator('input[name="password"]').fill(password);
  await worker.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(worker.locator(".pass-status-error")).toBeVisible({
    timeout: 20000,
  });
  await fresh.close();
});

test("pass: signing out actually signs you out", async () => {
  await page.goto(`${PASS}/`);
  await expect(page.getByRole("heading", { name: admin.user })).toBeVisible();
  await page
    .getByRole("button", { name: "Sign out of this device" })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".pass-status-error")).toHaveCount(0);
});

test("no console errors, page errors, or failed API calls were seen", () => {
  expect([...new Set(problems)]).toEqual([]);
});
