/**
 * Product + error telemetry for roomd-web.
 *
 * - Always writes scrubbed JSON to stdout (Vercel log drains)
 * - PostHog when NEXT_PUBLIC_POSTHOG_KEY / POSTHOG_KEY is set
 * - Sentry when SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is set
 */

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

/** Structured audit / product event. Safe to call from API routes. */
export function track(event: string, props: Props = {}): void {
  const scrubbed = scrub(props);
  const payload = {
    level: "info",
    ts: new Date().toISOString(),
    service: "roomd-web",
    event,
    ...scrubbed,
  };
  console.info(JSON.stringify(payload));

  try {
    posthogCapture(distinctId(props), event, scrubbed);
  } catch {
    /* never break the request on analytics */
  }
}

/** Report an unexpected error without leaking secrets. */
export function captureError(err: unknown, context: Props = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const scrubbed = scrub(context);
  console.error(
    JSON.stringify({
      level: "error",
      ts: new Date().toISOString(),
      service: "roomd-web",
      err: message,
      ...scrubbed,
    }),
  );

  try {
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(scrubbed)) {
        scope.setExtra(k, v);
      }
      Sentry.captureException(err instanceof Error ? err : new Error(message));
    });
  } catch {
    /* ignore */
  }
}
