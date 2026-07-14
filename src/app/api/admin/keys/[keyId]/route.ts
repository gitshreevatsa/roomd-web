import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { revokeAdminKey } from "@/lib/roomd";

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
    console.error("[keys:revoke]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
