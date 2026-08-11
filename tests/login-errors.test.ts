import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { validateApiKey } from "@/lib/roomd";

describe("loginErrorMessage", () => {
  it("maps known codes", () => {
    expect(loginErrorMessage("rate_limited")).toMatch(/rate-limiting/i);
    expect(loginErrorMessage("storage_unavailable")).toMatch(/Redis/i);
    expect(loginErrorMessage("invalid_key")).toMatch(/Invalid API key/i);
  });

  it("falls back for unknown codes", () => {
    expect(loginErrorMessage("nope")).toMatch(/Sign-in failed/i);
    expect(loginErrorMessage(undefined)).toMatch(/Sign-in failed/i);
  });
});

describe("validateApiKey", () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.ROOMD_URL;

  beforeEach(() => {
    process.env.ROOMD_URL = "https://api.example.test";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.ROOMD_URL = originalUrl;
    vi.restoreAllMocks();
  });

  it("reports rate_limited on 429", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 429 })) as typeof fetch;
    await expect(validateApiKey("secret")).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("reports invalid_key on 401", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 401 })) as typeof fetch;
    await expect(validateApiKey("secret")).resolves.toEqual({
      ok: false,
      reason: "invalid_key",
    });
  });

  it("reports api_unreachable when fetch throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as typeof fetch;
    await expect(validateApiKey("secret")).resolves.toEqual({
      ok: false,
      reason: "api_unreachable",
    });
  });

  it("returns teamId on success", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ teamId: "owner" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as typeof fetch;
    await expect(validateApiKey("secret")).resolves.toEqual({
      ok: true,
      teamId: "owner",
    });
  });
});
