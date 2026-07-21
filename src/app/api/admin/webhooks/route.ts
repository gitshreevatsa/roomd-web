import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { createWebhook, listWebhooks } from "@/lib/roomd";

function assertHttpsPublicUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Invalid URL";
  }
  if (url.protocol !== "https:") return "URL must use https";
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "metadata.google.internal"
  ) {
    return "URL host is not allowed";
  }
  return null;
}

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const webhooks = await listWebhooks(identity.apiKey);
    return NextResponse.json({ webhooks });
  } catch (err) {
    console.error("[webhooks:list]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list webhooks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { url?: string; roomId?: string };
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const urlError = assertHttpsPublicUrl(body.url);
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });

  try {
    const hook = await createWebhook(identity.apiKey, body.url, body.roomId);
    return NextResponse.json(hook, { status: 201 });
  } catch (err) {
    console.error("[webhooks:create]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}
