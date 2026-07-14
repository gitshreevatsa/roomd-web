import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity, isOperator } from "@/lib/session";
import { listWaitlist, markWaitlistInvited, removeFromWaitlist } from "@/lib/redis";
import { provisionTeamKey } from "@/lib/roomd";
import { waitlistTeamId } from "@/lib/teams";
import { sendInviteEmail } from "@/lib/mail";

const emailSchema = z.object({ email: z.string().trim().email().max(254) });

/**
 * GET  list the waitlist (operator only).
 * POST invite one person: provision an isolated team, issue a key, return it once.
 * DELETE remove one person.
 *
 * All three require the operator (the master-key holder). A non-operator gets 403,
 * which is also how the dashboard decides whether to show the waitlist at all.
 */

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

  let email: string;
  try {
    email = emailSchema.parse(await req.json()).email.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const masterKey = process.env.ROOMD_MASTER_KEY;
  if (!masterKey) {
    return NextResponse.json(
      { error: "ROOMD_MASTER_KEY is not configured, so teams cannot be provisioned." },
      { status: 500 }
    );
  }

  try {
    // Provision an isolated team for this person and mint their sign-in key.
    const key = await provisionTeamKey(waitlistTeamId(email), masterKey, email);
    await markWaitlistInvited(email, key.teamId);

    // Email it if SMTP is set up; otherwise the operator sends it by hand.
    const loginUrl = `${process.env.NEXTAUTH_URL ?? ""}/login`;
    const mail = await sendInviteEmail({ to: email, key: key.secret, loginUrl });

    // The secret is returned once, for the operator to send. It is not stored.
    return NextResponse.json({ email, secret: key.secret, teamId: key.teamId, emailed: mail.sent });
  } catch (err) {
    console.error("[waitlist:invite]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to invite this person" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) return NextResponse.json({ error: "Operator only" }, { status: 403 });

  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  try {
    await removeFromWaitlist(email.toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist:remove]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to remove this entry" }, { status: 500 });
  }
}
