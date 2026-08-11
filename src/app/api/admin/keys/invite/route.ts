import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity, isOperator } from "@/lib/session";
import { createAdminKey, listAdminKeys } from "@/lib/roomd";
import { sendInviteEmail } from "@/lib/mail";
import { checkWebRateLimit, clientIp, rateLimitBucket } from "@/lib/ratelimit";
import { limitsForPlan } from "@/lib/plans";
import {
  getUserByEmail,
  getUserById,
  listTeamMemberIds,
  savePendingTeammateInvite,
  updateUser,
  upsertMembership,
} from "@/lib/redis";
import { track, captureError } from "@/lib/telemetry";

const schema = z.object({ email: z.string().trim().email().max(254) });

const HOUR = 60 * 60;

/**
 * POST invite a teammate to YOUR org.
 *
 * Creates a dynamic key under the caller's own team (so the teammate shares the
 * caller's rooms) and emails the API key if SMTP is configured.
 *
 * Identity v2: does NOT share/overwrite the caller's user record. Optionally
 * attaches membership to an existing email user, or stores a pending invite so
 * first apiKey login creates a distinct person-record.
 *
 * Operator accounts cannot invite teammates onto the operator team (P1-6).
 * Invite new orgs via Owner → Invite instead (creates a separate team).
 */
export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isOperator(identity)) {
    // P1-6: operator team stays solo. New orgs get their own team via Owner → Invite.
    return NextResponse.json(
      {
        error:
          "Operator account cannot add teammates. To invite a new org, use Owner → Invite instead.",
      },
      { status: 403 },
    );
  }

  let email: string;
  try {
    email = schema.parse(await req.json()).email.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const ip = clientIp(req);
  const [ipLimit, teamLimit] = await Promise.all([
    checkWebRateLimit(rateLimitBucket("invite-ip", ip), 10, HOUR),
    checkWebRateLimit(rateLimitBucket("invite-team", identity.teamId), 5, HOUR),
  ]);
  if (!ipLimit.allowed || !teamLimit.allowed) {
    return NextResponse.json({ error: "Too many invites — try again later" }, { status: 429 });
  }

  try {
    const user = await getUserById(identity.userId);
    const limits = limitsForPlan(user?.plan);
    const existingKeys = await listAdminKeys(identity.apiKey);
    if (existingKeys.length >= limits.maxKeys) {
      return NextResponse.json(
        { error: `Team key limit reached (${limits.maxKeys})` },
        { status: 403 },
      );
    }

    const memberIds = await listTeamMemberIds(identity.teamId);
    if (memberIds.length >= limits.maxTeammates) {
      return NextResponse.json(
        { error: `Team seat limit reached (${limits.maxTeammates})` },
        { status: 403 },
      );
    }

    const key = await createAdminKey(identity.apiKey, `Teammate: ${email}`);

    const existing = await getUserByEmail(email);
    if (existing) {
      // Attach membership; store their personal apiKey on THEIR user only.
      await upsertMembership({
        userId: existing.id,
        teamId: identity.teamId,
        role: "member",
        createdAt: new Date().toISOString(),
      });
      await updateUser(existing.id, {
        apiKey: key.secret,
        teamId: identity.teamId,
        authMethods: existing.authMethods.includes("apikey")
          ? existing.authMethods
          : [...existing.authMethods, "apikey"],
      });
    } else {
      // First login with this key will create a distinct user + attach email.
      await savePendingTeammateInvite(key.secret, {
        email,
        teamId: identity.teamId,
      });
    }

    const loginUrl = `${process.env.NEXTAUTH_URL ?? ""}/login`;
    const mail = await sendInviteEmail({
      to: email,
      apiKey: key.secret,
      loginUrl,
      context: "team",
    });
    track("teammate_invite_sent", {
      userId: identity.userId,
      teamId: identity.teamId,
      emailed: mail.sent,
    });

    if (mail.sent) {
      return NextResponse.json({
        email,
        emailed: true,
      });
    }

    return NextResponse.json({
      email,
      secret: key.secret,
      emailed: false,
      warning: "copy now",
    });
  } catch (err) {
    captureError(err, { route: "keys:invite", userId: identity.userId });
    return NextResponse.json({ error: "Failed to invite teammate" }, { status: 500 });
  }
}
