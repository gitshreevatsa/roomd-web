/**
 * Plan ceilings and Stripe-ready metering hooks.
 * Caps are enforced now; Stripe subscription status upgrades the plan.
 */

export type PlanId = "free" | "team" | "enterprise";

export interface PlanLimits {
  maxRooms: number;
  maxKeys: number;
  maxInvitesPerRoom: number;
  maxWebhooks: number;
  maxTeammates: number;
  rateLimitPerMinute: number;
}

const FREE: PlanLimits = {
  maxRooms: parseInt(process.env.MAX_ROOMS_PER_TEAM ?? "50", 10),
  // MAX_TEAM_KEYS is the P0-4 alias; MAX_KEYS_PER_TEAM kept for existing env.
  maxKeys: parseInt(
    process.env.MAX_TEAM_KEYS ?? process.env.MAX_KEYS_PER_TEAM ?? "20",
    10,
  ),
  maxInvitesPerRoom: parseInt(process.env.MAX_INVITES_PER_ROOM ?? "20", 10),
  maxWebhooks: parseInt(process.env.MAX_WEBHOOKS_PER_TEAM ?? "10", 10),
  maxTeammates: parseInt(process.env.MAX_TEAMMATES_PER_TEAM ?? "10", 10),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? "60", 10),
};

const TEAM: PlanLimits = {
  ...FREE,
  maxRooms: Math.max(FREE.maxRooms, 200),
  maxKeys: Math.max(FREE.maxKeys, 50),
  maxTeammates: Math.max(FREE.maxTeammates, 25),
  rateLimitPerMinute: Math.max(FREE.rateLimitPerMinute, 300),
};

const ENTERPRISE: PlanLimits = {
  maxRooms: 10_000,
  maxKeys: 500,
  maxInvitesPerRoom: 100,
  maxWebhooks: 100,
  maxTeammates: 500,
  rateLimitPerMinute: 2_000,
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: FREE,
  team: TEAM,
  enterprise: ENTERPRISE,
};

export function limitsForPlan(plan: PlanId | string | undefined | null): PlanLimits {
  if (plan === "team" || plan === "enterprise") return PLAN_LIMITS[plan];
  return PLAN_LIMITS.free;
}

/** Stripe price id → plan mapping (set in env when billing is enabled). */
export function planFromStripePriceId(priceId: string | undefined | null): PlanId {
  if (!priceId) return "free";
  if (process.env.STRIPE_PRICE_ENTERPRISE && priceId === process.env.STRIPE_PRICE_ENTERPRISE) {
    return "enterprise";
  }
  if (process.env.STRIPE_PRICE_TEAM && priceId === process.env.STRIPE_PRICE_TEAM) {
    return "team";
  }
  return "free";
}

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
