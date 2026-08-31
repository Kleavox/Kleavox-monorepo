import { expect, test } from "@playwright/test";

test("the cabinet holds exactly nine bays, three of them filled", async ({
  page,
}) => {
  const session = page.waitForResponse((response) =>
    response.url().includes("/api/session"),
  );
  await page.goto("/");
  await session;
  await expect(page.locator("main")).not.toHaveClass(/kvx-main/);
  await expect(page.locator("[data-bay]")).toHaveCount(9);
  await expect(page.locator("[data-cartridge]")).toHaveCount(3);
});

test("each filled bay offers a named button", async ({ page }) => {
  await page.goto("/");
  for (const name of [
    "Select Link, bay 1, visitor pass required",
    "Select Pulse, bay 2, owner pass required",
    "Select Portfolio, bay 3, open to everyone",
  ]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      1,
    );
  }
});

test("the six empty bays are not controls", async ({ page }) => {
  await page.goto("/");
  const empties = page.locator("[data-bay]:not(:has([data-cartridge]))");
  await expect(empties).toHaveCount(6);
  await expect(empties.locator("button")).toHaveCount(0);
  await expect(
    empties.locator("a, [tabindex], button, input, select, textarea"),
  ).toHaveCount(0);
  const focusable = await empties.evaluateAll(
    (nodes) =>
      nodes.filter(
        (node) =>
          node.matches("a, button, input, select, textarea") ||
          node.hasAttribute("tabindex"),
      ).length,
  );
  expect(focusable).toBe(0);
});

test("the machine stops growing on a wide desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  const box = await page.locator("[data-machine]").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(820);
});

test("no horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBe(320);
});

test("the three mobile shelves share one height", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const heights = await page
    .locator("[data-shelf]")
    .evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
    );
  expect(new Set(heights).size).toBe(1);
});

test("every key is reachable and large enough to hit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-dock]").click();
  const keys = page.locator("[data-key]");
  await expect(keys).toHaveCount(12);
  for (const key of await keys.all()) {
    const box = await key.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(key).toBeVisible();
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test("the console reports its own open state to assistive tech", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dock = page.locator("[data-dock]");
  const panel = page.locator("[data-console]");
  await expect(dock).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("data-console", "closed");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(await panel.evaluate((node) => node.hasAttribute("inert"))).toBe(true);
  await dock.click();
  await expect(dock).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-console]")).toHaveAttribute(
    "data-console",
    "open",
  );
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  expect(await panel.evaluate((node) => node.hasAttribute("inert"))).toBe(
    false,
  );
});

test("closing the console returns focus to the dock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-dock]").click();
  await expect(page.locator("[data-dock]")).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-dock]")).toBeFocused();
  await expect(page.locator("[data-console]")).toHaveAttribute(
    "data-console",
    "closed",
  );
});

test("the reader stays inside the control column in the DOM", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const inside = await page.evaluate(() =>
    Boolean(document.querySelector("[data-console] [data-reader]")),
  );
  expect(inside).toBe(true);
  await page.locator("[data-dock]").click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const reader = document
          .querySelector("[data-reader]")!
          .getBoundingClientRect();
        const panel = document
          .querySelector("[data-console]")!
          .getBoundingClientRect();
        return Math.round(reader.bottom - panel.top);
      }),
    )
    .toBeLessThanOrEqual(0);
});
