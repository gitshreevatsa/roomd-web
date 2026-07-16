import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity, isOperator } from "@/lib/session";
import { listWaitlist, markWaitlistDeclined } from "@/lib/redis";

/**
 * Waitlist inbox only (landing-page requests).
 * Issuing keys / email goes through /api/admin/access.
 */

const declineSchema = z.object({
  action: z.literal("decline"),
  email: z.string().trim().email().max(254),
});

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) return NextResponse.json({ error: "Operator only" }, { status: 403 });

  try {
    return NextResponse.json({ entries: await listWaitlist() });
  } catch (err) {
    console.error("[waitlist:list]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load the waitlist" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) return NextResponse.json({ error: "Operator only" }, { status: 403 });

  let body: z.infer<typeof declineSchema>;
  try {
    body = declineSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await markWaitlistDeclined(body.email.toLowerCase());
    return NextResponse.json({ email: body.email.toLowerCase(), status: "declined" });
  } catch (err) {
    console.error("[waitlist:decline]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to decline" }, { status: 500 });
  }
}
