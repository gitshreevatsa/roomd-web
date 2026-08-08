import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { validateApiKey } from "@/lib/roomd";
import {
  findOrCreateUserForApiKey,
  takePendingTeammateInvite,
  updateUser,
} from "@/lib/redis";
import { checkWebRateLimit, rateLimitBucket } from "@/lib/ratelimit";

export const apikeyProvider = Credentials({
  id: "apikey",
  name: "API Key",
  credentials: {
    apiKey: { label: "API Key", type: "password" },
  },
  async authorize(credentials) {
    const apiKey = (credentials?.apiKey as string) ?? "";
    if (!apiKey) return null;

    try {
      const h = await headers();
      const ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        "unknown";
      const prefix = apiKey.slice(0, 8);
      const [ipLimit, keyLimit] = await Promise.all([
        checkWebRateLimit(rateLimitBucket("login-ip", ip), 10),
        checkWebRateLimit(rateLimitBucket("login-key", prefix), 10),
      ]);
      if (!ipLimit.allowed || !keyLimit.allowed) return null;
    } catch {
      // headers() unavailable — continue without IP bucket
      const prefix = apiKey.slice(0, 8);
      const keyLimit = await checkWebRateLimit(rateLimitBucket("login-key", prefix), 10);
      if (!keyLimit.allowed) return null;
    }

    const { valid, teamId } = await validateApiKey(apiKey);
    if (!valid || !teamId) return null;

    const pending = await takePendingTeammateInvite(apiKey);
    const master = process.env.ROOMD_MASTER_KEY;
    const bootstrapOperator = Boolean(master) && apiKey === master;

    // Identity v2: find by key digest, or create a NEW user for this person.
    // Never upsert by teamId (that collapsed teammates onto the owner).
    let user = await findOrCreateUserForApiKey(apiKey, teamId, {
      email: pending?.email,
      isOperator: bootstrapOperator ? true : undefined,
    });

    if (user.disabledAt) return null;

    // Migration: first master-key login sets the explicit operator flag once.
    // Ongoing authz uses the flag only (see isOperator in session.ts).
    if (bootstrapOperator && user.isOperator !== true) {
      await updateUser(user.id, { isOperator: true });
      user = { ...user, isOperator: true };
    }

    // The apiKey is deliberately not returned. It would land in the JWT and
    // then in the session, which the browser can read. See auth.ts.
    return {
      id: user.id,
      teamId: user.teamId,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  },
});
