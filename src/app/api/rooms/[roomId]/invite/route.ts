import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { createRoomInvite, listRoomInvites, revokeRoomInvite } from "@/lib/roomd";
import { z } from "zod";

const createSchema = z.object({
  expiresIn: z.number().int().positive().max(60 * 60 * 24 * 365).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { expiresIn } = createSchema.parse(body);
    const invite = await createRoomInvite(params.roomId, identity.apiKey, expiresIn);
    return NextResponse.json(invite, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[invite:create]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const invites = await listRoomInvites(params.roomId, identity.apiKey);
    return NextResponse.json({ invites });
  } catch (err) {
    console.error("[invite:list]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list invites" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokenId = new URL(req.url).searchParams.get("tokenId");
  if (!tokenId) return NextResponse.json({ error: "tokenId required" }, { status: 400 });

  try {
    await revokeRoomInvite(tokenId, params.roomId, identity.apiKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[invite:revoke]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
  }
}
