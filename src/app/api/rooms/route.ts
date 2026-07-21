import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { createRoom } from "@/lib/redis";
import { getRoomSummaries } from "@/lib/rooms";
import { claimRoom } from "@/lib/roomd";
import { slugify } from "@/lib/utils";
import { track, captureError } from "@/lib/telemetry";
import { nanoid } from "nanoid";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(64),
  roomId: z.string().regex(/^[a-z0-9-]+$/).max(32).optional(),
});

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rooms = await getRoomSummaries(identity.userId, identity.apiKey);
  return NextResponse.json({ rooms });
}

export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let name: string;
  let requestedId: string | undefined;
  try {
    ({ name, roomId: requestedId } = createSchema.parse(await req.json()));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    let roomId = (requestedId ?? slugify(name)) || nanoid(8).toLowerCase();

    // Room ids are global in roomd, owned by whichever team touches them
    // first. Claim it now so the dashboard never hands out an id that belongs
    // to another team, and suffix it if the name is already taken.
    if (!(await claimRoom(roomId, identity.apiKey))) {
      roomId = `${roomId.slice(0, 27)}-${nanoid(4).toLowerCase()}`;
      if (!(await claimRoom(roomId, identity.apiKey))) {
        return NextResponse.json(
          { error: "Could not allocate a room id. Try a different name." },
          { status: 409 }
        );
      }
    }

    await createRoom({
      roomId,
      name,
      createdBy: identity.userId,
      createdAt: new Date().toISOString(),
    });

    track("room_created", { userId: identity.userId, teamId: identity.teamId, roomId });
    return NextResponse.json({ roomId, name }, { status: 201 });
  } catch (err) {
    captureError(err, { route: "rooms:create", userId: identity.userId });
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
