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
    // Never trust email presence alone — require an explicit verified flag.
    return profile.email_verified === true || profile.verified === true;
  }
  return false;
}

/** GitHub often omits email_verified on the profile; check /user/emails. */
async function githubVerifiedPrimaryEmail(
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "roomd-web",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const emails = (await res.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primary = emails.find((e) => e.primary && e.verified);
    return primary?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
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

        let emailVerified = oauthEmailVerified(provider, profileRec);
        if (
          provider === "github" &&
          !emailVerified &&
          typeof account.access_token === "string"
        ) {
          const ghEmail = await githubVerifiedPrimaryEmail(account.access_token);
          if (ghEmail) {
            emailVerified = true;
            user.email = ghEmail;
          }
        }

        // Link by email only when the provider asserts a verified email.
        if (!linked && user.email && emailVerified) {
          linked = await getUserByEmail(user.email.toLowerCase());
          if (linked?.disabledAt) return false;
          if (linked) await linkAuthMethod(linked.id, provider, externalId);
        }

        if (!linked) {
          if (!emailVerified) return false;
          if (!(await mayProvision(user.email ?? undefined))) return false;

          // P1-7: if invite/waitlist already created a user+team for this email,
          // we would have linked above. Only provision a fresh team when no
          // person record exists — never a second team for the same email.
          const masterKey = process.env.ROOMD_MASTER_KEY!;
          const email = user.email?.toLowerCase();
          const wait = email ? await getWaitlistEntry(email) : null;
          const org = email ? await getOrgInvite(email) : null;
          const invitedTeamId = wait?.teamId ?? org?.teamId;
          const newTeamId = invitedTeamId || oauthTeamId(provider, externalId);
          const keyData = await provisionTeamKey(
            newTeamId,
            masterKey,
            user.email ?? provider,
          );

          linked = await createUser({
            email: email ?? undefined,
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
