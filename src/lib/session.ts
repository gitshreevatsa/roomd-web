import { auth } from "@/auth";
import { getUserById } from "@/lib/redis";
import {
  isOperator,
  type ServerIdentity,
} from "@/lib/operator";

export type { ServerIdentity };
export { isOperator };

/** Returns the caller's identity, or null when unauthenticated. */
export async function getServerIdentity(): Promise<ServerIdentity | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await getUserById(session.user.id);
  if (!user || user.disabledAt) return null;
  // Silent decrypt failure / missing credentials → force re-auth (P2).
  if (!user.apiKey) return null;

  return {
    userId: user.id,
    teamId: user.teamId,
    apiKey: user.apiKey,
    isOperator: user.isOperator === true,
  };
}
