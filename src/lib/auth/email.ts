import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { getUserByEmail } from "@/lib/redis";
import { verifyPassword } from "@/lib/password";
import { checkWebRateLimit, rateLimitBucket } from "@/lib/ratelimit";

export const emailProvider = Credentials({
  id: "email",
  name: "Email",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email = ((credentials?.email as string) ?? "").toLowerCase().trim();
    const password = (credentials?.password as string) ?? "";
    if (!email || !password) return null;

    try {
      const h = await headers();
      const ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        "unknown";
      const [ipLimit, emailLimit] = await Promise.all([
        checkWebRateLimit(rateLimitBucket("login-ip", ip), 10),
        checkWebRateLimit(rateLimitBucket("login-email", email), 10),
      ]);
      if (!ipLimit.allowed || !emailLimit.allowed) return null;
    } catch {
      const emailLimit = await checkWebRateLimit(
        rateLimitBucket("login-email", email),
        10,
      );
      if (!emailLimit.allowed) return null;
    }

    const user = await getUserByEmail(email);
    if (!user?.passwordHash) return null;
    if (user.disabledAt) return null;

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return null;

    return {
      id: user.id,
      teamId: user.teamId,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  },
});
