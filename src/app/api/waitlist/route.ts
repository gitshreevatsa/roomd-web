import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/redis";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(req: NextRequest) {
  try {
    const { email } = schema.parse(await req.json());
    await addToWaitlist(email.toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error("[waitlist]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not join the waitlist" }, { status: 500 });
  }
}
