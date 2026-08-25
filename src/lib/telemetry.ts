/**
 * Product + error telemetry for roomd-web.
 *
 * - Always writes scrubbed JSON to stdout (Vercel log drains)
 * - PostHog when NEXT_PUBLIC_POSTHOG_KEY / POSTHOG_KEY is set
 * - Sentry when SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is set
 */

import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { posthogCapture } from "@/lib/posthog-server";

type Props = Record<string, string | number | boolean | undefined | null>;

function scrub(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (/key|secret|token|password|authorization|apikey/i.test(k)) continue;
    if (typeof v === "string" && v.length > 8 && /^[A-Za-z0-9_-]{20,}$/.test(v)) continue;
    out[k] = v;
  }
  return out;
}

function distinctId(props: Props): string {
  const id = props.userId ?? props.teamId ?? props.distinctId;
  return typeof id === "string" && id ? id : "anonymous";
}

/** Prefer inbound X-Request-Id; otherwise mint one for this request. */
export function requestIdFrom(req: Request): string {
  const incoming = req.headers.get("x-request-id")?.trim();
  if (incoming && incoming.length > 0 && incoming.length <= 128) return incoming;
  return randomUUID();
}

function write(level: "info" | "warn" | "error", event: string, props: Props): void {
  const scrubbed = scrub(props);
  const payload = {
    level,
    ts: new Date().toISOString(),
    service: "roomd-web",
    event,
    ...scrubbed,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Structured audit / product event. Safe to call from API routes. */
export function track(event: string, props: Props = {}): void {
  write("info", event, props);

  try {
    posthogCapture(distinctId(props), event, scrub(props));
  } catch {
    /* never break the request on analytics */
  }
}

/** Non-fatal operational signal (rate-limit backend down, soft failures). */
export function logWarn(event: string, props: Props = {}): void {
  write("warn", event, props);
}

/** Report an unexpected error without leaking secrets. */
export function captureError(err: unknown, context: Props = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  write("error", "error", { err: message, ...context });

  try {
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(scrub(context))) {
        scope.setExtra(k, v);
      }
      Sentry.captureException(err instanceof Error ? err : new Error(message));
    });
  } catch {
    /* ignore */
  }
}
