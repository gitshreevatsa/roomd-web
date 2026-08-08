import { Redis } from "@upstash/redis";

/**
 * Customer/operator-visible audit log for access-lifecycle events.
 * Requires identity v2 (per-person userId) for meaningful attribution.
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const AUDIT_MAX = parseInt(process.env.AUDIT_LOG_MAX ?? "5000", 10);

export type AuditAction =
  | "user.disable"
  | "user.enable"
  | "user.delete"
  | "keys.revoke_team"
  | "invites.revoke_team"
  | "keys.invite_teammate"
  | "access.prepare"
  | "access.redeem"
  | "membership.add"
  | "membership.remove"
  | "operator.bootstrap"
  | "billing.plan_change";

export interface AuditEntry {
  id: string;
  at: string;
  actorUserId: string | null;
  actorTeamId: string | null;
  action: AuditAction;
  targetTeamId?: string;
  targetUserId?: string;
  targetEmail?: string;
  meta?: Record<string, unknown>;
}

function teamKey(teamId: string) {
  return `app:audit:team:${teamId}`;
}

function globalKey() {
  return `app:audit:global`;
}

export async function appendAudit(entry: Omit<AuditEntry, "id" | "at"> & { id?: string; at?: string }): Promise<AuditEntry> {
  const full: AuditEntry = {
    ...entry,
    id: entry.id ?? `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? new Date().toISOString(),
  };
  const payload = JSON.stringify(full);
  const pipeline: Promise<unknown>[] = [redis.lpush(globalKey(), payload)];
  if (full.targetTeamId) pipeline.push(redis.lpush(teamKey(full.targetTeamId), payload));
  if (full.actorTeamId && full.actorTeamId !== full.targetTeamId) {
    pipeline.push(redis.lpush(teamKey(full.actorTeamId), payload));
  }
  await Promise.all(pipeline);
  // Bound list growth (best-effort).
  await Promise.all([
    redis.ltrim(globalKey(), 0, AUDIT_MAX - 1),
    full.targetTeamId ? redis.ltrim(teamKey(full.targetTeamId), 0, AUDIT_MAX - 1) : Promise.resolve(),
  ]);
  return full;
}

export async function listTeamAudit(teamId: string, limit = 100): Promise<AuditEntry[]> {
  const raw = await redis.lrange<string>(teamKey(teamId), 0, Math.max(0, limit - 1));
  return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as AuditEntry);
}

export async function listGlobalAudit(limit = 100): Promise<AuditEntry[]> {
  const raw = await redis.lrange<string>(globalKey(), 0, Math.max(0, limit - 1));
  return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as AuditEntry);
}
