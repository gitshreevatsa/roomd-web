import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { deleteUser, getUserById } from "@/lib/redis";
import { revokeAllTeamKeys } from "@/lib/roomd";

/**
 * Self-service account erasure (GDPR).
 * DELETE — revoke roomd keys for the caller's team and remove the dashboard user.
 */
export async function DELETE() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserById(identity.userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const master = process.env.ROOMD_MASTER_KEY;
  if (master && user.apiKey === master) {
    return NextResponse.json(
      { error: "Operator account cannot self-delete; use another admin path" },
      { status: 400 },
    );
  }

  if (master) {
    try {
      await revokeAllTeamKeys(user.teamId, master);
    } catch (err) {
      console.error("[account:delete:keys]", err instanceof Error ? err.message : err);
    }
  }

  await deleteUser(user.id);
  return NextResponse.json({ ok: true, deleted: true });
}
