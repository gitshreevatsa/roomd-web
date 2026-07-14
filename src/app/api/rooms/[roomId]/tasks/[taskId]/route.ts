import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { updateTask, ROOM_ACCESS_DENIED } from "@/lib/roomd";
import { z } from "zod";

// status is required: roomd's update_task rejects a call without it.
const schema = z.object({
  status: z.enum(["pending", "in_progress", "done", "blocked"]),
  owner: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string; taskId: string } }
) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let patch: z.infer<typeof schema>;
  try {
    patch = schema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await updateTask(params.roomId, params.taskId, patch, identity.apiKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes(ROOM_ACCESS_DENIED)) {
      return NextResponse.json({ error: ROOM_ACCESS_DENIED }, { status: 403 });
    }
    console.error("[task:update]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
