import { describe, it, expect } from "vitest";
import { authConfig } from "@/auth.config";

/**
 * Auth.js serves the session object verbatim from /api/auth/session to any
 * logged-in browser. Anything the session() callback attaches is therefore
 * public to that user's client.
 *
 * The roomd apiKey is a bearer credential for the whole team. It must not
 * reach the JWT or the Session. This drives the real jwt/session callbacks,
 * which live in the edge-safe base config, to prove it. Those callbacks pull in
 * nothing external, so no mocks are needed.
 */

const SECRET = "sk-live-team-wide-bearer-token";

/** A user object as the apikey/email providers return it from authorize(). */
const authorizedUser = {
  id: "user-1",
  teamId: "team-1",
  email: "a@example.com",
  name: "A",
};

describe("jwt callback", () => {
  it("carries identity but not the api key", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = await (authConfig.callbacks!.jwt as any)({
      token: {},
      user: authorizedUser,
    });

    expect(token.id).toBe("user-1");
    expect(token.teamId).toBe("team-1");
    expect(JSON.stringify(token)).not.toContain(SECRET);
    expect(token).not.toHaveProperty("apiKey");
  });

  it("drops an api key even if a provider mistakenly returns one", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = await (authConfig.callbacks!.jwt as any)({
      token: {},
      user: { ...authorizedUser, apiKey: SECRET },
    });

    expect(token).not.toHaveProperty("apiKey");
    expect(JSON.stringify(token)).not.toContain(SECRET);
  });
});

describe("session callback", () => {
  it("exposes only id and teamId to the browser", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await (authConfig.callbacks!.session as any)({
      session: { user: { email: "a@example.com", name: "A" } },
      token: { id: "user-1", teamId: "team-1", apiKey: SECRET },
    });

    expect(session.user.id).toBe("user-1");
    expect(session.user.teamId).toBe("team-1");
    expect(session.user).not.toHaveProperty("apiKey");
    expect(JSON.stringify(session)).not.toContain(SECRET);
  });
});
