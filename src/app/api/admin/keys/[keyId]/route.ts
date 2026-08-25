import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { revokeAdminKey } from "@/lib/roomd";
import { captureError } from "@/lib/telemetry";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // roomd refuses to revoke a key belonging to another team.
    await revokeAdminKey(params.keyId, identity.apiKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    captureError(err, { route: "keys:revoke" });
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
