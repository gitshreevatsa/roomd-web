import Credentials from "next-auth/providers/credentials";
import { validateApiKey } from "@/lib/roomd";
import { upsertUserByTeamId, updateUser } from "@/lib/redis";

export const apikeyProvider = Credentials({
  id: "apikey",
  name: "API Key",
  credentials: {
    apiKey: { label: "API Key", type: "password" },
  },
  async authorize(credentials) {
    const apiKey = (credentials?.apiKey as string) ?? "";
    if (!apiKey) return null;

    const { valid, teamId } = await validateApiKey(apiKey);
    if (!valid || !teamId) return null;

    // upsertUserByTeamId is race-safe: concurrent first-logins for the same
    // teamId converge to one record via SET NX on the index key.
    const user = await upsertUserByTeamId({
      teamId,
      apiKey,
      authMethods: ["apikey"],
      createdAt: new Date().toISOString(),
    });

    // If they logged in with a different (newer) key, update the stored one.
    if (user.apiKey !== apiKey) {
      await updateUser(user.id, { apiKey });
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
