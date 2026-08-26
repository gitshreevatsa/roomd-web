import { TIER_CATALOG, normalizeTierId } from "./catalog";
import type {
  EffectiveTier,
  TeamTierConfig,
  TierExclusions,
  TierLimits,
  TierOverrides,
} from "./types";

function applyOverrides(base: TierLimits, overrides?: TierOverrides): TierLimits {
  if (!overrides) return { ...base };
  return {
    maxOrgs: overrides.maxOrgs ?? base.maxOrgs,
    maxMembers: overrides.maxMembers ?? base.maxMembers,
    maxRooms: overrides.maxRooms ?? base.maxRooms,
    maxKeys: overrides.maxKeys ?? base.maxKeys,
    maxAgentsPerRoom: overrides.maxAgentsPerRoom ?? base.maxAgentsPerRoom,
    rateLimitPerMinute: overrides.rateLimitPerMinute ?? base.rateLimitPerMinute,
  };
}

/** Merge catalog + optional Redis config into enforceable limits. */
export function resolveEffectiveTier(
  plan: string | null | undefined,
  config?: TeamTierConfig | null,
): EffectiveTier {
  const tierId = normalizeTierId(config?.plan ?? plan);
  const exclusions: TierExclusions = { ...(config?.exclusions ?? {}) };
  const limits = applyOverrides(TIER_CATALOG[tierId], config?.overrides);
  return {
    plan: tierId,
    limits,
    exclusions,
    customized: Boolean(config?.overrides || config?.exclusions),
  };
}

export function isCapEnforced(
  exclusions: TierExclusions,
  kind: keyof TierExclusions,
): boolean {
  return exclusions[kind] !== true;
}
