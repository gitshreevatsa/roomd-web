import { Redis } from "@upstash/redis";
import type { TeamTierConfig, TierExclusions, TierId, TierOverrides } from "./types";
import { normalizeTierId } from "./catalog";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/** Shared with roomd — do not rename without updating both sides. */
export function teamTierKey(teamId: string): string {
  return `app:tier:team:${teamId}`;
}

export async function getTeamTierConfig(teamId: string): Promise<TeamTierConfig | null> {
  const raw = await redis.get<string | TeamTierConfig>(teamTierKey(teamId));
  if (!raw) return null;
  const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as TeamTierConfig;
  return {
    ...parsed,
    plan: normalizeTierId(parsed.plan),
  };
}

export async function setTeamTierConfig(
  teamId: string,
  patch: {
    plan?: TierId;
    overrides?: TierOverrides | null;
    exclusions?: TierExclusions | null;
    updatedBy?: string;
  },
): Promise<TeamTierConfig> {
  const existing = (await getTeamTierConfig(teamId)) ?? {
    plan: "free" as TierId,
  };

  const next: TeamTierConfig = {
    plan: patch.plan ? normalizeTierId(patch.plan) : existing.plan,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy ?? existing.updatedBy,
  };

  if (patch.overrides === null) {
    // clear
  } else if (patch.overrides) {
    next.overrides = { ...existing.overrides, ...patch.overrides };
  } else if (existing.overrides) {
    next.overrides = existing.overrides;
  }

  if (patch.exclusions === null) {
    // clear
  } else if (patch.exclusions) {
    next.exclusions = { ...existing.exclusions, ...patch.exclusions };
  } else if (existing.exclusions) {
    next.exclusions = existing.exclusions;
  }

  await redis.set(teamTierKey(teamId), JSON.stringify(next));
  return next;
}
