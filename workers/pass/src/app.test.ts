import { describe, expect, it, vi } from "vitest";
import app from "./app";
import type { Env } from "./env";
import { hashToken } from "./lib/crypto";

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

function kvStore() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => void store.set(key, value),
    delete: async (key: string) => void store.delete(key),
  };
}

function otpStartInit(email: string): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://pass.product.test",
    },
    body: JSON.stringify({ email }),
  };
}

describe("Pass HTTP boundary", () => {
  it("requires the zero-knowledge account key table before reporting ready", async () => {
    const first = vi.fn(async () => ({ total: 5 }));
    const prepare = vi.fn((_sql: string) => ({ first }));
    const response = await app.request("https://pass.product.test/ready", {}, {
      ...baseEnv,
      DB: { prepare },
    } as unknown as Env);

    expect(response.status).toBe(200);
    expect(prepare.mock.calls[0]?.[0]).toContain("account_keys");
  });

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
      code: "invalid_origin",
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

describe("POST /api/auth/otp/start", () => {
  it("answers a known email and an unknown email byte-identically", async () => {
    const prepare = vi.fn((_sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () =>
          args[0] === "known@example.com" ? { id: "user-1" } : null,
      }),
    }));
    const env = {
      ...baseEnv,
      ENVIRONMENT: "development",
      SESSIONS: kvStore(),
      DB: { prepare },
    } as unknown as Env;

    const knownResponse = await app.request(
      "https://pass.product.test/api/auth/otp/start",
      otpStartInit("known@example.com"),
      env,
    );
    const knownText = await knownResponse.text();

    const unknownResponse = await app.request(
      "https://pass.product.test/api/auth/otp/start",
      otpStartInit("unknown@example.com"),
      env,
    );
    const unknownText = await unknownResponse.text();

    expect(unknownResponse.status).toBe(knownResponse.status);
    expect(unknownText).toBe(knownText);
  });

  it("never touches the database", async () => {
    const prepare = vi.fn();
    const env = {
      ...baseEnv,
      ENVIRONMENT: "development",
      SESSIONS: kvStore(),
      DB: { prepare },
    } as unknown as Env;

    const response = await app.request(
      "https://pass.product.test/api/auth/otp/start",
      otpStartInit("someone@example.com"),
      env,
    );

    expect(response.status).toBe(200);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("tells a rate-limited caller how long to wait instead of dropping the request", async () => {
    const store = new Map<string, string>();
    const email = "rate-limited@example.com";
    const windowSeconds = 900;
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rate:otp-email:${await hashToken(email)}:${bucket}`;
    store.set(key, "5");
    const env = {
      ...baseEnv,
      ENVIRONMENT: "development",
      SESSIONS: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => void store.set(k, v),
        delete: async (k: string) => void store.delete(k),
      },
    } as unknown as Env;

    const response = await app.request(
      "https://pass.product.test/api/auth/otp/start",
      otpStartInit(email),
      env,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      code: "rate_limited",
    });
  });

  it("keeps the uniform answer when the email fails to send, and logs the failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = {
      ...baseEnv,
      ENVIRONMENT: "production",
      RESEND_API_KEY: undefined,
      SESSIONS: kvStore(),
    } as unknown as Env;

    const response = await app.request(
      "https://pass.product.test/api/auth/otp/start",
      otpStartInit("someone@example.com"),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalledWith(
      "[pass otp email]",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it("rejects an untrusted origin", async () => {
    const response = await app.request(
      "https://pass.product.test/api/auth/otp/start",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
        },
        body: JSON.stringify({ email: "someone@example.com" }),
      },
      { ...baseEnv, SESSIONS: kvStore() } as unknown as Env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_origin",
    });
  });

  it("rejects a non-JSON content type", async () => {
    const response = await app.request(
      "https://pass.product.test/api/auth/otp/start",
      {
        method: "POST",
        headers: { origin: "https://pass.product.test" },
        body: JSON.stringify({ email: "someone@example.com" }),
      },
      { ...baseEnv, SESSIONS: kvStore() } as unknown as Env,
    );

    expect(response.status).toBe(415);
  });
});
