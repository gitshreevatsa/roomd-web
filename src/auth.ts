import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { getAuthProviders } from "@/lib/auth";
import { getUserByProvider, getUserByEmail, createUser, linkAuthMethod } from "@/lib/redis";
import { provisionTeamKey } from "@/lib/roomd";
import { oauthTeamId } from "@/lib/teams";

/**
 * Full server-side auth. Spreads the edge-safe base config and adds the pieces
 * that need the Node runtime: the credential/OAuth providers (which reach
 * password hashing and Redis) and the `signIn` callback (which provisions a
 * roomd team). None of this is imported by the middleware.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: getAuthProviders(),
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      // Handle OAuth sign-ins: create or link the user record
      if (account?.provider === "google" || account?.provider === "github") {
        const provider = account.provider;
        const externalId = account.providerAccountId;

        // Already linked: nothing to create.
        let linked = await getUserByProvider(provider, externalId);

        // Same email, different login method: link this provider to that
        // account rather than stranding the user with a second empty team.
        if (!linked && user.email) {
          linked = await getUserByEmail(user.email.toLowerCase());
          if (linked) await linkAuthMethod(linked.id, provider, externalId);
        }

        if (!linked) {
          const masterKey = process.env.ROOMD_MASTER_KEY!;

          // Derive a stable teamId from provider + externalId so repeated
          // sign-ins for the same OAuth account converge on one team.
          const newTeamId = oauthTeamId(provider, externalId);
          const keyData = await provisionTeamKey(newTeamId, masterKey, user.email ?? provider);

          linked = await createUser({
            email: user.email?.toLowerCase() ?? undefined,
            name: user.name ?? undefined,
            teamId: keyData.teamId, // isolated per user, not the master teamId
            apiKey: keyData.secret,
            authMethods: [provider],
            createdAt: new Date().toISOString(),
          });

          await linkAuthMethod(linked.id, provider, externalId);
        }

        user.id = linked.id;
        user.teamId = linked.teamId;
      }
      return true;
    },
  },
});
