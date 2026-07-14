import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { readPlan, listContext, readEvents, getPresence, ROOM_ACCESS_DENIED } from "@/lib/roomd";

export async function GET(
  _req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = params;

  try {
    // roomd enforces room ownership by team, so a room belonging to
    // another team fails here rather than returning someone else's data.
    const [plan, context, events, agents] = await Promise.all([
      readPlan(roomId, identity.apiKey),
      listContext(roomId, identity.apiKey),
      readEvents(roomId, identity.apiKey, 50),
      getPresence(roomId, identity.apiKey),
    ]);

    return NextResponse.json({ plan, context, events, agents });
  } catch (err) {
    if (err instanceof Error && err.message.includes(ROOM_ACCESS_DENIED)) {
      return NextResponse.json({ error: ROOM_ACCESS_DENIED }, { status: 403 });
    }
    console.error("[room data]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to fetch room data" }, { status: 500 });
  }
}
