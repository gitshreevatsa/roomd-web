import { createHash } from "crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Fixed-window rate limit (per key, per minute).
 * Fails open if Redis is unreachable so auth stays available.
 */
export async function checkWebRateLimit(
  bucket: string,
  limitPerMinute: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const window = Math.floor(Date.now() / 60_000);
    const key = `app:ratelimit:${bucket}:${window}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 120);
    const remaining = Math.max(0, limitPerMinute - count);
    return { allowed: count <= limitPerMinute, remaining };
  } catch {
    return { allowed: true, remaining: limitPerMinute };
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
