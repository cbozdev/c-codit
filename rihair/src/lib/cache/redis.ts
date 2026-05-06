import Redis from "ioredis";
import { logger } from "@/lib/logger";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableAutoPipelining: true,
    });

    redis.on("error", (err) => {
      logger.error("Redis connection error", err);
    });
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await getRedis().get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  try {
    await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn("Cache set failed", { key, error: String(err) });
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch (err) {
    logger.warn("Cache delete failed", { key, error: String(err) });
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const keys = await getRedis().keys(pattern);
    if (keys.length > 0) {
      await getRedis().del(...keys);
    }
  } catch (err) {
    logger.warn("Cache pattern delete failed", { pattern, error: String(err) });
  }
}

export const CACHE_KEYS = {
  products: (filters: string) => `products:list:${filters}`,
  product: (slug: string) => `product:${slug}`,
  categories: () => `categories:all`,
  currencyRates: () => `currency:rates`,
  shippingRates: (country: string) => `shipping:rates:${country}`,
  cartCount: (userId: string) => `cart:count:${userId}`,
} as const;

export const CACHE_TTL = {
  products: 300,
  product: 600,
  categories: 3600,
  currencyRates: 3600,
  shippingRates: 1800,
  cart: 60,
} as const;
