import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity, isOperator } from "@/lib/session";
import {
  deleteUser,
  disableUser,
  enableUser,
  getAllUsers,
  getUserById,
  listOrgInvites,
  listWaitlist,
} from "@/lib/redis";
import { revokeAllTeamKeys } from "@/lib/roomd";

/**
 * Operator directory of dashboard users / orgs.
 * disable — revoke roomd keys + block login (keep row)
 * enable  — clear disabled flag
 * delete  — revoke keys + remove user row
 */

const actionSchema = z.object({
  action: z.enum(["disable", "enable", "delete"]),
  userId: z.string().min(1),
});

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) return NextResponse.json({ error: "Operator only" }, { status: 403 });

  try {
    const [users, invites, waitlist] = await Promise.all([
      getAllUsers(),
      listOrgInvites(),
      listWaitlist(),
    ]);

    const inviteByTeam = new Map(invites.map((i) => [i.teamId, i]));
    const waitlistByTeam = new Map(
      waitlist.filter((w) => w.teamId).map((w) => [w.teamId!, w]),
    );

    const rows = users
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        name: u.name ?? null,
        teamId: u.teamId,
        authMethods: u.authMethods,
        createdAt: u.createdAt,
        disabledAt: u.disabledAt ?? null,
        source: inviteByTeam.has(u.teamId)
          ? ("invite" as const)
          : waitlistByTeam.has(u.teamId)
            ? ("waitlist" as const)
            : ("unknown" as const),
      }))
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("[users:list]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) return NextResponse.json({ error: "Operator only" }, { status: 403 });

  let body: z.infer<typeof actionSchema>;
  try {
    body = actionSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const master = process.env.ROOMD_MASTER_KEY;
  if (!master) {
    return NextResponse.json({ error: "ROOMD_MASTER_KEY is not configured" }, { status: 500 });
  }

  const user = await getUserById(body.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Never let the operator disable/delete their own operator session accidentally
  // via wiping the master-key account if it somehow shares an id — skip if same key.
  if (user.apiKey === master && body.action !== "enable") {
    return NextResponse.json({ error: "Cannot disable or delete the operator account" }, { status: 400 });
  }

  try {
    if (body.action === "enable") {
      await enableUser(user.id);
      return NextResponse.json({ ok: true, action: "enable" });
    }

    try {
      await revokeAllTeamKeys(user.teamId, master);
    } catch (err) {
      console.error("[users:keys]", err instanceof Error ? err.message : err);
    }

    if (body.action === "disable") {
      await disableUser(user.id);
      return NextResponse.json({ ok: true, action: "disable" });
    }

    await deleteUser(user.id);
    return NextResponse.json({ ok: true, action: "delete" });
  } catch (err) {
    console.error("[users:action]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
