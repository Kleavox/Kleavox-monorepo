// lib/loginRateLimit.ts

import { redis } from "@/lib/redis";

// ─── In-memory fallback ───────────────────────────────────────────────────────

type LoginAttemptRecord = {
  count: number;
  expiresAt: number;
};

const globalForLogin = global as unknown as {
  loginMap: Map<string, LoginAttemptRecord>;
};
const loginMap =
  globalForLogin.loginMap || new Map<string, LoginAttemptRecord>();
if (process.env.NODE_ENV !== "production") globalForLogin.loginMap = loginMap;

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_S = 15 * 60;          // 15 minutes in seconds (for Redis TTL)
const MAX_ATTEMPTS = 5;

function isBlockedInMemory(identifier: string) {
  const key = `login:${identifier}`;
  const now = Date.now();
  const record = loginMap.get(key);

  if (record && now < record.expiresAt && record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.expiresAt - now) / 1000);
    return { blocked: true as const, retryAfter };
  }
  return { blocked: false as const };
}

function registerFailedInMemory(identifier: string) {
  const key = `login:${identifier}`;
  const now = Date.now();
  const record = loginMap.get(key);

  if (!record || now > record.expiresAt) {
    loginMap.set(key, { count: 1, expiresAt: now + WINDOW_MS });
  } else {
    record.count += 1;
  }
}

// ─── Redis implementation ─────────────────────────────────────────────────────

async function isBlockedRedis(identifier: string) {
  const key = `ll:${identifier}`;
  try {
    const countStr = await redis!.get(key);
    if (!countStr) return { blocked: false as const };

    const count = parseInt(countStr, 10);
    if (count >= MAX_ATTEMPTS) {
      const ttl = await redis!.ttl(key);
      return { blocked: true as const, retryAfter: Math.max(ttl, 1) };
    }
    return { blocked: false as const };
  } catch (err) {
    console.error("[LoginRateLimit] Redis error:", (err as Error).message);
    return isBlockedInMemory(identifier); // fallback
  }
}

async function registerFailedRedis(identifier: string) {
  const key = `ll:${identifier}`;
  try {
    const count = await redis!.incr(key);
    if (count === 1) {
      await redis!.expire(key, WINDOW_S);
    }
  } catch (err) {
    console.error("[LoginRateLimit] Redis error:", (err as Error).message);
    registerFailedInMemory(identifier); // fallback
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function isLoginBlocked(identifier: string) {
  if (redis) return isBlockedRedis(identifier);
  return isBlockedInMemory(identifier);
}

export async function registerFailedLogin(identifier: string) {
  if (redis) return registerFailedRedis(identifier);
  return registerFailedInMemory(identifier);
}
