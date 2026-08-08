import { NextResponse } from "next/server";
import { getServerIdentity, isOperator } from "@/lib/session";
import {
  countTeamOwners,
  deleteUser,
  getMembership,
  getUserById,
  listTeamMemberIds,
  removeMembership,
} from "@/lib/redis";
import {
  purgeTeamRooms,
  revokeTeamAccess,
  revokeUserApiKey,
} from "@/lib/roomd";
import { track, captureError } from "@/lib/telemetry";

/**
 * Self-service account erasure (GDPR).
 * Owner (sole): revoke keys+invites, purge rooms, remove members, delete user.
 * Member: revoke personal key only, drop membership, delete user.
 * Fail closed: if revocation throws, the user row is not deleted.
 */
export async function DELETE() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserById(identity.userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isOperator(identity) || user.isOperator) {
    return NextResponse.json(
      { error: "Operator account cannot self-delete; use another admin path" },
      { status: 400 },
    );
  }

  const master = process.env.ROOMD_MASTER_KEY;
  if (!master) {
    return NextResponse.json(
      { ok: false, error: "ROOMD_MASTER_KEY is not configured — cannot revoke safely" },
      { status: 502 },
    );
  }

  const membership = await getMembership(user.id, user.teamId);
  const role = membership?.role ?? "owner";

  if (role === "owner") {
    const owners = await countTeamOwners(user.teamId);
    if (owners > 1) {
      return NextResponse.json(
        { error: "Transfer ownership before deleting this account" },
        { status: 400 },
      );
    }
    try {
      await revokeTeamAccess(user.teamId, master);
    } catch (err) {
      captureError(err, { route: "account:delete:revoke", userId: user.id });
      return NextResponse.json(
        { ok: false, error: "Revocation incomplete — account not deleted" },
        { status: 502 },
      );
    }
    try {
      await purgeTeamRooms(user.teamId, master);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not available")) {
        console.error("[account:delete:purge] TODO: purge endpoint unavailable", msg);
      } else {
        captureError(err, { route: "account:delete:purge", userId: user.id });
        return NextResponse.json(
          { ok: false, error: "Room purge failed — account not deleted" },
          { status: 502 },
        );
      }
    }
    const members = await listTeamMemberIds(user.teamId);
    for (const mid of members) {
      if (mid !== user.id) await removeMembership(mid, user.teamId);
    }
  } else {
    try {
      await revokeUserApiKey(user.teamId, user.apiKey, master);
    } catch (err) {
      captureError(err, { route: "account:delete:member-key", userId: user.id });
      return NextResponse.json(
        { ok: false, error: "Key revocation failed — account not deleted" },
        { status: 502 },
      );
    }
    await removeMembership(user.id, user.teamId);
  }

  await deleteUser(user.id);
  track("account_deleted", { userId: user.id, teamId: user.teamId });
  return NextResponse.json({ ok: true, deleted: true });
}
