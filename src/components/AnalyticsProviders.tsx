"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

function PostHogInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!posthogKey || posthog.__loaded) return;
    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
    });
  }, []);

  if (!posthogKey) return <>{children}</>;
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

/**
 * Client analytics shell: PostHog (optional) + Vercel Analytics / Speed Insights.
 * Safe with keys unset — children still render.
 */
export function AnalyticsProviders({ children }: { children: React.ReactNode }) {
  return (
    <PostHogInit>
      {children}
      <Analytics />
      <SpeedInsights />
    </PostHogInit>
  );
}
