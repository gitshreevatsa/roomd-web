import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { createAdminKey, listAdminKeys } from "@/lib/roomd";

export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { note } = (await req.json().catch(() => ({}))) as { note?: string };

  try {
    // The new secret is returned once, to be copied by the operator. It is not
    // persisted anywhere in roomd-web.
    const key = await createAdminKey(identity.apiKey, note);
    return NextResponse.json(key, { status: 201 });
  } catch (err) {
    console.error("[keys:create]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const keys = await listAdminKeys(identity.apiKey);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error("[keys:list]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list keys" }, { status: 500 });
  }
}
