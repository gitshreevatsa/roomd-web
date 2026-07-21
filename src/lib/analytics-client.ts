/**
 * Browser-side product events (PostHog). No-ops without NEXT_PUBLIC_POSTHOG_KEY.
 * Uses the same posthog-js singleton as AnalyticsProviders.
 */

"use client";

import posthog from "posthog-js";

type Props = Record<string, string | number | boolean | undefined | null>;

function scrub(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (/key|secret|token|password|authorization|apikey/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

export function trackClient(event: string, props: Props = {}): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    // posthog-js buffers until init when using the shared singleton.
    posthog.capture(event, scrub(props));
  } catch {
    /* ignore */
  }
}
