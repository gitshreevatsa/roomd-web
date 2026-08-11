/** Stable codes returned to the login UI via Auth.js `result.code`. */
export type LoginErrorCode =
  | "invalid_key"
  | "rate_limited"
  | "too_many_attempts"
  | "api_unreachable"
  | "api_misconfigured"
  | "storage_unavailable"
  | "account_disabled";

const MESSAGES: Record<LoginErrorCode, string> = {
  invalid_key:
    "Invalid API key. Use the secret only (not owner:…), and check for extra spaces.",
  rate_limited:
    "API is rate-limiting this key right now (or Redis is unavailable). Wait a minute and try again — or check Upstash / RATE_LIMIT_PER_MINUTE.",
  too_many_attempts:
    "Too many login attempts from this network. Wait about a minute and try again.",
  api_unreachable:
    "Can't reach the roomd API. Check ROOMD_URL on Vercel and that api.roomd.sh is healthy.",
  api_misconfigured:
    "Server misconfigured: ROOMD_URL is missing. Set it on Vercel and redeploy.",
  storage_unavailable:
    "Can't reach Redis (Upstash). Login needs working UPSTASH_REDIS_* credentials.",
  account_disabled: "This account has been disabled. Contact the operator.",
};

/** Map Auth.js `code` (or unknown) to a user-facing login message. */
export function loginErrorMessage(code: string | undefined | null): string {
  if (code && code in MESSAGES) return MESSAGES[code as LoginErrorCode];
  return "Sign-in failed. Check your API key and try again.";
}
