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

describe("Link report rate limit", () => {
  it("rejects reports over the limit before any Pass round-trip", async () => {
    const pass = createMockFetcher();
    const response = await app.request(
      "https://link.product.test/api/reports",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
        },
        body: JSON.stringify({ slug: "abcd", reason: "SPAM" }),
      },
      {
        PASS: pass,
        REPORT_RATE_LIMIT: { limit: async () => ({ success: false }) },
      } as unknown as Env,
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(pass.fetch).not.toHaveBeenCalled();
  });
});
