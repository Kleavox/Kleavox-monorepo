// lib/redis.ts

import Redis from "ioredis";

const globalForRedis = global as unknown as { redis: Redis | null };

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  if (globalForRedis.redis) {
    redis = globalForRedis.redis;
  } else {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: false,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("[Redis] Could not connect after 3 retries, giving up.");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      enableOfflineQueue: false,
    });

    redis.on("error", (err: Error) => {
      console.error("[Redis] Error:", err.message);
    });

    redis.on("connect", () => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[Redis] Connected to", process.env.REDIS_URL);
      }
    });

    // Preserve singleton across hot reloads in dev
    if (process.env.NODE_ENV !== "production") {
      globalForRedis.redis = redis;
    }
  }
}

export { redis };
export default redis;
