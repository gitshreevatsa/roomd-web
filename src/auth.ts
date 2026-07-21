import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { getAuthProviders } from "@/lib/auth";
import {
  getUserByProvider,
  getUserByEmail,
  createUser,
  linkAuthMethod,
  getWaitlistEntry,
  getOrgInvite,
} from "@/lib/redis";
import { provisionTeamKey } from "@/lib/roomd";
import { oauthTeamId } from "@/lib/teams";

/**
 * Whether this email may receive a newly provisioned team.
 * Default: must be waitlist-invited or org-invited (invite-only).
 * Set ALLOW_OPEN_SIGNUP=true to allow anyone when AUTH_MODE is email/both.
 */
async function mayProvision(email: string | undefined): Promise<boolean> {
  if (process.env.ALLOW_OPEN_SIGNUP === "true") return true;
  if (!email) return false;
  const e = email.toLowerCase();
  const wait = await getWaitlistEntry(e);
  if (wait?.status === "invited") return true;
  const org = await getOrgInvite(e);
  return Boolean(
    org && (org.status === "delivered" || org.status === "pending_delivery"),
  );
}

function oauthEmailVerified(
  provider: string,
  profile: Record<string, unknown> | undefined,
): boolean {
  if (!profile) return false;
  if (provider === "google") return profile.email_verified === true;
  if (provider === "github") {
    // GitHub OAuth returns emails separately; treat presence of email on the
    // user object as sufficient only when the profile marks it verified.
    return profile.email_verified === true || profile.verified === true || Boolean(profile.email);
  }
  return false;
}

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

    async signIn({ user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "github") {
        const provider = account.provider;
        const externalId = account.providerAccountId;
        const profileRec = profile as Record<string, unknown> | undefined;

        let linked = await getUserByProvider(provider, externalId);

        // Link by email only when the provider asserts a verified email.
        if (!linked && user.email && oauthEmailVerified(provider, profileRec)) {
          linked = await getUserByEmail(user.email.toLowerCase());
          if (linked?.disabledAt) return false;
          if (linked) await linkAuthMethod(linked.id, provider, externalId);
        }

        if (!linked) {
          if (!(await mayProvision(user.email ?? undefined))) return false;

          const masterKey = process.env.ROOMD_MASTER_KEY!;
          const newTeamId = oauthTeamId(provider, externalId);
          const keyData = await provisionTeamKey(
            newTeamId,
            masterKey,
            user.email ?? provider,
          );

          linked = await createUser({
            email: user.email?.toLowerCase() ?? undefined,
            name: user.name ?? undefined,
            teamId: keyData.teamId,
            apiKey: keyData.secret,
            authMethods: [provider],
            createdAt: new Date().toISOString(),
          });

          await linkAuthMethod(linked.id, provider, externalId);
        }

        if (linked.disabledAt) return false;

        user.id = linked.id;
        user.teamId = linked.teamId;
      }
      return true;
    },
  },
});
