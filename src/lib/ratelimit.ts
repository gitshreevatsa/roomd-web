import { createHash } from "crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Fixed-window rate limit (per bucket).
 * Default window is 60s; pass `windowSeconds` for hourly caps (e.g. invites).
 * Fails open if Redis is unreachable so auth stays available.
 */
export async function checkWebRateLimit(
  bucket: string,
  limit: number,
  windowSeconds = 60,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const windowMs = Math.max(1, windowSeconds) * 1000;
    const window = Math.floor(Date.now() / windowMs);
    const key = `app:ratelimit:${bucket}:${windowSeconds}:${window}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, Math.max(windowSeconds * 2, 120));
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

/** Stable bucket id from IP (or other identifier) without storing the raw value long-term. */
export function rateLimitBucket(prefix: string, raw: string): string {
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `${prefix}:${digest}`;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
