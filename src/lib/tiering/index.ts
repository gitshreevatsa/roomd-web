/**
 * Tiering module — separate from product routes so caps / exclusions can evolve
 * without rewriting invite/room handlers.
 *
 * Free: 1 org · 2 members · 2 rooms · tight agent/rate caps
 * Startup: 1 org · env-configurable members/rooms
 * Enterprise: high defaults + per-team overrides + exclusion switches
 */

export type {
  TierId,
  AnyPlanId,
  TierLimits,
  TierExclusions,
  TierOverrides,
  TeamTierConfig,
  EffectiveTier,
} from "./types";
export { TierLimitError } from "./types";
export { TIER_CATALOG, normalizeTierId } from "./catalog";
export { resolveEffectiveTier, isCapEnforced } from "./resolve";
export { getTeamTierConfig, setTeamTierConfig, teamTierKey } from "./store";
export {
  effectiveTierForTeam,
  assertCanJoinOrg,
  assertCanAddMember,
  assertCanCreateRoom,
  assertCanCreateKey,
} from "./enforce";
