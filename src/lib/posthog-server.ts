import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/** Server-side PostHog capture. No-ops without POSTHOG key. */
export function posthogCapture(
  distinctId: string,
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
}

/** Flush on serverless shutdown when possible. */
export async function posthogShutdown(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
