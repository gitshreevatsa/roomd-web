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

/** A teamId for a fresh email signup. Random, since there is no external id. */
export function emailTeamId(): string {
  const suffix = nanoid(16).toLowerCase().replace(/[^a-z0-9]/g, "0");
  return `team-${suffix}`;
}

/**
 * A teamId for a waitlisted email the operator invites.
 *
 * Deterministic in the email, so inviting the same person twice targets the same
 * isolated team (a re-issued key lands them back in their own workspace, not a
 * new empty one).
 */
export function waitlistTeamId(email: string): string {
  const digest = createHash("sha256")
    .update(`waitlist:${email.toLowerCase().trim()}`)
    .digest("hex")
    .slice(0, 16);
  return `team-${digest}`;
}
