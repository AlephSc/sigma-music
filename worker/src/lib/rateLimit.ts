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

async function readRecentTimestamps(
  env: Env,
  key: string,
  cutoff: number
): Promise<number[]> {
  if (env.RATE_LIMIT_KV) {
    const raw = await env.RATE_LIMIT_KV.get(key);
    if (!raw) return [];
    try {
      const existing = JSON.parse(raw) as number[];
      return Array.isArray(existing) ? existing.filter((ts) => ts > cutoff) : [];
    } catch {
      return [];
    }
  }

  const bucket = memoryBuckets.get(key);
  if (!bucket) return [];
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
  return [...bucket.timestamps];
}

async function writeTimestamps(
  env: Env,
  key: string,
  timestamps: number[],
  windowSeconds: number
): Promise<void> {
  if (env.RATE_LIMIT_KV) {
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(timestamps), {
      expirationTtl: Math.max(60, windowSeconds + 10),
    });
    return;
  }

  memoryBuckets.set(key, { timestamps });
}

/**
 * Checks whether a sliding-window limit is currently exceeded WITHOUT incrementing.
 */
export async function peekRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;
  const recent = await readRecentTimestamps(env, key, cutoff);

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, oldest + windowSeconds - now),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Records a single hit into a sliding-window bucket (e.g. failed login attempt).
 */
export async function recordRateLimitHit(
  env: Env,
  key: string,
  windowSeconds: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;
  const recent = await readRecentTimestamps(env, key, cutoff);
  recent.push(now);
  await writeTimestamps(env, key, recent, windowSeconds);
}

/**
 * Clears a sliding-window bucket (e.g. after a successful login).
 */
export async function resetRateLimit(env: Env, key: string): Promise<void> {
  memoryBuckets.delete(key);
  if (env.RATE_LIMIT_KV) {
    await env.RATE_LIMIT_KV.delete(key);
  }
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
  const recent = await readRecentTimestamps(env, key, cutoff);

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, oldest + windowSeconds - now),
    };
  }

  recent.push(now);
  await writeTimestamps(env, key, recent, windowSeconds);

  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length),
    retryAfterSeconds: 0,
  };
}
