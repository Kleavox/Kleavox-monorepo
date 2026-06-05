import type { Identity } from "@zarkiv/core";
import { describe, expect, it } from "vitest";
import type { Env } from "../env";
import {
  createSession,
  deleteSession,
  getSession,
  invalidateUserSessions,
} from "./session";

class MemoryKv {
  readonly values = new Map<string, string>();

  async get(
    key: string,
    type?: "text" | "json",
  ): Promise<string | unknown | null> {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const identity: Identity = {
  id: "user-1",
  email: "person@example.com",
  name: "Person",
  role: "USER",
};

describe("sessions", () => {
  it("stores only a hash of the opaque browser token", async () => {
    const kv = new MemoryKv();
    const env = { SESSIONS: kv as unknown as KVNamespace } as Env;
    const created = await createSession(env, identity, 1);

    expect([...kv.values.keys()]).not.toContain(`session:${created.token}`);
    await expect(getSession(env, created.token)).resolves.toMatchObject({
      identity,
    });
  });

  it("invalidates every old session when auth version changes", async () => {
    const kv = new MemoryKv();
    const env = { SESSIONS: kv as unknown as KVNamespace } as Env;
    const created = await createSession(env, identity, 1);

    await invalidateUserSessions(env, identity.id, 2);
    await expect(getSession(env, created.token)).resolves.toBeNull();
  });

  it("deletes an individual session", async () => {
    const kv = new MemoryKv();
    const env = { SESSIONS: kv as unknown as KVNamespace } as Env;
    const created = await createSession(env, identity, 1);

    await deleteSession(env, created.token);
    await expect(getSession(env, created.token)).resolves.toBeNull();
  });
});
