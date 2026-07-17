import { NextRequest, NextResponse } from "next/server";
import {
  addToWaitlist,
  getOrgInvite,
  getUserByEmail,
  getWaitlistEntry,
} from "@/lib/redis";
import type { WaitlistJoinStatus } from "@/types";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email().max(254) });

/**
 * Join the public waitlist, or tell the caller why they should not.
 * Does not add emails that already have access, an invite, or a pending row.
 */
export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail } = schema.parse(await req.json());
    const email = rawEmail.toLowerCase();

    const user = await getUserByEmail(email);
    if (user) {
      if (user.disabledAt) {
        return NextResponse.json({
          ok: false,
          status: "declined" as WaitlistJoinStatus,
          message: "This account is disabled. Contact the operator if that seems wrong.",
        });
      }
      return NextResponse.json({
        ok: true,
        status: "already_user" as WaitlistJoinStatus,
        message: "You're already in. Sign in with this email.",
      });
    }

    const orgInvite = await getOrgInvite(email);
    if (
      orgInvite &&
      (orgInvite.status === "delivered" || orgInvite.status === "pending_delivery")
    ) {
      return NextResponse.json({
        ok: true,
        status: "already_invited" as WaitlistJoinStatus,
        message:
          "You're already invited. Check your email for the key, then sign in.",
      });
    }

    const waitlist = await getWaitlistEntry(email);
    if (waitlist) {
      if (waitlist.status === "invited") {
        return NextResponse.json({
          ok: true,
          status: "already_invited" as WaitlistJoinStatus,
          message:
            "You're already invited. Check your email for the key, then sign in.",
        });
      }
      if (waitlist.status === "pending") {
        return NextResponse.json({
          ok: true,
          status: "already_pending" as WaitlistJoinStatus,
          message: "You're already on the list. We'll email you when a spot opens.",
        });
      }
      if (waitlist.status === "declined" || waitlist.status === "revoked") {
        return NextResponse.json({
          ok: false,
          status: "declined" as WaitlistJoinStatus,
          message: "This email isn't eligible for the waitlist right now.",
        });
      }
    }

    await addToWaitlist(email);
    return NextResponse.json({
      ok: true,
      status: "joined" as WaitlistJoinStatus,
      message: "You're on the list. We'll email a key when a spot opens.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error("[waitlist]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not join the waitlist" }, { status: 500 });
  }
}
