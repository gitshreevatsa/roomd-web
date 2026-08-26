/**
 * @deprecated Prefer `@/lib/tiering` for new code.
 * Thin compatibility shim so existing Stripe / invite call sites keep working.
 */

import {
  TIER_CATALOG,
  normalizeTierId,
  type TierId,
  type TierLimits,
} from "@/lib/tiering";

export type PlanId = TierId | "team";

export type PlanLimits = TierLimits & {
  maxInvitesPerRoom: number;
  maxWebhooks: number;
  maxTeammates: number;
};

function toPlanLimits(tier: TierId): PlanLimits {
  const base = TIER_CATALOG[tier];
  return {
    ...base,
    maxTeammates: base.maxMembers,
    maxInvitesPerRoom:
      tier === "free" ? 2 : tier === "startup" ? 20 : 100,
    maxWebhooks: tier === "free" ? 1 : tier === "startup" ? 10 : 100,
  };
}

export const PLAN_LIMITS: Record<"free" | "team" | "enterprise", PlanLimits> = {
  free: toPlanLimits("free"),
  team: toPlanLimits("startup"),
  enterprise: toPlanLimits("enterprise"),
};

export function limitsForPlan(plan: PlanId | string | undefined | null): PlanLimits {
  return toPlanLimits(normalizeTierId(plan));
}

/** Stripe price id → plan mapping (set in env when billing is enabled). */
export function planFromStripePriceId(priceId: string | undefined | null): PlanId {
  if (!priceId) return "free";
  if (process.env.STRIPE_PRICE_ENTERPRISE && priceId === process.env.STRIPE_PRICE_ENTERPRISE) {
    return "enterprise";
  }
  if (
    (process.env.STRIPE_PRICE_TEAM && priceId === process.env.STRIPE_PRICE_TEAM) ||
    (process.env.STRIPE_PRICE_STARTUP && priceId === process.env.STRIPE_PRICE_STARTUP)
  ) {
    return "startup";
  }
  return "free";
}

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
