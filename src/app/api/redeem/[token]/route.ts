import { NextResponse } from "next/server";
import { consumeRedeemToken } from "@/lib/redeem";

/**
 * GET /api/redeem/:token — return the API secret once, then delete the token.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token } = await Promise.resolve(params);
  try {
    const payload = await consumeRedeemToken(token);
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "Link expired or already used" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      secret: payload.secret,
      email: payload.email,
      teamId: payload.teamId,
      warning: "copy now — this secret will not be shown again",
    });
  } catch (err) {
    console.error("[redeem]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Redeem failed" }, { status: 500 });
  }
}
