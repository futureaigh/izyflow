import Redis from "ioredis";

let redis: Redis | null = null;

try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("[Redis] connection error:", err.message);
    });

    redis.on("ready", () => {
      console.log("[Redis] connected");
    });

    // Connect in background — don't block server start
    redis.connect().catch((err) => {
      console.warn("[Redis] connect failed, running without cache:", err.message);
      redis = null;
    });
  } else {
    console.log("[Redis] REDIS_URL not set — running without cache");
  }
} catch (err) {
  console.warn("[Redis] init error — running without cache:", (err as Error).message);
  redis = null;
}

export async function withCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  if (!redis) return fetchFn();

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    return fetchFn();
  }

  const data = await fetchFn();

  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch {
    // cache write failure is non-fatal
  }

  return data;
}

export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    let cursor = "0";
    do {
      const result = await redis.scan(cursor, "MATCH", pattern, "COUNT", 50);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // invalidation failure is non-fatal
  }
}

export function buildCacheKey(...parts: string[]): string {
  return `izi:${parts.join(":")}`;
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; ttl: number }> {
  if (!redis) {
    return { allowed: true, remaining: maxRequests, ttl: 0 };
  }

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    const ttl = await redis.ttl(key);
    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      ttl: ttl > 0 ? ttl : 0,
    };
  } catch {
    return { allowed: true, remaining: maxRequests, ttl: 0 };
  }
}
