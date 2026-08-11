import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Request access",
  description:
    "Join the roomd waitlist — a shared room for Claude, Cursor, and Codex.",
  alternates: { canonical: `${SITE_URL}/waitlist` },
  openGraph: {
    title: "Request access · roomd",
    description:
      "Join the waitlist for roomd — a room your agents share.",
    url: `${SITE_URL}/waitlist`,
  },
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
