import { auth } from "@/auth";
import { getUserById } from "@/lib/redis";

/**
 * Server-side identity for the current request, including the roomd key.
 *
 * The API key is deliberately absent from the JWT and from the session object.
 * Auth.js serves the session verbatim from /api/auth/session to any logged-in
 * browser, so anything placed there is public to that user's client. The key is
 * a bearer credential for the whole team, so it stays in Redis and is loaded
 * here, in server code, only when a request actually needs to call roomd.
 */
export interface ServerIdentity {
  userId: string;
  teamId: string;
  apiKey: string;
}

/** Returns the caller's identity, or null when unauthenticated. */
export async function getServerIdentity(): Promise<ServerIdentity | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await getUserById(session.user.id);
  if (!user) return null;

  return { userId: user.id, teamId: user.teamId, apiKey: user.apiKey };
}

/**
 * Whether this identity is the deployment operator.
 *
 * The operator is whoever holds the master key (`ROOMD_MASTER_KEY`), the same
 * static key the dashboard uses to provision new teams. Only the operator can
 * see the waitlist and invite people, so an ordinary invited user who reaches
 * /admin manages only their own team, never the waitlist.
 */
export function isOperator(identity: ServerIdentity): boolean {
  const master = process.env.ROOMD_MASTER_KEY;
  return Boolean(master) && identity.apiKey === master;
}
