import { auth } from "@/auth";
import { getUserById } from "@/lib/redis";
import {
  isOperator,
  operatorUserIdsFromEnv,
  type ServerIdentity,
} from "@/lib/operator";

export type { ServerIdentity };
export { isOperator };

export type IdentityFailure =
  | "no_session"
  | "user_missing"
  | "user_disabled"
  | "api_key_unavailable";

export type IdentityResult =
  | { ok: true; identity: ServerIdentity }
  | { ok: false; reason: IdentityFailure };

/**
 * Resolve the caller with a reason code when auth fails.
 * Prefer this in API routes so the UI can show an actionable error.
 */
export async function resolveServerIdentity(): Promise<IdentityResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "no_session" };

  const user = await getUserById(session.user.id);
  if (!user) return { ok: false, reason: "user_missing" };
  if (user.disabledAt) return { ok: false, reason: "user_disabled" };

  const operator =
    user.isOperator === true || operatorUserIdsFromEnv().has(user.id);

  // Silent decrypt failure / missing credentials → force re-auth (P2).
  // Operators are allowed through with an empty key: Owner portal admin calls
  // use ROOMD_MASTER_KEY from env, not the decrypted personal key. Teammate /
  // room APIs that need identity.apiKey must still check it themselves.
  if (!user.apiKey && !operator) {
    return { ok: false, reason: "api_key_unavailable" };
  }

  return {
    ok: true,
    identity: {
      userId: user.id,
      teamId: user.teamId,
      apiKey: user.apiKey,
      isOperator: user.isOperator === true,
    },
  };
}

/** Returns the caller's identity, or null when unauthenticated. */
export async function getServerIdentity(): Promise<ServerIdentity | null> {
  const result = await resolveServerIdentity();
  return result.ok ? result.identity : null;
}

export function identityErrorMessage(reason: IdentityFailure): string {
  switch (reason) {
    case "no_session":
      return "Session expired — sign out and sign in again with your owner key";
    case "user_missing":
      return "Account not found — sign out and sign in again with your owner key";
    case "user_disabled":
      return "This account is disabled";
    case "api_key_unavailable":
      return "Stored API key is unreadable — sign out and sign in again with your owner key";
  }
}
