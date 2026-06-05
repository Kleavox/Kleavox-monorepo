import { describe, expect, it } from "vitest";
import app from "./app";
import type { Env } from "./env";

const baseEnv = {
  ENVIRONMENT: "production",
  PUBLIC_ORIGIN: "https://pass.zarkiv.com",
  ROOT_DOMAIN: "zarkiv.com",
  FROM_EMAIL: "Zarkiv <no-reply@zarkiv.com>",
  ASSETS: {
    fetch: () => Promise.resolve(new Response("asset")),
  },
  SESSIONS: {
    get: () => Promise.resolve(null),
  },
} as unknown as Env;

describe("Pass HTTP boundary", () => {
  it("rejects state-changing requests from another origin", async () => {
    const response = await app.request(
      "https://pass.zarkiv.com/api/login",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
        },
        body: JSON.stringify({
          email: "person@example.com",
          password: "not-important",
        }),
      },
      baseEnv,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_origin" },
    });
  });

  it("requires JSON for state-changing APIs", async () => {
    const response = await app.request(
      "https://pass.zarkiv.com/api/logout",
      {
        method: "POST",
        headers: { origin: "https://pass.zarkiv.com" },
      },
      baseEnv,
    );

    expect(response.status).toBe(415);
  });

  it("does not expose the internal session endpoint publicly", async () => {
    const response = await app.request(
      "https://pass.zarkiv.com/internal/session",
      {},
      baseEnv,
    );

    expect(response.status).toBe(404);
  });

  it("allows Service Binding shaped requests to reach session validation", async () => {
    const response = await app.request(
      "http://pass.internal/internal/session",
      {},
      baseEnv,
    );

    expect(response.status).toBe(401);
  });
});
