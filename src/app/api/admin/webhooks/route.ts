import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/session";
import { createWebhook, listWebhooks } from "@/lib/roomd";

/**
 * Lightweight client-side filter for obvious bad targets.
 * Authoritative SSRF checks (DNS resolve + full RFC1918/link-local) live in
 * roomd's `assertSafeWebhookUrl` — do not treat this as sufficient alone.
 */
function assertHttpsPublicUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Invalid URL";
  }
  if (url.protocol !== "https:") return "URL must use https";
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host === "metadata.google"
  ) {
    return "URL host is not allowed";
  }
  // Literal IPv4: block loopback, RFC1918, link-local, unspecified.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      return "URL must not target a private IP";
    }
  }
  if (host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return "URL must not target a private IP";
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
