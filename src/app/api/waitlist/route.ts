import { NextRequest, NextResponse } from "next/server";
import {
  addToWaitlist,
  getOrgInvite,
  getUserByEmail,
  getWaitlistEntry,
} from "@/lib/redis";
import { checkWebRateLimit, clientIp, rateLimitBucket } from "@/lib/ratelimit";
import { track } from "@/lib/telemetry";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email().max(254) });

/**
 * Generic waitlist response — same shape for join / already-on-list / blocked
 * so the endpoint cannot be used as an account/invite oracle.
 */
function waitlistOk() {
  return NextResponse.json({
    ok: true,
    status: "ok",
    message: "If this email is eligible, you're on the list. We'll email a key when a spot opens.",
  });
}

/**
 * Join the public waitlist. Does not reveal whether the email already has
 * access, an invite, or a pending row.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await checkWebRateLimit(rateLimitBucket("waitlist", ip), 10);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { email: rawEmail } = schema.parse(await req.json());
    const email = rawEmail.toLowerCase();

    const user = await getUserByEmail(email);
    if (user) return waitlistOk();

    const orgInvite = await getOrgInvite(email);
    if (
      orgInvite &&
      (orgInvite.status === "delivered" || orgInvite.status === "pending_delivery")
    ) {
      return waitlistOk();
    }

    const waitlist = await getWaitlistEntry(email);
    if (waitlist) {
      // Already pending / invited / declined / revoked — same response.
      return waitlistOk();
    }

    await addToWaitlist(email);
    track("waitlist_joined");
    return waitlistOk();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error("[waitlist]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not join the waitlist" }, { status: 500 });
  }
}
