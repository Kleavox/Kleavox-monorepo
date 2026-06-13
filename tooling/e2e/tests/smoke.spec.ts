import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

// Browser-facing URLs use localhost: headless Chromium refuses to store the
// __Secure- prefixed session cookie on plain-http 127.0.0.1, but honours the
// localhost trustworthy-origin exemption. The workers listen on the same
// loopback interface either way.
const GATEWAY = "http://localhost:8786";
const PASS = "http://localhost:8787";
const LINK = "http://localhost:8788";

const email = `e2e-${Date.now()}@example.com`;
const password = "playwright-password-1";

function markEmailVerified(address: string): void {
  execSync(
    `pnpm exec wrangler d1 execute local-pass --local --command "UPDATE users SET email_verified_at = datetime('now') WHERE email = '${address}'"`,
    { cwd: path.join(repoRoot, "workers", "pass"), stdio: "pipe" },
  );
}

test("web home loads through the gateway", async ({ page }) => {
  await page.goto(`${GATEWAY}/`);
  await expect(page.locator(".wm")).toContainText("Kleav");
  await expect(page.locator("[data-signin]")).toBeVisible();
});

test("no horizontal overflow at 360px", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
  });
  const page = await context.newPage();
  for (const url of [`${GATEWAY}/`, `${LINK}/`, `${PASS}/`]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  await context.close();
});

test("auth journey: register, sign in, account page, link header", async ({
  page,
}) => {
  await page.goto(`${PASS}/`);
  await page.getByRole("button", { name: "Create an account" }).click();

  await page.locator('input[name="username"]').fill("e2e_user");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirm-password"]').fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  markEmailVerified(email);

  await page.goto(`${PASS}/`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: "e2e_user" })).toBeVisible();
  await expect(page.getByText("Sign-in methods")).toBeVisible();
  await expect(
    page.locator(".pass-providers span", { hasText: "Password" }),
  ).toBeVisible();

  await page.goto(`${LINK}/`);
  await expect(page.locator(".link-account-trigger")).toHaveText("e2e_user");
});

test("guest short-link creation routes through the security challenge", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${LINK}/`);
  await page
    .getByPlaceholder("https://example.com")
    .fill("https://example.org/e2e");
  await page.getByRole("button", { name: "Shorten" }).click();

  // The challenge page lives on the pass worker (port 8787); the exact host
  // depends on the configured origins, so match on the port alone.
  await page.waitForURL((url) => url.port === "8787");
  await context.close();
});

test("the short-link draft survives the challenge redirect", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${LINK}/`);
  await page.evaluate(() =>
    sessionStorage.setItem(
      "link:draft:public",
      JSON.stringify({ targetUrl: "https://example.org/restored" }),
    ),
  );
  await page.reload();
  await expect(page.getByPlaceholder("https://example.com")).toHaveValue(
    "https://example.org/restored",
  );
  await context.close();
});
