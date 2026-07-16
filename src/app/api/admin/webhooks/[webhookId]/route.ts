import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { deleteWebhook } from "@/lib/roomd";

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
    console.error("[webhooks:delete]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
