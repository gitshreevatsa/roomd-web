import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// The middleware runs in the edge runtime, so it uses only the edge-safe config
// (no providers, no Node crypto). This attaches the decoded session to the
// request; page and API guards do the actual gating.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Everything except the public routes, Next internals, and any static file
    // (a path segment with a dot: the whitepaper HTML/PDF, favicon, images).
    "/((?!api/auth|_next/static|_next/image|login|register|waitlist|.*\\..*).*)",
  ],
};
