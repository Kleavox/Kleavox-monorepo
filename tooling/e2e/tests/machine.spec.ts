import { expect, test } from "@playwright/test";

test("the cabinet holds exactly nine bays, three of them filled", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-bay]")).toHaveCount(9);
  await expect(page.locator("[data-cartridge]")).toHaveCount(3);
});

test("the six empty bays are not controls", async ({ page }) => {
  await page.goto("/");
  const empties = page.locator("[data-bay]:not(:has([data-cartridge]))");
  await expect(empties).toHaveCount(6);
  await expect(empties.locator("button")).toHaveCount(0);
  const focusable = await empties.evaluateAll(
    (nodes) =>
      nodes.filter(
        (node) =>
          node.matches("button, a, input, select, textarea") ||
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
