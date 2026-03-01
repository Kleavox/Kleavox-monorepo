// lib/session.ts
// Redis-backed session management.
// All functions are no-ops when Redis is not available (dev / REDIS_URL not set).

import { redis } from "@/lib/redis";

const SESSION_PREFIX = "session:";

/**
 * Store a session JTI in Redis.
 * Call this right after a successful login.
 */
export async function storeSession(jti: string, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${SESSION_PREFIX}${jti}`, "1", "EX", ttlSeconds);
  } catch (err) {
    console.error("[Session] storeSession error:", (err as Error).message);
  }
}

/**
 * Check if a session JTI is still valid in Redis.
 * Returns true if Redis is unavailable (fail-open for availability).
 */
export async function validateSession(jti: string): Promise<boolean> {
  if (!redis) return true; // No Redis → skip check, accept JWT as valid
  try {
    const exists = await redis.exists(`${SESSION_PREFIX}${jti}`);
    return exists === 1;
  } catch (err) {
    console.error("[Session] validateSession error:", (err as Error).message);
    return true; // Fail-open: Redis down → allow request
  }
}

/**
 * Delete a session JTI from Redis.
 * Call this on logout.
 */
export async function deleteSession(jti: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`${SESSION_PREFIX}${jti}`);
  } catch (err) {
    console.error("[Session] deleteSession error:", (err as Error).message);
  }
}
