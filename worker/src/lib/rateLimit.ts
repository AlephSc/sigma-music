import type { Env } from '../types';

interface MemoryBucket {
  timestamps: number[];
}

const memoryBuckets = new Map<string, MemoryBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter using Cloudflare KV when available,
 * falling back to isolate memory for local dev/testing.
 */
export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;

  if (env.RATE_LIMIT_KV) {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const existing: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const recent = existing.filter((ts) => ts > cutoff);

    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, oldest + windowSeconds - now),
      };
    }

    recent.push(now);
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(recent), {
      expirationTtl: Math.max(60, windowSeconds + 10),
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - recent.length),
      retryAfterSeconds: 0,
    };
  }

  const bucket = memoryBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, oldest + windowSeconds - now),
    };
  }

  bucket.timestamps.push(now);
  memoryBuckets.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}
