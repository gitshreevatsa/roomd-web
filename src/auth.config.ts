import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config, shared by the middleware and the full server auth.
 *
 * The middleware runs in the edge runtime, which forbids Node built-ins like
 * `crypto`. So this file must not import anything that pulls those in: no
 * providers (they reach password hashing and the Redis client), no Node
 * modules. It carries only what the edge needs to read a session from the JWT.
 *
 * The full config in `auth.ts` spreads this and adds the providers and the
 * `signIn` callback, which run in the Node runtime where crypto is available.
 */
declare module "next-auth" {
  interface User {
    teamId?: string;
  }
  interface Session {
    user: {
      id: string;
      teamId: string;
      email?: string | null;
      name?: string | null;
    };
  }
}

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real providers are added in auth.ts
  callbacks: {
    // The API key is deliberately never placed on the token or the session.
    // Auth.js serves the session verbatim to the browser; the key is a
    // team-wide bearer credential and stays in Redis (see lib/session.ts).
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.teamId = user.teamId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.teamId = token.teamId as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
