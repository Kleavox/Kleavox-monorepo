import { expect, test } from "@playwright/test";
import { localViteOrigin, localWorkerOrigin } from "@kleavox/topology";

function seconds(value: string): number {
  return Number.parseFloat(value);
}

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

test("narrowing back onto an open sheet does not strand focus on the body", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-dock]").click();
  await expect(page.locator("[data-console]")).toHaveAttribute(
    "data-console",
    "open",
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("[data-cartridge='2']").focus();
  await expect(page.locator("[data-cartridge='2']")).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".cabinet")).toHaveAttribute("inert", "");
  await expect(page.locator("[data-console]")).toHaveAttribute(
    "data-console",
    "open",
  );
  expect(
    await page.evaluate(() => document.activeElement?.tagName ?? null),
  ).not.toBe("BODY");
  await expect(page.locator("[data-reader]")).toBeFocused();
});

test("a resize that keeps the sheet sealed leaves focus where the reader put it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-dock]").click();
  await page.locator("[data-key='7']").focus();
  await expect(page.locator("[data-key='7']")).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".cabinet")).not.toHaveAttribute("inert", "");
  await expect(page.locator("[data-key='7']")).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".cabinet")).toHaveAttribute("inert", "");
  await expect(page.locator("[data-console]")).toHaveAttribute(
    "data-console",
    "open",
  );
  await expect(page.locator("[data-key='7']")).toBeFocused();
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

test("the screen words sit inside a polite status region", async ({ page }) => {
  await page.goto("/");
  const region = await page.evaluate(() => {
    const screen = document.querySelector("[data-screen]")!;
    const live = screen.closest("[aria-live]");
    return {
      live: live?.getAttribute("aria-live") ?? null,
      role: live?.getAttribute("role") ?? null,
      text: (screen.textContent ?? "").trim(),
    };
  });
  expect(region.live).toBe("polite");
  expect(region.role).toBe("status");
  expect(region.text.length).toBeGreaterThan(0);
});

test("the renderer lights the bays a guest may take, and paints them", async ({
  page,
}) => {
  await page.goto("/");
  const bays = await page.evaluate(() =>
    ["1", "2", "3"].map((bay) => {
      const light = document.querySelector<HTMLElement>(
        `[data-bay="${bay}"] [data-backlight]`,
      )!;
      const style = getComputedStyle(light);
      return {
        bay,
        lit: light.dataset.lit ?? null,
        paint: [style.backgroundImage, style.borderColor, style.boxShadow].join(
          " | ",
        ),
      };
    }),
  );
  expect(bays.map((entry) => entry.lit)).toEqual(["false", "false", "true"]);
  expect(bays[0]!.paint).toBe(bays[1]!.paint);
  expect(bays[2]!.paint).not.toBe(bays[0]!.paint);
});

test("the cabinet lamp changes with the pass, and never carries the meaning alone", async ({
  page,
}) => {
  await page.goto("/");
  const plate = page.locator("[data-cabinet-state]");
  await expect(plate).toHaveText("GUEST MODE");

  const lamps = await page.evaluate(() => {
    const node = document.querySelector<HTMLElement>("[data-cabinet-state]")!;
    const read = (): string =>
      getComputedStyle(node, "::before").backgroundColor;
    const guest = read();
    node.dataset.cabinetState = "owner";
    node.textContent = "OWNER MODE";
    return { guest, owner: read(), word: node.textContent };
  });
  expect(lamps.guest).not.toBe(lamps.owner);
  expect(lamps.word).toBe("OWNER MODE");
});

test("the tray offers nothing to press until something is delivered", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-tray]")).toHaveAttribute(
    "data-tray",
    "none",
  );
  await expect(page.locator("[data-tray-action]")).toBeHidden();
  await expect(page.locator(".tray-label")).toBeVisible();
  const reachable = await page.evaluate(() => {
    const action = document.querySelector<HTMLElement>("[data-tray-action]")!;
    action.focus();
    return document.activeElement === action;
  });
  expect(reachable).toBe(false);
});

test("a delivered cartridge gives the tray a real control", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1100, height: 620 },
    { width: 900, height: 520 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(async () => {
      document.querySelector<HTMLElement>("[data-tray]")!.dataset.tray = "3";
      const result = document.querySelector<HTMLElement>(".tray-result")!;
      await Promise.all(
        result.getAnimations().map((animation) => animation.finished),
      );
    });
    const action = page.locator("[data-tray-action]");
    await expect(action).toBeVisible();
    await expect(action).toHaveAccessibleName("TAKE DELIVERY");
    await expect(page.locator(".tray-label")).toBeHidden();
    const box = await action.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test("the tray keeps the three products apart by shape", async ({ page }) => {
  await page.goto("/");
  const widths: number[] = [];
  const silhouettes: string[] = [];
  for (const bay of ["1", "2", "3"]) {
    const shape = await page.evaluate(async (code) => {
      document.querySelector<HTMLElement>("[data-tray]")!.dataset.tray = code;
      const result = document.querySelector<HTMLElement>(".tray-result")!;
      await Promise.all(
        result.getAnimations().map((animation) => animation.finished),
      );
      const style = getComputedStyle(
        document.querySelector<HTMLElement>(".tray-item")!,
      );
      return [style.borderRadius, style.backgroundImage, style.boxShadow].join(
        " | ",
      );
    }, bay);
    silhouettes.push(shape);
    const box = await page.locator(".tray-item").boundingBox();
    widths.push(Math.round(box!.width));
  }
  expect(new Set(widths).size).toBe(3);
  expect(new Set(silhouettes).size).toBe(3);
});

test("each product leaves its bay by its own motion", async ({ page }) => {
  await page.goto("/");
  const seen = await page.evaluate(() => {
    const falling = document.querySelector<HTMLElement>("[data-falling]")!;
    const root = getComputedStyle(document.documentElement);
    const sequence = root.getPropertyValue("--kvx-t6").trim();
    const rows: { name: string; duration: string; count: string }[] = [];
    for (const bay of ["1", "2", "3"]) {
      falling.dataset.falling = bay;
      const style = getComputedStyle(falling);
      rows.push({
        name: style.animationName,
        duration: style.animationDuration,
        count: style.animationIterationCount,
      });
    }
    falling.dataset.falling = "none";
    return { rows, sequence, resting: getComputedStyle(falling).animationName };
  });
  expect(new Set(seen.rows.map((row) => row.name)).size).toBe(3);
  for (const row of seen.rows) {
    expect(seconds(row.duration)).toBe(seconds(seen.sequence));
    expect(row.count).toBe("1");
  }
  expect(seen.resting).toBe("none");
});

test("nothing on the machine animates forever", async ({ page }) => {
  await page.goto("/");
  const forever = await page.evaluate(() => {
    const machine = document.querySelector<HTMLElement>("[data-machine]")!;
    const tray = document.querySelector<HTMLElement>("[data-tray]")!;
    const falling = document.querySelector<HTMLElement>("[data-falling]")!;
    const transfer = document.querySelector<HTMLElement>("[data-transfer]")!;
    const offenders: string[] = [];
    const sweep = (): void => {
      for (const node of document.querySelectorAll("*")) {
        for (const pseudo of [null, "::before", "::after"]) {
          const style = getComputedStyle(node, pseudo);
          if (style.animationName === "none") continue;
          if (style.animationIterationCount === "1") continue;
          offenders.push(
            [
              node.tagName,
              node.className,
              pseudo ?? "",
              style.animationName,
              style.animationIterationCount,
            ].join(" "),
          );
        }
      }
    };
    machine.dataset.access = "owner";
    machine.dataset.status = "dispensing";
    tray.dataset.tray = "2";
    falling.dataset.falling = "2";
    transfer.dataset.transfer = "2";
    sweep();
    machine.dataset.status = "reading";
    sweep();
    machine.dataset.status = "denied";
    sweep();
    return offenders;
  });
  expect(forever).toEqual([]);
});

test("the pass card is off the machine until the reader is reading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const card = page.locator(".pass-card");
  await expect(card).toBeHidden();

  const reading = await page.evaluate(() => {
    const machine = document.querySelector<HTMLElement>("[data-machine]")!;
    machine.dataset.status = "reading";
    const style = getComputedStyle(
      document.querySelector<HTMLElement>(".pass-card")!,
    );
    return {
      name: style.animationName,
      duration: style.animationDuration,
      count: style.animationIterationCount,
      move: getComputedStyle(document.documentElement)
        .getPropertyValue("--kvx-t5")
        .trim(),
    };
  });
  await expect(card).toBeVisible();
  expect(reading.name).toBe("pass-card-return");
  expect(seconds(reading.duration)).toBe(seconds(reading.move));
  expect(reading.count).toBe("1");

  await page.evaluate(() => {
    document.querySelector<HTMLElement>("[data-machine]")!.dataset.status =
      "idle";
  });
  await expect(card).toBeHidden();
});

test("the bridge stays out of the way until a cartridge is taken", async ({
  page,
}) => {
  await page.goto("/");
  const cancel = page.locator("[data-transfer-cancel]");
  await expect(page.locator("[data-transfer]")).toBeHidden();
  await expect(cancel).toBeHidden();

  await page.evaluate(() => {
    document.querySelector<HTMLElement>("[data-transfer]")!.dataset.transfer =
      "3";
  });
  await expect(page.locator("[data-transfer]")).toBeVisible();
  await expect(cancel).toBeVisible();
  const box = await cancel.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  const painted = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>("[data-transfer]")!;
    const card = document.querySelector<HTMLElement>(
      ".screen-transfer__cartridge",
    )!;
    return {
      overlay: getComputedStyle(overlay).backgroundColor,
      cardFill: getComputedStyle(card).backgroundColor,
      cardRim: getComputedStyle(card).borderTopColor,
      name: overlay.getAttribute("aria-label"),
    };
  });
  expect(painted.overlay).not.toBe("rgba(0, 0, 0, 0)");
  expect(painted.cardFill).not.toBe("rgba(0, 0, 0, 0)");
  expect(painted.cardRim).not.toBe("rgba(0, 0, 0, 0)");
  expect(painted.name).toBe("Opening the selected application");
});

async function openTheBridge(
  browser: import("@playwright/test").Browser,
  reduced: boolean,
): Promise<{
  visible: string;
  slowest: number;
  opacity: string;
  hits: string;
  height: number;
}> {
  const context = await browser.newContext(
    reduced ? { reducedMotion: "reduce" } : {},
  );
  const page = await context.newPage();
  await page.goto("/");
  const seen = await page.evaluate(async () => {
    const overlay = document.querySelector<HTMLElement>("[data-transfer]")!;
    overlay.dataset.transfer = "1";
    await new Promise((settled) => {
      requestAnimationFrame(() => requestAnimationFrame(settled));
    });
    let slowest = 0;
    for (const node of [overlay, ...overlay.querySelectorAll("*")]) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(node, pseudo);
        if (style.animationName === "none") continue;
        const delays = style.animationDelay.split(",");
        const durations = style.animationDuration.split(",");
        for (const [index, delay] of delays.entries()) {
          const ends =
            (Number.parseFloat(delay) +
              Number.parseFloat(
                durations[index % durations.length] ?? durations[0] ?? "0",
              )) *
            1000;
          if (ends > slowest) slowest = ends;
        }
      }
    }
    const cancel = document.querySelector<HTMLElement>(
      "[data-transfer-cancel]",
    )!;
    const style = getComputedStyle(cancel);
    return {
      visible: getComputedStyle(overlay).visibility,
      slowest,
      opacity: style.opacity,
      hits: style.pointerEvents,
      height: cancel.getBoundingClientRect().height,
    };
  });
  await context.close();
  return seen;
}

test("reduced motion shortens the bridge, it does not skip it", async ({
  browser,
}) => {
  const full = await openTheBridge(browser, false);
  const reduced = await openTheBridge(browser, true);

  expect(full.visible).toBe("visible");
  expect(reduced.visible).toBe("visible");

  expect(full.slowest).toBeGreaterThan(600);
  expect(reduced.slowest).toBeLessThanOrEqual(40);

  expect(reduced.opacity).toBe("1");
  expect(reduced.hits).toBe("auto");
  expect(reduced.height).toBeGreaterThanOrEqual(44);
});

test("a full tray stays inside the cabinet it is bolted to", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 900, height: 520 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const fit = await page.evaluate(async () => {
      document.querySelector<HTMLElement>("[data-tray]")!.dataset.tray = "3";
      const result = document.querySelector<HTMLElement>(".tray-result")!;
      await Promise.all(
        result.getAnimations().map((animation) => animation.finished),
      );
      const tray = document
        .querySelector<HTMLElement>("[data-tray]")!
        .getBoundingClientRect();
      const action = document
        .querySelector<HTMLElement>("[data-tray-action]")!
        .getBoundingClientRect();
      const cabinet = document
        .querySelector<HTMLElement>(".cabinet")!
        .getBoundingClientRect();
      return {
        overhangRight: tray.right - cabinet.right,
        overhangLeft: cabinet.left - tray.left,
        actionRight: action.right - cabinet.right,
        actionLeft: cabinet.left - action.left,
      };
    });
    expect(fit.overhangRight).toBeLessThanOrEqual(0);
    expect(fit.overhangLeft).toBeLessThanOrEqual(0);
    expect(fit.actionRight).toBeLessThanOrEqual(0);
    expect(fit.actionLeft).toBeLessThanOrEqual(0);
  }
});

test("every route the machine offers is reachable from here", async ({
  page,
}) => {
  await page.goto("/");
  const links = await page.evaluate(() => {
    const hrefs = [
      ...document.querySelectorAll<HTMLElement>("[data-href]"),
    ].map((node) => node.dataset.href ?? "");
    const footer = [
      ...document.querySelectorAll<HTMLAnchorElement>(".ftr-links a"),
    ].map((node) => node.getAttribute("href") ?? "");
    return { hrefs, footer, host: location.hostname };
  });

  expect(links.hrefs).toHaveLength(3);
  for (const href of [...links.hrefs, ...links.footer]) {
    if (!href.includes("://")) continue;
    const url = new URL(href);
    expect(url.hostname).toBe(links.host);
    expect(url.protocol).toBe("http:");
  }

  expect(links.hrefs).toEqual([
    localWorkerOrigin("link", links.host),
    localWorkerOrigin("pulse", links.host),
    localViteOrigin("portfolio", links.host),
  ]);
});

test("the returning pass card never widens the page", async ({ page }) => {
  for (const width of [761, 800, 900, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const measured = await page.evaluate(() => {
      document.querySelector<HTMLElement>("[data-machine]")!.dataset.status =
        "reading";
      return document.documentElement.scrollWidth;
    });
    expect(measured).toBe(width);
  }
});

test("the cabinet still wears its cap and its side rails", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const protrusions = await page.evaluate(() => {
    const machine = document
      .querySelector<HTMLElement>("[data-machine]")!
      .getBoundingClientRect();
    const cap = getComputedStyle(
      document.querySelector<HTMLElement>("[data-machine]")!,
      "::after",
    );
    const cabinet = document.querySelector<HTMLElement>(".cabinet")!;
    const rail = getComputedStyle(cabinet, "::before");
    return {
      capTop: cap.top,
      railLeft: rail.left,
      clipMargin: getComputedStyle(
        document.querySelector<HTMLElement>("[data-machine]")!,
      ).overflowClipMargin,
      machineWidth: Math.round(machine.width),
    };
  });
  expect(protrusions.capTop).toBe("-7px");
  expect(protrusions.railLeft).toBe("-7px");
  expect(Number.parseFloat(protrusions.clipMargin)).toBeGreaterThan(7);
});
