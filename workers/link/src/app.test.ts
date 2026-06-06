import { describe, expect, it, vi } from "vitest";

import { app } from "./app";
import type { Env } from "./env";

describe("Link public session boundary", () => {
  it("returns an anonymous session without denying the application", async () => {
    const passFetch = vi.fn();
    const response = await app.request(
      "https://link.zarkiv.com/api/session",
      {},
      {
        PASS: { fetch: passFetch },
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(passFetch).not.toHaveBeenCalled();
  });
});
