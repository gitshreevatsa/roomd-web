import NextAuth from "next-auth";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
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

function ensureRequestId(req: NextRequest): string {
  const incoming = req.headers.get("x-request-id")?.trim();
  if (incoming && incoming.length > 0 && incoming.length <= 128) return incoming;
  return crypto.randomUUID();
}

/**
 * Host split for pages + request-id for API.
 *
 * Auth.js must NOT wrap /api/* — that caused null sessions (401) on Owner
 * invite while RSC pages still saw a valid session.
 */
const pageMiddleware = auth((req) => {
  const requestId = ensureRequestId(req);
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const { pathname, search } = req.nextUrl;

  // app.roomd.sh — never show the marketing landing
  if (APP_HOSTS.has(host) && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = req.auth?.user ? "/dashboard" : "/login";
    const res = NextResponse.redirect(url);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // roomd.sh — send product routes to the app host
  if (MARKETING_HOSTS.has(host)) {
    const appPrefixes = ["/login", "/register", "/dashboard", "/admin", "/owner", "/rooms"];
    const isAppRoute = appPrefixes.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (isAppRoute) {
      const res = NextResponse.redirect(new URL(`${pathname}${search}`, appOrigin()));
      res.headers.set("x-request-id", requestId);
      return res;
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const requestId = ensureRequestId(req);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-request-id", requestId);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-request-id", requestId);
    return res;
  }
  // Auth.js types this as an App Router handler; at runtime it is middleware.
  return (pageMiddleware as unknown as (
    req: NextRequest,
    event: NextFetchEvent,
  ) => ReturnType<typeof pageMiddleware>)(req, event);
}

export const config = {
  matcher: [
    // Pages (host split + session) and API (request id only).
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};
