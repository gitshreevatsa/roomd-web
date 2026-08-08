import { createHash } from "crypto";
import { nanoid } from "nanoid";

/**
 * teamId derivation. Server only: this module pulls in node:crypto.
 *
 * roomd accepts a teamId matching /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/,
 * so every value produced here has to land inside that rule.
 */

/**
 * Derive a teamId for an OAuth account.
 *
 * Hashing the provider account id normalises whatever the provider returns into
 * the allowed character set, stays stable across sign-ins so concurrent logins
 * converge on one team, and keeps the raw account id out of room ownership
 * records.
 */
export function oauthTeamId(provider: "google" | "github", externalId: string): string {
  const digest = createHash("sha256")
    .update(`${provider}:${externalId}`)
    .digest("hex")
    .slice(0, 16);
  return `oauth-${provider}-${digest}`;
}

/** A teamId for a fresh email signup or waitlist/org invite. Random each call. */
export function emailTeamId(): string {
  const suffix = nanoid(16).toLowerCase().replace(/[^a-z0-9]/g, "0");
  return `team-${suffix}`;
}

/**
 * @deprecated Do not use for new provisioning. Deterministic email→teamId let
 * re-invites after delete reopen the prior tenant's roomd data (P0-3).
 * Kept only for migration / lookup of OLD waitlist teams that were minted with
 * this hash before random `emailTeamId()` became the default.
 */
export function waitlistTeamId(email: string): string {
  const digest = createHash("sha256")
    .update(`waitlist:${email.toLowerCase().trim()}`)
    .digest("hex")
    .slice(0, 16);
  return `team-${digest}`;
}
