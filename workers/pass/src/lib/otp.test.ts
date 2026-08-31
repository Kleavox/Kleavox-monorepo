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
    expect(await verifyOtp(env, "a@example.com", code)).toBe("ok");
  });

  it("ignores case and padding in the email", async () => {
    const { env } = fakeEnv();
    const code = await issueOtp(env, "a@example.com");
    expect(await verifyOtp(env, "  A@Example.com ", code)).toBe("ok");
  });

  it("rejects a wrong code and consumes an attempt", async () => {
    const { env } = fakeEnv();
    await issueOtp(env, "a@example.com");
    expect(await verifyOtp(env, "a@example.com", "000000")).toBe("wrong");
  });

  it("stops after five wrong attempts", async () => {
    const { env } = fakeEnv();
    await issueOtp(env, "a@example.com");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await verifyOtp(env, "a@example.com", "000000")).toBe("wrong");
    }
    expect(await verifyOtp(env, "a@example.com", "000000")).toBe("exhausted");
  });

  it("reports expired when no code was issued", async () => {
    const { env } = fakeEnv();
    expect(await verifyOtp(env, "a@example.com", "123456")).toBe("expired");
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
    expect(await verifyOtp(env, "a@example.com", code)).toBe("expired");
  });
});
