import { readCookie, SESSION_COOKIE } from "@kleavox/auth";
import type { Identity, SessionIdentity } from "@kleavox/core";
import type { Env } from "../env";
import { SESSION_TTL_SECONDS } from "./cookies";
import { hashToken, randomToken } from "./crypto";

interface StoredSession {
  identity: Identity;
  authVersion: number;
  createdAt: string;
  expiresAt: string;
}

export interface CreatedSession {
  token: string;
  session: SessionIdentity;
}

export async function createSession(
  env: Env,
  identity: Identity,
  authVersion: number,
): Promise<CreatedSession> {
  const token = randomToken();
  const sessionId = await hashToken(token);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_SECONDS * 1000,
  ).toISOString();
  const stored: StoredSession = {
    identity,
    authVersion,
    createdAt,
    expiresAt,
  };

  await Promise.all([
    env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(stored), {
      expirationTtl: SESSION_TTL_SECONDS,
    }),
    env.SESSIONS.put(`auth-version:${identity.id}`, authVersion.toString()),
  ]);

  return {
    token,
    session: { identity, sessionId, expiresAt },
  };
}

export async function getSession(
  env: Env,
  token: string,
): Promise<SessionIdentity | null> {
  const sessionId = await hashToken(token);
  const stored = await env.SESSIONS.get<StoredSession>(
    `session:${sessionId}`,
    "json",
  );

  if (!stored || Date.parse(stored.expiresAt) <= Date.now()) {
    if (stored) await env.SESSIONS.delete(`session:${sessionId}`);
    return null;
  }

  const [currentVersion, override] = await Promise.all([
    env.SESSIONS.get(`auth-version:${stored.identity.id}`),
    env.SESSIONS.get<Identity>(`identity:${stored.identity.id}`, "json"),
  ]);
  if (
    currentVersion !== null &&
    Number(currentVersion) !== stored.authVersion
  ) {
    await env.SESSIONS.delete(`session:${sessionId}`);
    return null;
  }

  return {
    identity: override ?? stored.identity,
    sessionId,
    expiresAt: stored.expiresAt,
  };
}

export async function putIdentityOverride(
  env: Env,
  identity: Identity,
): Promise<void> {
  await env.SESSIONS.put(`identity:${identity.id}`, JSON.stringify(identity), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.SESSIONS.delete(`session:${await hashToken(token)}`);
}

export async function invalidateUserSessions(
  env: Env,
  userId: string,
  authVersion: number,
): Promise<void> {
  await env.SESSIONS.put(`auth-version:${userId}`, authVersion.toString());
}

export function readSessionToken(request: Request): string | null {
  return readCookie(request, SESSION_COOKIE);
}
