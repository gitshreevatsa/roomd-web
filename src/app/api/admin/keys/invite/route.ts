import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity } from "@/lib/session";
import { createAdminKey } from "@/lib/roomd";
import { sendInviteEmail } from "@/lib/mail";

const schema = z.object({ email: z.string().trim().email().max(254) });

/**
 * POST invite a teammate to YOUR org.
 *
 * Creates a dynamic key under the caller's own team (so the teammate shares the
 * caller's rooms) and emails it to them if SMTP is configured. Any logged-in
 * user can invite into their own team; this is not operator-gated.
 */
export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let email: string;
  try {
    email = schema.parse(await req.json()).email.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const key = await createAdminKey(identity.apiKey, `Teammate: ${email}`);
    const loginUrl = `${process.env.NEXTAUTH_URL ?? ""}/login`;
    const mail = await sendInviteEmail({
      to: email,
      key: key.secret,
      loginUrl,
      context: "team",
    });
    return NextResponse.json({ email, secret: key.secret, emailed: mail.sent });
  } catch (err) {
    console.error("[keys:invite]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to invite teammate" }, { status: 500 });
  }
}
