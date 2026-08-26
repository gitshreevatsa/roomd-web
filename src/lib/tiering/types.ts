/**
 * Tiering module — plan catalogs, per-team overrides, and exclusion switches.
 *
 * Kept separate from auth/rooms so operators can tune caps without touching
 * product routes. Redis key: app:tier:team:{teamId}
 */

export type TierId = "free" | "startup" | "enterprise";

/** Legacy Stripe / UserRecord value — treat as startup. */
export type LegacyPlanId = "team";

export type AnyPlanId = TierId | LegacyPlanId;

export interface TierLimits {
  /** Orgs (teams) a human may belong to. */
  maxOrgs: number;
  /** Members (seats) per org. */
  maxMembers: number;
  /** Rooms per org. */
  maxRooms: number;
  /** Dyn/API keys per org (proxy for agent credentials). */
  maxKeys: number;
  /** Distinct online agents in a single room. */
  maxAgentsPerRoom: number;
  /** MCP / HTTP calls per minute for the org. */
  rateLimitPerMinute: number;
}

/**
 * Operator exclusion switches — when true, that cap is not enforced.
 * Intended for enterprise (or temporary free/startup exceptions).
 */
export interface TierExclusions {
  bypassOrgCap?: boolean;
  bypassMemberCap?: boolean;
  bypassRoomCap?: boolean;
  bypassKeyCap?: boolean;
  bypassAgentFanout?: boolean;
  bypassRateLimit?: boolean;
}

/** Partial overrides applied on top of the catalog tier. */
export type TierOverrides = Partial<TierLimits>;

export interface TeamTierConfig {
  plan: TierId;
  overrides?: TierOverrides;
  exclusions?: TierExclusions;
  updatedAt?: string;
  updatedBy?: string;
}

export interface EffectiveTier {
  plan: TierId;
  limits: TierLimits;
  exclusions: TierExclusions;
  /** True when a Redis override/exclusion row exists. */
  customized: boolean;
}

export class TierLimitError extends Error {
  readonly code:
    | "org_cap"
    | "member_cap"
    | "room_cap"
    | "key_cap"
    | "agent_fanout"
    | "rate_limit";

  constructor(code: TierLimitError["code"], message: string) {
    super(message);
    this.name = "TierLimitError";
    this.code = code;
  }
}
