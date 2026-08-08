import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createUser,
  getUserByEmail,
  getWaitlistEntry,
  getOrgInvite,
  updateUser,
} from "@/lib/redis";
import { provisionTeamKey } from "@/lib/roomd";
import { hashPassword } from "@/lib/password";
import { emailTeamId } from "@/lib/teams";
import { AUTH_MODE } from "@/lib/auth";
import { checkWebRateLimit, clientIp, rateLimitBucket } from "@/lib/ratelimit";
import { track, captureError } from "@/lib/telemetry";

const schema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

/**
 * POST /api/auth/register
 *
 * Creates an email/password account and provisions an isolated roomd team.
 * Invite-only unless ALLOW_OPEN_SIGNUP=true.
 *
 * Identity v2 / P1-7: if the email already has a user (e.g. from access prepare),
 * link the password to that record — never mint a second team for the same human.
 */
export async function POST(req: NextRequest) {
  if (AUTH_MODE === "apikey") {
    return NextResponse.json(
      { error: "Registration is closed. This deployment is invite only." },
      { status: 403 },
    );
  }

  const ip = clientIp(req);
  const limited = await checkWebRateLimit(rateLimitBucket("register", ip), 5);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid name, email, or password" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = parsed.email.toLowerCase();

  if (process.env.ALLOW_OPEN_SIGNUP !== "true") {
    const wait = await getWaitlistEntry(email);
    const org = await getOrgInvite(email);
    const invited =
      wait?.status === "invited" ||
      (org && (org.status === "delivered" || org.status === "pending_delivery"));
    if (!invited) {
      return NextResponse.json(
        { error: "Registration requires an invite" },
        { status: 403 },
      );
    }
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    if (existing.disabledAt) {
      return NextResponse.json({ error: "Could not create account" }, { status: 403 });
    }
    if (existing.passwordHash) {
      return NextResponse.json({ error: "Could not create account" }, { status: 409 });
    }
    try {
      const passwordHash = await hashPassword(parsed.password);
      const authMethods = existing.authMethods.includes("email")
        ? existing.authMethods
        : ([...existing.authMethods, "email"] as typeof existing.authMethods);
      await updateUser(existing.id, {
        passwordHash,
        name: parsed.name ?? existing.name,
        authMethods,
      });
      track("register_linked", { teamId: existing.teamId });
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (err) {
      captureError(err, { route: "register:link" });
      return NextResponse.json({ error: "Could not create account" }, { status: 500 });
    }
  }

  try {
    const masterKey = process.env.ROOMD_MASTER_KEY;
    if (!masterKey) throw new Error("ROOMD_MASTER_KEY is not configured");

    // Prefer team id already stored on the invite/waitlist entry (from prepare).
    const wait = await getWaitlistEntry(email);
    const org = await getOrgInvite(email);
    const invitedTeamId = wait?.teamId ?? org?.teamId;
    const teamId = invitedTeamId || emailTeamId();

    const keyData = await provisionTeamKey(teamId, masterKey, email);
    const passwordHash = await hashPassword(parsed.password);

    await createUser({
      email,
      name: parsed.name,
      passwordHash,
      teamId: keyData.teamId,
      apiKey: keyData.secret,
      authMethods: ["email"],
      createdAt: new Date().toISOString(),
    });

    track("register_success", { teamId: keyData.teamId });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    captureError(err, { route: "register" });
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }
}
