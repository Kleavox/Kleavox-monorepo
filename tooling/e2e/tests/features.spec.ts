import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { localWorkerOrigin } from "@kleavox/topology";
import {
  clearRateLimits,
  freshAccount,
  passSql,
  PROBE_PASSWORD,
} from "./pass-account";

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

const run = Date.now().toString().slice(-6);
const admin = { user: "probeops", email: "probeops@example.com" };

let context: BrowserContext;
let page: Page;
let problems: string[] = [];
let expectFailure = false;

const passDir = path.join(repoRoot, "workers", "pass");

async function attempt(): Promise<string | null> {
  await page.goto(`${PASS}/`);
  await page.locator('input[name="email"]').fill(admin.email);
  await page.locator('input[name="password"]').fill(PROBE_PASSWORD);
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
    if (expectFailure) return;
    if (message.type() === "error") problems.push("console: " + message.text());
  });
  page.on("pageerror", (error) => problems.push("pageerror: " + error.message));
  page.on("response", (response) => {
    if (expectFailure) return;
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
  await page.locator('input[name="password"]').fill(PROBE_PASSWORD);
  await page.locator('input[name="confirm-password"]').fill(PROBE_PASSWORD);
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
  await expect(page.getByRole("heading", { name: /^pulse:/ })).toBeVisible();

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

  const row = page.locator(".link-activity-row", { hasText: slug });
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(
    page.locator(".link-activity-row").first(),
    "a link created a second ago belongs at the top of the activity list",
  ).toContainText(slug);

  await row.hover();
  await row.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await row.hover();
  await row.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();

  await row.hover();
  await row.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.locator(".link-stats")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".link-stats")).toHaveCount(0);

  await row.hover();
  await row.getByRole("button", { name: "QR", exact: true }).click();
  await expect(page.locator(".link-qr")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".link-qr")).toHaveCount(0);

  await row.hover();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.locator(".link-edit");
  await expect(editor).toBeVisible();
  await editor
    .locator('input[type="url"]')
    .fill("https://example.com/moved-here");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0, { timeout: 20000 });
  await expect(
    page.locator(".link-activity-row", { hasText: "example.com/moved-here" }),
  ).toBeVisible();

  await row.hover();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.locator(".link-activity-row", { hasText: slug }),
  ).toHaveCount(0, {
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
  await expect(
    page.locator(".link-activity-row", { hasText: slug }),
  ).toBeVisible({
    timeout: 20000,
  });

  await page.goto(`${LINK}/report`);
  await expect(page.getByText("Report a link")).toBeVisible();

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
    await ringless([".link-field input", ".link-prefix-input input"]),
  ).toEqual([]);
  await page.getByRole("tab", { name: "Send a file", exact: true }).click();
  expect(
    await ringless([".drop-options select", ".drop-options input"]),
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

  const row = page.locator(".link-activity-row", { hasText: slug });
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
  await row.hover();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.locator(".link-activity-row", { hasText: slug }),
  ).toHaveCount(0, {
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
  await expect(
    page.locator(".link-activity-row", { hasText: slug }),
  ).toBeVisible({
    timeout: 20000,
  });

  const openers: Array<[string, () => Promise<void>]> = [
    [
      "Stats",
      async () => {
        await page.goto(`${LINK}/`);
        const openerRow = page.locator(".link-activity-row", { hasText: slug });
        await openerRow.hover();
        await openerRow
          .getByRole("button", { name: "Stats", exact: true })
          .click();
      },
    ],
    [
      "QR",
      async () => {
        await page.goto(`${LINK}/`);
        const openerRow = page.locator(".link-activity-row", { hasText: slug });
        await openerRow.hover();
        await openerRow
          .getByRole("button", { name: "QR", exact: true })
          .click();
      },
    ],
    [
      "Edit",
      async () => {
        await page.goto(`${LINK}/`);
        const openerRow = page.locator(".link-activity-row", { hasText: slug });
        await openerRow.hover();
        await openerRow
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
  const finalRow = page.locator(".link-activity-row", { hasText: slug });
  await finalRow.hover();
  await finalRow.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.locator(".link-activity-row", { hasText: slug }),
  ).toHaveCount(0, {
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
  await expect(page.locator(".pass-row-device").first()).toBeVisible({
    timeout: 20000,
  });
  const names = await page
    .locator(".pass-row-device button")
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
  await page.getByRole("tab", { name: "Send a file", exact: true }).click();
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
  const dropRow = page.locator(".link-activity-row", {
    hasText: `probe-${run}.txt`,
  });
  await expect(dropRow).toBeVisible({ timeout: 20000 });
  await dropRow.hover();
  await dropRow.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dropRow.locator(".kvx-row-state")).toContainText("Deleted", {
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
  const row = page.locator(".link-activity-row", { hasText: slug });
  await expect(row).toBeVisible({ timeout: 20000 });

  const hop = await page.request.get(`${GATEWAY}/${slug}`, { maxRedirects: 0 });
  expect(hop.status()).toBeGreaterThanOrEqual(300);
  expect(hop.status()).toBeLessThan(400);
  expect(hop.headers()["location"]).toBe("https://example.com/gateway-target");

  const missing = await page.request.get(`${GATEWAY}/probemissing${run}`, {
    maxRedirects: 0,
  });
  expect(missing.status()).toBe(404);

  await row.hover();
  await row.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const blocked = await page.request.get(`${GATEWAY}/${slug}`, {
    maxRedirects: 0,
  });
  expect(blocked.status()).toBeGreaterThanOrEqual(400);

  await row.hover();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.locator(".link-activity-row", { hasText: slug }),
  ).toHaveCount(0, {
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

  const row = page.locator(".link-activity-row", { hasText: slug });
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row.locator(".kvx-row-detail")).toContainText("Protected");

  const guarded = await page.request.get(`${GATEWAY}/${slug}`, {
    maxRedirects: 0,
  });
  expect(
    guarded.headers()["location"],
    "a protected link must not hand out its destination",
  ).not.toBe("https://example.com/locked");

  await row.hover();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.locator(".link-activity-row", { hasText: slug }),
  ).toHaveCount(0, {
    timeout: 20000,
  });
});

test("link: a drop stops at its download limit", async () => {
  await page.goto(`${LINK}/`);
  await page.getByRole("tab", { name: "Send a file", exact: true }).click();
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

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function hashOf(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return base64Url(new Uint8Array(digest));
}

async function mintToken(
  email: string,
  purpose: "EMAIL" | "PASSWORD_RESET",
): Promise<string> {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await hashOf(token);

  passSql(
    `INSERT INTO verification_tokens (id, user_id, purpose, token_hash, expires_at) ` +
      `SELECT '${purpose}-${run}-${Date.now()}', id, '${purpose}', '${hash}', ` +
      `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 minutes') ` +
      `FROM users WHERE email = '${email}'`,
  );
  return token;
}

async function mintOtp(email: string, code: string): Promise<void> {
  const key = `otp:${await hashOf(email.trim().toLowerCase())}`;
  const record = JSON.stringify({
    codeHash: await hashOf(`${email.trim().toLowerCase()}:${code}`),
    attempts: 0,
    expiresAt: Date.now() + 600_000,
  }).replaceAll('"', '\\"');
  execSync(
    `pnpm exec wrangler kv key put --binding SESSIONS --local "${key}" "${record}"`,
    { cwd: passDir, stdio: "pipe" },
  );
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
  await worker.locator('input[name="password"]').fill(PROBE_PASSWORD);
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

test("otp: an unknown email becomes an account that still needs setup", async () => {
  test.setTimeout(180_000);
  clearRateLimits();
  const email = `otp-new-${run}@example.com`;
  const fresh = await context.browser()!.newContext();
  const worker = await fresh.newPage();

  await worker.goto(GATEWAY);
  await mintOtp(email, "246810");

  const response = await worker.request.post(`${GATEWAY}/api/auth/otp/verify`, {
    headers: { origin: GATEWAY },
    data: { email, code: "246810" },
  });

  expect(response.status()).toBe(200);
  const minted = response.headers()["set-cookie"] ?? "";
  expect(minted).toContain("__Secure-kleavox_session=");
  expect(
    minted,
    "locally every origin shares the host localhost and cookies ignore port, " +
      "so host-only is correct here; a Domain would be one the browser refuses",
  ).not.toContain("Domain=");
  expect(await response.json()).toMatchObject({
    authenticated: true,
    needsSetup: true,
  });

  passSql(`DELETE FROM users WHERE email = '${email}'`);
  await fresh.close();
});

test("otp: a disabled account is refused after the code is accepted", async () => {
  test.setTimeout(180_000);
  clearRateLimits();
  const fresh = await context.browser()!.newContext();
  const worker = await fresh.newPage();
  const account = await freshAccount(worker, "otpoff");

  passSql(
    `UPDATE users SET disabled_at = datetime('now') WHERE email = '${account.email}'`,
  );
  await mintOtp(account.email, "135791");

  const response = await worker.request.post(`${GATEWAY}/api/auth/otp/verify`, {
    headers: { origin: GATEWAY },
    data: { email: account.email, code: "135791" },
  });

  expect(response.status()).toBe(403);
  expect(JSON.stringify(await response.json())).toMatch(/disabled/i);

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
  await worker.locator('input[name="password"]').fill(PROBE_PASSWORD);
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
  await worker.locator('input[name="password"]').fill(PROBE_PASSWORD);
  await worker.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(worker.locator(".pass-status-error")).toBeVisible({
    timeout: 20000,
  });
  await fresh.close();
});

test("the header appears on every origin and marks the right tool", async () => {
  for (const [origin, tool] of [
    [PASS, "pass"],
    [LINK, "link"],
    [PULSE, "pulse"],
  ] as const) {
    await page.goto(origin);
    const current = page.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(tool);
  }
});

test("the machine counts what needs attention and marks the tool it sits in", async () => {
  const slug = `probeexpiring${run}`;
  await page.goto(`${LINK}/`);
  await page.getByRole("tab", { name: "Send a file", exact: true }).click();
  await page.locator('.drop-zone input[type="file"]').setInputFiles({
    name: `${slug}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(`expiring payload ${run}`),
  });
  await expect(page.getByText(`${slug}.txt`)).toBeVisible({ timeout: 20000 });
  await page.locator(".drop-options select").selectOption("3600");
  await page.getByRole("button", { name: "Create transfer" }).click();
  await expect(page.getByLabel("Share URL")).toBeVisible({ timeout: 40000 });

  const estate = await page.request.get(`${GATEWAY}/api/estate`);
  expect(estate.status()).toBe(200);
  const overview = (await estate.json()) as {
    attention: { kind: string }[];
    link: { expiringSoon: number };
  };
  expect(overview.link.expiringSoon).toBeGreaterThan(0);
  expect(overview.attention.map((item) => item.kind)).toContain(
    "link-expiring",
  );

  await page.goto(GATEWAY);
  const screen = page.locator("[data-screen]");
  await expect(screen).toBeVisible();
  await expect(screen).toHaveText(
    `${overview.attention.length} NEED ATTENTION`,
  );

  const linkTool = page.locator('.kvx-nav-tool[aria-label^="link,"]');
  await expect(linkTool).toHaveCount(1);
  await expect(linkTool.locator(".kvx-pad-warn")).toBeVisible();

  await page.goto(`${LINK}/`);
  const expiringRow = page.locator(".link-activity-row", {
    hasText: `${slug}.txt`,
  });
  await expiringRow.hover();
  await expiringRow
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(expiringRow.locator(".kvx-row-state")).toContainText("Deleted", {
    timeout: 20000,
  });
});

test("the machine says a failed estate call out loud instead of an all-clear", async () => {
  await page.route("**/api/estate", (route) => route.fulfill({ status: 500 }));
  expectFailure = true;
  await page.goto(GATEWAY);

  const screen = page.locator("[data-screen]");
  await expect(page.locator("[data-cabinet-state]")).toHaveText("OWNER MODE");
  await expect(screen).toBeVisible();
  await expect(screen).toHaveText("ESTATE UNREADABLE");

  const read = await screen.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const onTop = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return {
      words: (node.textContent ?? "").trim(),
      covered: onTop === null || !node.contains(onTop),
      inert: node.closest("[inert]") !== null,
      muted: node.closest('[aria-hidden="true"]') !== null,
    };
  });
  expect(read).toEqual({
    words: "ESTATE UNREADABLE",
    covered: false,
    inert: false,
    muted: false,
  });

  const navCounts = page.locator(".kvx-nav-count");
  await expect(navCounts).toHaveCount(3);
  await expect(
    navCounts,
    "an unmeasured count is written --, never nothing",
  ).toHaveText(["--", "--", "--"]);
  for (const index of [0, 1, 2]) {
    await expect(navCounts.nth(index)).toBeVisible();
  }
  expect(
    await navCounts.allTextContents(),
    "an unmeasured count is written --, never 0",
  ).not.toContain("0");
  await expect(
    page.locator(".kvx-nav-tool .kvx-pad-warn"),
    "a tool whose count could not be read carries the alarm, not silence",
  ).toHaveCount(3);

  await page.unroute("**/api/estate");
  expectFailure = false;
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
