// lib/rateLimit.ts

import { redis } from "@/lib/redis";

// ─── In-memory fallback (used in dev or when Redis is unavailable) ────────────

type RateLimitRecord = {
  count: number;
  expiresAt: number;
};

const globalStore = global as unknown as {
  rateLimitMap: Map<string, RateLimitRecord>;
  cleanupInterval?: NodeJS.Timeout;
};

const rateLimitMap =
  globalStore.rateLimitMap || new Map<string, RateLimitRecord>();
if (process.env.NODE_ENV !== "production") globalStore.rateLimitMap = rateLimitMap;

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_WINDOW_S = 60 * 60;          // 1 hour in seconds (for Redis TTL)
const DEFAULT_LIMIT = 10;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

if (!globalStore.cleanupInterval) {
  globalStore.cleanupInterval = setInterval(() => {
    const now = Date.now();
    let deleted = 0;
    rateLimitMap.forEach((value, key) => {
      if (now > value.expiresAt) {
        rateLimitMap.delete(key);
        deleted++;
      }
    });
    if (deleted > 0 && process.env.NODE_ENV === "development") {
      console.log(`[RateLimit] GC: cleared ${deleted} expired records`);
    }
  }, CLEANUP_INTERVAL_MS);

  if (globalStore.cleanupInterval.unref) globalStore.cleanupInterval.unref();
}

function checkInMemory(key: string) {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.expiresAt) {
    rateLimitMap.set(key, { count: 1, expiresAt: now + DEFAULT_WINDOW_MS });
    return { ok: true as const };
  }

  if (record.count >= DEFAULT_LIMIT) {
    const retryAfter = Math.ceil((record.expiresAt - now) / 1000);
    return { ok: false as const, retryAfter };
  }

  record.count += 1;
  return { ok: true as const };
}

// ─── Redis implementation ─────────────────────────────────────────────────────

async function checkRedis(key: string) {
  const redisKey = `rl:${key}`;
  try {
    const count = await redis!.incr(redisKey);
    if (count === 1) {
      // First request in this window — set TTL
      await redis!.expire(redisKey, DEFAULT_WINDOW_S);
    }
    if (count > DEFAULT_LIMIT) {
      const ttl = await redis!.ttl(redisKey);
      return { ok: false as const, retryAfter: Math.max(ttl, 1) };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("[RateLimit] Redis error, falling back to in-memory:", (err as Error).message);
    return checkInMemory(key);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(identifier: string, type: string = "general") {
  const key = `${type}:${identifier}`;
  if (redis) return checkRedis(key);
  return checkInMemory(key);
}
