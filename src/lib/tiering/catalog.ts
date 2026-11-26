import type { TierId, TierLimits } from "./types";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Default catalogs. Startup member/room ceilings are env-configurable so you
 * can tune pilots without code changes. Enterprise defaults are high; real
 * enterprise orgs should get Redis overrides + exclusion switches.
 */
export const TIER_CATALOG: Record<TierId, TierLimits> = {
  free: {
    maxOrgs: 1,
    maxMembers: 2,
    maxRooms: 2,
    maxKeys: 2,
    maxAgentsPerRoom: 4,
    rateLimitPerMinute: 30,
  },
  startup: {
    maxOrgs: 1,
    maxMembers: envInt("TIER_STARTUP_MAX_MEMBERS", 10),
    maxRooms: envInt("TIER_STARTUP_MAX_ROOMS", 20),
    maxKeys: envInt("TIER_STARTUP_MAX_KEYS", 20),
    maxAgentsPerRoom: envInt("TIER_STARTUP_MAX_AGENTS_PER_ROOM", 16),
    rateLimitPerMinute: envInt("TIER_STARTUP_RATE_LIMIT_PER_MINUTE", 120),
  },
  enterprise: {
    maxOrgs: envInt("TIER_ENTERPRISE_MAX_ORGS", 50),
    maxMembers: envInt("TIER_ENTERPRISE_MAX_MEMBERS", 500),
    maxRooms: envInt("TIER_ENTERPRISE_MAX_ROOMS", 10_000),
    maxKeys: envInt("TIER_ENTERPRISE_MAX_KEYS", 500),
    maxAgentsPerRoom: envInt("TIER_ENTERPRISE_MAX_AGENTS_PER_ROOM", 256),
    rateLimitPerMinute: envInt("TIER_ENTERPRISE_RATE_LIMIT_PER_MINUTE", 2_000),
  },
};

export function normalizeTierId(plan: string | null | undefined): TierId {
  if (plan === "startup" || plan === "team") return "startup";
  if (plan === "enterprise") return "enterprise";
  return "free";
}
