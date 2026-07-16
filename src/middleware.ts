import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// The middleware runs in the edge runtime, so it uses only the edge-safe config
// (no providers, no Node crypto). This attaches the decoded session to the
// request; page and API guards do the actual gating.
const { auth } = NextAuth(authConfig);

const APP_HOSTS = new Set(["app.roomd.sh"]);
const MARKETING_HOSTS = new Set(["roomd.sh", "www.roomd.sh"]);

/** Dashboard origin — auth cookies and app routes live here. */
function appOrigin(): string {
  const fallback = "https://app.roomd.sh";
  const raw = (process.env.NEXTAUTH_URL ?? fallback).replace(/\/$/, "");
  try {
    const host = new URL(raw).hostname.toLowerCase();
    // Guard against a mis-set NEXTAUTH_URL=https://roomd.sh (redirect loop).
    if (MARKETING_HOSTS.has(host)) return fallback;
  } catch {
    return fallback;
  }
  return raw;
}

/**
 * Host split:
 *   roomd.sh     → marketing (landing, protocol, waitlist)
 *   app.roomd.sh → product (login, dashboard, rooms)
 *
 * Localhost / *.vercel.app keep both surfaces on one host.
 */
export default auth((req) => {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const { pathname, search } = req.nextUrl;

  // app.roomd.sh — never show the marketing landing
  if (APP_HOSTS.has(host) && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = req.auth?.user ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  // roomd.sh — send product routes to the app host
  if (MARKETING_HOSTS.has(host)) {
    const appPrefixes = ["/login", "/register", "/dashboard", "/admin", "/owner", "/rooms"];
    const isAppRoute = appPrefixes.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (isAppRoute) {
      return NextResponse.redirect(new URL(`${pathname}${search}`, appOrigin()));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except NextAuth handlers, Next internals, and static files
    // (a path segment with a dot: whitepaper HTML/PDF, favicon, images).
    "/((?!api/auth|_next/static|_next/image|.*\\..*).*)",
  ],
};
