import { describe, expect, it } from "vitest";
import { issueOtp, verifyOtp } from "./otp";

import type { Env } from "../env";

function fakeEnv(): { env: Env; store: Map<string, string> } {
  const store = new Map<string, string>();
  const env = {
    SESSIONS: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => void store.set(key, value),
      delete: async (key: string) => void store.delete(key),
    },
  } as unknown as Env;
  return { env, store };
}

describe("otp", () => {
  it("issues a six digit code", async () => {
    const { env } = fakeEnv();
    expect(await issueOtp(env, "a@example.com")).toMatch(/^\d{6}$/);
  });

  it("accepts the code it issued", async () => {
    const { env } = fakeEnv();
    const code = await issueOtp(env, "a@example.com");
    expect(await verifyOtp(env, "a@example.com", code)).toEqual({
      status: "ok",
    });
  });

  it("ignores case and padding in the email", async () => {
    const { env } = fakeEnv();
    const code = await issueOtp(env, "a@example.com");
    expect(await verifyOtp(env, "  A@Example.com ", code)).toEqual({
      status: "ok",
    });
  });

  it("rejects a wrong code, consumes an attempt, and reports the four left", async () => {
    const { env } = fakeEnv();
    await issueOtp(env, "a@example.com");
    expect(await verifyOtp(env, "a@example.com", "000000")).toEqual({
      status: "wrong",
      attemptsLeft: 4,
    });
  });

  it("stops after five wrong attempts, counting the real number down each time", async () => {
    const { env } = fakeEnv();
    await issueOtp(env, "a@example.com");
    for (const attemptsLeft of [4, 3, 2, 1]) {
      expect(await verifyOtp(env, "a@example.com", "000000")).toEqual({
        status: "wrong",
        attemptsLeft,
      });
    }
    expect(await verifyOtp(env, "a@example.com", "000000")).toEqual({
      status: "exhausted",
    });
  });

  it("reports expired when no code was issued", async () => {
    const { env } = fakeEnv();
    expect(await verifyOtp(env, "a@example.com", "123456")).toEqual({
      status: "expired",
    });
  });

  it("never invents an attempt count for an expired or exhausted result", async () => {
    const { env } = fakeEnv();
    const expired = await verifyOtp(env, "a@example.com", "123456");
    expect(expired).not.toHaveProperty("attemptsLeft");

    await issueOtp(env, "b@example.com");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await verifyOtp(env, "b@example.com", "000000");
    }
    const exhausted = await verifyOtp(env, "b@example.com", "000000");
    expect(exhausted).toEqual({ status: "exhausted" });
  });

  it("does not store the code in readable form", async () => {
    const { env, store } = fakeEnv();
    const code = await issueOtp(env, "a@example.com");
    expect(JSON.stringify([...store.values()])).not.toContain(code);
  });

  it("does not store the email in readable form", async () => {
    const { env, store } = fakeEnv();
    await issueOtp(env, "a@example.com");
    expect(JSON.stringify([...store.keys()])).not.toContain("a@example.com");
  });

  it("burns the code once it is accepted", async () => {
    const { env } = fakeEnv();
    const code = await issueOtp(env, "a@example.com");
    await verifyOtp(env, "a@example.com", code);
    expect(await verifyOtp(env, "a@example.com", code)).toEqual({
      status: "expired",
    });
  });
});
