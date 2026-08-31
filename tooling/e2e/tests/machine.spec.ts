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
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1100, height: 620 },
    { width: 900, height: 520 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    if (viewport.width <= 760) await page.locator("[data-dock]").click();
    const keys = page.locator("[data-key]");
    await expect(keys).toHaveCount(12);
    for (const key of await keys.all()) {
      const box = await key.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await expect(key).toBeVisible();
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
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
  await page.keyboard.press("Escape");
  await expect(dock).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("data-console", "closed");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(await panel.evaluate((node) => node.hasAttribute("inert"))).toBe(true);
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

test("the close button and the scrim close it the same way", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dock = page.locator("[data-dock]");
  const panel = page.locator("[data-console]");

  await dock.click();
  await page.locator("[data-console-close]").click();
  await expect(panel).toHaveAttribute("data-console", "closed");
  await expect(dock).toHaveAttribute("aria-expanded", "false");
  await expect(dock).toBeFocused();

  await dock.click();
  await page.locator("[data-scrim]").click({ position: { x: 30, y: 30 } });
  await expect(panel).toHaveAttribute("data-console", "closed");
  await expect(dock).toHaveAttribute("aria-expanded", "false");
  await expect(dock).toBeFocused();
});

test("the open sheet is a modal, and says so", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const panel = page.locator("[data-console]");
  const reach = async (): Promise<boolean> =>
    page.evaluate(() => {
      const cartridge = document.querySelector<HTMLElement>(
        "[data-cartridge='1']",
      )!;
      cartridge.focus();
      const reached = document.activeElement === cartridge;
      cartridge.blur();
      return reached;
    });

  expect(await reach()).toBe(true);
  await page.locator("[data-dock]").click();
  await expect(panel).toHaveAttribute("role", "dialog");
  await expect(panel).toHaveAttribute("aria-modal", "true");
  expect(await reach()).toBe(false);
  await page.keyboard.press("Escape");
  expect(await reach()).toBe(true);
});

test("on a desktop the console is a landmark, not a modal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const panel = page.locator("[data-console]");
  expect(
    await panel.evaluate((node) => ({
      role: node.getAttribute("role"),
      modal: node.getAttribute("aria-modal"),
      inert: node.hasAttribute("inert"),
    })),
  ).toEqual({ role: null, modal: null, inert: false });
  await page.locator("[data-key='7']").focus();
  await expect(page.locator("[data-key='7']")).toBeFocused();
});

test("narrowing to the sheet does not strand focus inside it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("[data-key='7']").focus();
  await expect(page.locator("[data-key='7']")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-dock]")).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("[data-cartridge='2']").focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-cartridge='2']")).toBeFocused();
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

test("the login terminal is a modal dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const terminal = page.locator("[data-terminal]");
  await expect(terminal).toBeHidden();
  await page.locator("[data-terminal-open]").click();
  await expect(terminal).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.querySelector("[data-terminal]") ===
        document.querySelector("dialog:modal"),
    ),
  ).toBe(true);
});

test("closing the terminal returns focus to the control that opened it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("[data-terminal-open]").click();
  await page.locator("[data-terminal-close]").click();
  await expect(page.locator("[data-terminal]")).toBeHidden();
  await expect(page.locator("[data-terminal-open]")).toBeFocused();
});

test("escape inside the terminal closes it without closing the console", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-dock]").click();
  await page.locator("[data-terminal-open]").click();
  await expect(page.locator("[data-terminal]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-terminal]")).toBeHidden();
  await expect(page.locator("[data-console]")).toHaveAttribute(
    "data-console",
    "open",
  );
  await expect(page.locator("[data-terminal-open]")).toBeFocused();
});

test("the keypad says which mode it is in, not only what colour", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-dock]").click();
  const legend = page.locator(".keypad-mode");
  const selector = page.locator("[data-keypad-mode='selector']");
  const otp = page.locator("[data-keypad-mode='otp']");

  await expect(legend).toHaveText("BAY SELECT", { useInnerText: true });
  await expect(selector).toBeVisible();
  await expect(otp).toBeHidden();

  await page.evaluate(() => {
    document.querySelector<HTMLElement>("[data-machine]")!.dataset.input =
      "otp";
  });
  await expect(legend).toHaveText("EMAIL CODE", { useInnerText: true });
  await expect(otp).toBeVisible();
  await expect(selector).toBeHidden();

  await page.evaluate(() => {
    document.querySelector<HTMLElement>("[data-machine]")!.dataset.input =
      "selector";
  });
  await expect(legend).toHaveText("BAY SELECT", { useInnerText: true });
  await expect(selector).toBeVisible();
  await expect(otp).toBeHidden();
});
