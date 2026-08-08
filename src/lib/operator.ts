/**
 * Operator authorisation helpers (Identity v2).
 *
 * Kept free of NextAuth / Redis imports so unit tests can cover the pure logic.
 */

export interface ServerIdentity {
  userId: string;
  teamId: string;
  apiKey: string;
  /** Explicit operator flag from UserRecord (Identity v2). */
  isOperator?: boolean;
}

/** Comma-separated break-glass operator user ids (second operators). */
export function operatorUserIdsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const raw = env.OPERATOR_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Whether this identity is the deployment operator.
 *
 * Prefer the explicit `isOperator` flag on the user record. Break-glass second
 * operators can be listed in OPERATOR_USER_IDS. Ongoing authz never compares
 * apiKey === ROOMD_MASTER_KEY (that path only bootstraps the flag at login).
 */
export function isOperator(identity: ServerIdentity): boolean {
  if (identity.isOperator === true) return true;
  return operatorUserIdsFromEnv().has(identity.userId);
}
