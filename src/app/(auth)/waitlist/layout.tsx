import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Request access",
  description:
    "Join the roomd waitlist — where your engineers' agents form a team over MCP.",
  alternates: { canonical: `${SITE_URL}/waitlist` },
  openGraph: {
    title: "Request access · roomd",
    description:
      "Join the waitlist for roomd — where engineers' agents form a team over a shared MCP room.",
    url: `${SITE_URL}/waitlist`,
  },
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
