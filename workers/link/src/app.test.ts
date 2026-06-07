import { describe, expect, it } from "vitest";
import { createMockFetcher } from "@kleavox/testing";

import { app } from "./app";
import type { Env } from "./env";

describe("Link public session boundary", () => {
  it("returns an anonymous session without denying the application", async () => {
    const pass = createMockFetcher();
    const response = await app.request(
      "https://link.product.test/api/session",
      {},
      {
        PASS: pass,
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(pass.fetch).not.toHaveBeenCalled();
  });
});
