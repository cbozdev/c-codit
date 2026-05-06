import Redis from "ioredis";
import { NextRequest, NextResponse } from "next/server";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    _redis.on("error", () => {});
  }
  return _redis;
}
const redis = { pipeline: () => getRedis().pipeline() };

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${config.keyPrefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, "-inf", windowStart);
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    pipe.zcard(key);
    pipe.expire(key, config.windowSeconds);
    const results = await pipe.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;
    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = now + config.windowSeconds;

    return {
      success: count <= config.maxRequests,
      limit: config.maxRequests,
      remaining,
      resetAt,
    };
  } catch {
    // If Redis is unavailable, fail open
    return { success: true, limit: config.maxRequests, remaining: config.maxRequests, resetAt: 0 };
  }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}

export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Pre-configured limiters for common routes
export const RATE_LIMITS = {
  auth: { windowSeconds: 900, maxRequests: 10, keyPrefix: "auth" },        // 10 per 15min
  checkout: { windowSeconds: 3600, maxRequests: 20, keyPrefix: "checkout" }, // 20 per hour
  api: { windowSeconds: 60, maxRequests: 60, keyPrefix: "api" },            // 60 per min
  contact: { windowSeconds: 3600, maxRequests: 5, keyPrefix: "contact" },   // 5 per hour
} as const;

export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const ip = getClientIP(request);
  const result = await checkRateLimit(ip, config);

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(result),
          "Retry-After": String(result.resetAt - Math.floor(Date.now() / 1000)),
        },
      }
    );
  }

  const response = await handler();

  // Attach rate limit headers to successful responses
  Object.entries(rateLimitHeaders(result)).forEach(([k, v]) => {
    response.headers.set(k, v);
  });

  return response;
}
