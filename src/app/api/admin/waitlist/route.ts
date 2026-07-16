import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity, isOperator } from "@/lib/session";
import {
  listWaitlist,
  markWaitlistInvited,
  markWaitlistDeclined,
} from "@/lib/redis";
import { provisionTeamKey } from "@/lib/roomd";
import { waitlistTeamId } from "@/lib/teams";
import { sendInviteEmail } from "@/lib/mail";
import { buildInviteEmailHtml } from "@/lib/email/invite-template";

/**
 * GET  list the waitlist (operator only).
 * POST actions:
 *   prepare — mint a key, mark accepted, return secret + email HTML (no send)
 *   send    — email an already-prepared key
 *   decline — reject a pending request (no key)
 */

const prepareSchema = z.object({
  action: z.literal("prepare"),
  email: z.string().trim().email().max(254),
});

const sendSchema = z.object({
  action: z.literal("send"),
  email: z.string().trim().email().max(254),
  secret: z.string().min(8).max(256),
});

const declineSchema = z.object({
  action: z.literal("decline"),
  email: z.string().trim().email().max(254),
});

const bodySchema = z.discriminatedUnion("action", [
  prepareSchema,
  sendSchema,
  declineSchema,
]);

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

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = body.email.toLowerCase();

  if (body.action === "decline") {
    try {
      await markWaitlistDeclined(email);
      return NextResponse.json({ email, status: "declined" });
    } catch (err) {
      console.error("[waitlist:decline]", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Failed to decline" }, { status: 500 });
    }
  }

  if (body.action === "send") {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? "https://app.roomd.sh"}/login`;
    try {
      const mail = await sendInviteEmail({
        to: email,
        key: body.secret,
        loginUrl,
      });
      return NextResponse.json({ email, emailed: mail.sent, reason: mail.reason });
    } catch (err) {
      console.error("[waitlist:send]", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
  }

  // prepare — issue key + preview; do not email yet
  const masterKey = process.env.ROOMD_MASTER_KEY;
  if (!masterKey) {
    return NextResponse.json(
      { error: "ROOMD_MASTER_KEY is not configured, so teams cannot be provisioned." },
      { status: 500 },
    );
  }

  try {
    const key = await provisionTeamKey(waitlistTeamId(email), masterKey, email);
    await markWaitlistInvited(email, key.teamId);

    const loginUrl = `${process.env.NEXTAUTH_URL ?? "https://app.roomd.sh"}/login`;
    const who = "You have been invited";
    const scope = "You get your own private workspace.";
    const html = buildInviteEmailHtml({
      key: key.secret,
      loginUrl,
      who,
      scope,
    });
    const text =
      `${who} to roomd.\n\n` +
      `Sign in at ${loginUrl} with this key:\n\n${key.secret}\n\n` +
      `${scope} Keep the key somewhere safe.`;

    return NextResponse.json({
      email,
      secret: key.secret,
      teamId: key.teamId,
      loginUrl,
      html,
      text,
      emailed: false,
    });
  } catch (err) {
    console.error("[waitlist:prepare]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to prepare invite" }, { status: 500 });
  }
}
