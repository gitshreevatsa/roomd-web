import { randomBytes } from "crypto";
import { Redis } from "@upstash/redis";

/**
 * Single-use redeem tokens for invite secrets.
 * Invite emails now include the API key directly; redeem links remain for
 * one-time reveal flows that still mint a token.
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TTL_SECONDS = 60 * 60;

export interface RedeemPayload {
  secret: string;
  teamId: string;
  email: string;
  expiresAt: string;
}

function redeemKey(token: string): string {
  return `app:redeem:${token}`;
}

export function siteBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://app.roomd.sh";
}

/** Mint a one-hour, single-use redeem token that reveals `secret` once. */
export async function createRedeemToken(args: {
  secret: string;
  teamId: string;
  email: string;
}): Promise<{ token: string; redeemUrl: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  const payload: RedeemPayload = {
    secret: args.secret,
    teamId: args.teamId,
    email: args.email.toLowerCase(),
    expiresAt,
  };
  await redis.set(redeemKey(token), JSON.stringify(payload), { ex: TTL_SECONDS });
  return {
    token,
    redeemUrl: `${siteBaseUrl()}/redeem/${token}`,
    expiresAt,
  };
}

/**
 * Consume a redeem token: return the secret once and delete the key.
 * Returns null when missing, expired, or already used.
 */
export async function consumeRedeemToken(token: string): Promise<RedeemPayload | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const key = redeemKey(token);
  const raw = await redis.get<string>(key);
  if (!raw) return null;
  // Delete first so concurrent redeemers cannot both win.
  await redis.del(key);
  const payload =
    typeof raw === "string" ? (JSON.parse(raw) as RedeemPayload) : (raw as RedeemPayload);
  if (!payload?.secret) return null;
  if (payload.expiresAt && Date.parse(payload.expiresAt) < Date.now()) return null;
  return payload;
}
