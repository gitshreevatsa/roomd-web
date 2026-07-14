import { describe, it, expect } from "vitest";
import { oauthTeamId, emailTeamId } from "@/lib/teams";
import { slugify, maskSecret, formatRelativeTime } from "@/lib/utils";

/** The rule roomd enforces in POST /admin/keys/provision. */
const TEAM_ID = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

describe("oauthTeamId", () => {
  it("is accepted by roomd's teamId rule", () => {
    expect(oauthTeamId("google", "1234567890")).toMatch(TEAM_ID);
    expect(oauthTeamId("github", "99")).toMatch(TEAM_ID);
  });

  it("is stable, so concurrent sign-ins converge on one team", () => {
    expect(oauthTeamId("google", "abc")).toBe(oauthTeamId("google", "abc"));
  });

  it("separates providers that happen to share an account id", () => {
    expect(oauthTeamId("google", "1")).not.toBe(oauthTeamId("github", "1"));
  });

  it("does not embed the raw account id", () => {
    expect(oauthTeamId("github", "1234567890")).not.toContain("1234567890");
  });

  it("survives an account id with characters the rule forbids", () => {
    expect(oauthTeamId("google", "USER@example.com/../x")).toMatch(TEAM_ID);
  });
});

describe("emailTeamId", () => {
  it("is accepted by roomd's teamId rule", () => {
    for (let i = 0; i < 50; i++) expect(emailTeamId()).toMatch(TEAM_ID);
  });

  it("is unique per call", () => {
    expect(emailTeamId()).not.toBe(emailTeamId());
  });
});

describe("slugify", () => {
  it("turns a room name into a safe room id", () => {
    expect(slugify("My SaaS Backend")).toBe("my-saas-backend");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("Foo!!  ??Bar")).toBe("foo-bar");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("-hello-")).toBe("hello");
  });

  it("caps the length at 32 characters", () => {
    expect(slugify("a".repeat(50)).length).toBe(32);
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("maskSecret", () => {
  it("reveals only the last four characters", () => {
    expect(maskSecret("abcdefghij")).toBe("****ghij");
  });

  it("reveals nothing for a very short secret", () => {
    expect(maskSecret("abcd")).toBe("****");
  });
});

describe("formatRelativeTime", () => {
  it("reads 'never' with no timestamp", () => {
    expect(formatRelativeTime(null)).toBe("never");
  });

  it("counts down in the largest sensible unit", () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(formatRelativeTime(ago(5_000))).toMatch(/^\d+s ago$/);
    expect(formatRelativeTime(ago(5 * 60_000))).toBe("5m ago");
    expect(formatRelativeTime(ago(3 * 3_600_000))).toBe("3h ago");
    expect(formatRelativeTime(ago(2 * 86_400_000))).toBe("2d ago");
  });
});
