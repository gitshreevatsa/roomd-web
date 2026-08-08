"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/auth";
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

export async function deleteAccountAction() {
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");
  const user = await getUserById(identity.userId);
  if (!user) redirect("/login");
  if (isOperator(identity) || user.isOperator) {
    throw new Error("Operator account cannot self-delete");
  }

  const master = process.env.ROOMD_MASTER_KEY;
  if (!master) {
    throw new Error("Cannot revoke safely — ROOMD_MASTER_KEY missing");
  }
  const membership = await getMembership(user.id, user.teamId);
  const role = membership?.role ?? "owner";

  if (role === "owner") {
    const owners = await countTeamOwners(user.teamId);
    if (owners > 1) {
      throw new Error("Transfer ownership before deleting this account");
    }
    try {
      await revokeTeamAccess(user.teamId, master);
    } catch {
      throw new Error("Revocation incomplete — account not deleted");
    }
    try {
      await purgeTeamRooms(user.teamId, master);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not available")) {
        throw new Error("Room purge failed — account not deleted");
      }
    }
    const members = await listTeamMemberIds(user.teamId);
    for (const mid of members) {
      if (mid !== user.id) await removeMembership(mid, user.teamId);
    }
  } else {
    try {
      await revokeUserApiKey(user.teamId, user.apiKey, master);
    } catch {
      throw new Error("Key revocation failed — account not deleted");
    }
    await removeMembership(user.id, user.teamId);
  }

  await deleteUser(user.id);
  await signOut({
    redirectTo: process.env.MARKETING_URL ?? "https://roomd.sh",
  });
}
