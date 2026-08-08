import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getUserByTeamId, updateUser } from "@/lib/redis";
import { appendAudit } from "@/lib/audit";
import { billingEnabled, planFromStripePriceId } from "@/lib/plans";

/**
 * Stripe webhook: updates team plan on subscription events.
 * Enable with STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.
 * Team billing metadata is stored on the owner UserRecord: stripeCustomerId, plan.
 */

export const runtime = "nodejs";

function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );
  const timestamp = parts["t"];
  const sig = parts["v1"];
  if (!timestamp || !sig) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!billingEnabled()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object;
    const teamId = (sub.metadata as { teamId?: string } | undefined)?.teamId;
    const customerId = typeof sub.customer === "string" ? sub.customer : undefined;
    const items = sub.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
    const priceId = items?.data?.[0]?.price?.id;
    const plan =
      event.type === "customer.subscription.deleted"
        ? "free"
        : planFromStripePriceId(priceId);

    let user = teamId ? await getUserByTeamId(teamId) : null;
    // Fallback: find by stripeCustomerId would need an index; teamId metadata is required.
    if (user) {
      await updateUser(user.id, {
        plan,
        stripeCustomerId: customerId ?? user.stripeCustomerId,
      } as Parameters<typeof updateUser>[1]);
      await appendAudit({
        actorUserId: null,
        actorTeamId: null,
        action: "billing.plan_change",
        targetTeamId: user.teamId,
        targetUserId: user.id,
        meta: { plan, eventType: event.type },
      });
    }
  }

  return NextResponse.json({ received: true });
}
