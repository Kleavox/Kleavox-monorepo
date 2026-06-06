import { describe, expect, it } from "vitest";
import app from "./app";
import type { Env } from "./env";

const baseEnv = {
  ENVIRONMENT: "production",
  PUBLIC_ORIGIN: "https://pass.product.test",
  ROOT_DOMAIN: "product.test",
  FROM_EMAIL: "Product <no-reply@product.test>",
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
      "https://pass.product.test/api/login",
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
      "https://pass.product.test/api/logout",
      {
        method: "POST",
        headers: { origin: "https://pass.product.test" },
      },
      baseEnv,
    );

    expect(response.status).toBe(415);
  });

  it("does not expose the internal session endpoint publicly", async () => {
    const response = await app.request(
      "https://pass.product.test/internal/session",
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

  it("reports configured OAuth providers without exposing credentials", async () => {
    const response = await app.request(
      "https://pass.product.test/api/oauth/providers",
      {},
      {
        ...baseEnv,
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      google: true,
      github: false,
    });
  });
});
