import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity, isOperator } from "@/lib/session";
import { getUserById, updateUser } from "@/lib/redis";
import {
  generateTotpSecret,
  operatorMfaRequired,
  totpUri,
  verifyTotp,
} from "@/lib/totp";
import { appendAudit } from "@/lib/audit";

/**
 * Operator MFA enrollment / verification.
 * POST { action: "enroll" } → { secret, uri }
 * POST { action: "confirm", token } → enables MFA
 * POST { action: "verify", token } → { ok } for session checks
 */

export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity || !isOperator(identity)) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    token?: string;
  };
  const user = await getUserById(identity.userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "enroll") {
    const secret = generateTotpSecret();
    await updateUser(user.id, { totpSecret: secret });
    return NextResponse.json({
      secret,
      uri: totpUri(secret, user.email ?? user.id),
      required: operatorMfaRequired(),
    });
  }

  if (body.action === "confirm") {
    if (!user.totpSecret || !body.token || !verifyTotp(user.totpSecret, body.token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    await updateUser(user.id, { totpEnabledAt: new Date().toISOString() });
    await appendAudit({
      actorUserId: user.id,
      actorTeamId: user.teamId,
      action: "operator.bootstrap",
      meta: { mfa: "enabled" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "verify") {
    if (!user.totpSecret || !user.totpEnabledAt) {
      if (operatorMfaRequired()) {
        return NextResponse.json({ error: "MFA enrollment required" }, { status: 403 });
      }
      return NextResponse.json({ ok: true, mfa: false });
    }
    if (!body.token || !verifyTotp(user.totpSecret, body.token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, mfa: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
