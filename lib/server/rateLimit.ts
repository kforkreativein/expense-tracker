/**
 * Small fixed-window limiter that keeps one runaway client (or a stuck retry
 * loop) from burning through the Groq quota.
 *
 * Counters live in the function instance's memory, so a scaled-out deployment
 * allows up to `limit` requests per instance rather than globally. That is a
 * deliberate trade-off: the route already requires a verified login, so this is
 * a spend guard rather than the security boundary.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Stop the map from growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets */
  retryAfter: number;
  remaining: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0, remaining: limit - existing.count };
}
