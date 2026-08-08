import { createHash } from "crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOperator, type ServerIdentity } from "@/lib/operator";

/** Mirrors redis.apiKeyDigestHint without importing the Redis client. */
function apiKeyDigestHint(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 32);
}

describe("apiKeyDigestHint", () => {
  it("is stable and 32 hex chars", () => {
    const a = apiKeyDigestHint("sk-test-key");
    const b = apiKeyDigestHint("sk-test-key");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
  });

  it("separates different keys", () => {
    expect(apiKeyDigestHint("key-a")).not.toBe(apiKeyDigestHint("key-b"));
  });
});

describe("isOperator (Identity v2)", () => {
  const prev = process.env.OPERATOR_USER_IDS;

  beforeEach(() => {
    delete process.env.OPERATOR_USER_IDS;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.OPERATOR_USER_IDS;
    else process.env.OPERATOR_USER_IDS = prev;
  });

  const base: ServerIdentity = {
    userId: "user-1",
    teamId: "team-1",
    apiKey: "sk-anything",
  };

  it("uses the explicit flag, not apiKey === master", () => {
    process.env.ROOMD_MASTER_KEY = "sk-master";
    expect(isOperator({ ...base, apiKey: "sk-master" })).toBe(false);
    expect(isOperator({ ...base, isOperator: true })).toBe(true);
  });

  it("allows OPERATOR_USER_IDS break-glass", () => {
    process.env.OPERATOR_USER_IDS = "user-9, user-1";
    expect(isOperator(base)).toBe(true);
    expect(isOperator({ ...base, userId: "user-2" })).toBe(false);
  });
});
