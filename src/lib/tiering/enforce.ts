import { listTeamMemberIds, listUserTeamIds, getUserById } from "@/lib/redis";
import { listTeamRooms } from "@/lib/roomd";
import { getTeamTierConfig } from "./store";
import { resolveEffectiveTier, isCapEnforced } from "./resolve";
import { TierLimitError, type EffectiveTier } from "./types";

/**
 * Load effective tiers for a team (catalog + Redis overrides/exclusions).
 * Falls back to the team owner's UserRecord.plan when no Redis tier row exists.
 */
export async function effectiveTierForTeam(
  teamId: string,
  userPlan?: string | null,
): Promise<EffectiveTier> {
  const config = await getTeamTierConfig(teamId);
  let plan = userPlan;
  if (plan == null && !config) {
    // Best-effort: any user on the team may carry the billing plan.
    const memberIds = await listTeamMemberIds(teamId);
    for (const id of memberIds.slice(0, 5)) {
      const u = await getUserById(id);
      if (u?.plan) {
        plan = u.plan;
        break;
      }
    }
  }
  return resolveEffectiveTier(plan, config);
}

export async function assertCanJoinOrg(
  userId: string,
  tiers: EffectiveTier,
): Promise<void> {
  if (!isCapEnforced(tiers.exclusions, "bypassOrgCap")) return;
  const orgs = await listUserTeamIds(userId);
  if (orgs.length >= tiers.limits.maxOrgs) {
    throw new TierLimitError(
      "org_cap",
      `Org limit reached (${tiers.limits.maxOrgs}). Upgrade your plan.`,
    );
  }
}

export async function assertCanAddMember(
  teamId: string,
  tiers: EffectiveTier,
): Promise<void> {
  if (!isCapEnforced(tiers.exclusions, "bypassMemberCap")) return;
  const members = await listTeamMemberIds(teamId);
  if (members.length >= tiers.limits.maxMembers) {
    throw new TierLimitError(
      "member_cap",
      `Seat limit reached (${tiers.limits.maxMembers}). Upgrade your plan.`,
    );
  }
}

export async function assertCanCreateRoom(
  apiKey: string,
  tiers: EffectiveTier,
): Promise<void> {
  if (!isCapEnforced(tiers.exclusions, "bypassRoomCap")) return;
  const rooms = await listTeamRooms(apiKey);
  if (rooms.length >= tiers.limits.maxRooms) {
    throw new TierLimitError(
      "room_cap",
      `Room limit reached (${tiers.limits.maxRooms}). Upgrade your plan.`,
    );
  }
}

export async function assertCanCreateKey(
  currentKeyCount: number,
  tiers: EffectiveTier,
): Promise<void> {
  if (!isCapEnforced(tiers.exclusions, "bypassKeyCap")) return;
  if (currentKeyCount >= tiers.limits.maxKeys) {
    throw new TierLimitError(
      "key_cap",
      `Key limit reached (${tiers.limits.maxKeys}). Upgrade your plan.`,
    );
  }
}
