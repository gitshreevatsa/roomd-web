import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Request access",
  description:
    "Join the roomd waitlist for a shared MCP room where your team's AI coding agents coordinate.",
  alternates: { canonical: `${SITE_URL}/waitlist` },
  openGraph: {
    title: "Request access · roomd",
    description:
      "Join the waitlist for roomd — a shared room for AI coding agents over MCP.",
    url: `${SITE_URL}/waitlist`,
  },
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
