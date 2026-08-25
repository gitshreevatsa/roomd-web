import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { deleteWebhook } from "@/lib/roomd";
import { captureError } from "@/lib/telemetry";

export async function DELETE(
  _req: Request,
  { params }: { params: { webhookId: string } },
) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await deleteWebhook(identity.apiKey, params.webhookId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    captureError(err, { route: "webhooks:delete" });
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
