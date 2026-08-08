import { createHash } from "crypto";
import { Redis } from "@upstash/redis";
import { generateId } from "@/lib/utils";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { UserRecord, MembershipRecord, RoomMeta } from "@/types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ---------------------------------------------------------------------------
// Users (Identity v2: User ↔ Membership ↔ Team)
// ---------------------------------------------------------------------------

/** Thrown when an email address is already attached to another account. */
export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = "EmailTakenError";
  }
}

/**
 * The apiKey is a live bearer token for roomd, and it shares a Redis instance
 * with roomd's own records. It is encrypted at rest so a database dump alone
 * does not yield working credentials.
 */
function serialiseUser(user: UserRecord): string {
  return JSON.stringify({ ...user, apiKey: encryptSecret(user.apiKey) });
}

function deserialiseUser(raw: string | UserRecord): UserRecord {
  const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as UserRecord;
  // Decrypt failure → empty apiKey. Callers must treat empty as unauthenticated
  // (see getServerIdentity); do not serve an authenticated empty-key session.
  let apiKey = "";
  try {
    apiKey = decryptSecret(parsed.apiKey);
  } catch {
    apiKey = "";
  }
  return { ...parsed, apiKey };
}

/** SHA-256 hex prefix used as the apiKey login lookup index. */
export function apiKeyDigestHint(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 32);
}

function keyHintKey(apiKey: string): string {
  return `app:user:keyhint:${apiKeyDigestHint(apiKey)}`;
}

function membershipKey(userId: string, teamId: string): string {
  return `app:membership:${userId}:${teamId}`;
}

async function setKeyHintIndex(userId: string, apiKey: string): Promise<void> {
  if (!apiKey) return;
  await redis.set(keyHintKey(apiKey), userId);
}

async function clearKeyHintIndex(apiKey: string): Promise<void> {
  if (!apiKey) return;
  await redis.del(keyHintKey(apiKey));
}

/**
 * Create a user record and (by default) an owner membership on `teamId`.
 *
 * The email index is claimed with SET NX before the record is written, so two
 * concurrent signups for the same address cannot both succeed. To attach a new
 * login method to an existing address, look the user up first and call
 * linkAuthMethod instead.
 */
export async function createUser(
  data: Omit<UserRecord, "id">,
  opts?: { role?: "owner" | "member"; skipMembership?: boolean },
): Promise<UserRecord> {
  const id = generateId("user");
  const user: UserRecord = { ...data, id };
  const role = opts?.role ?? "owner";

  if (user.email) {
    const claimed = await redis.set(`app:user:email:${user.email}`, id, { nx: true });
    if (claimed !== "OK") throw new EmailTakenError(user.email);
  }

  await redis.set(`app:user:${id}`, serialiseUser(user));
  await setKeyHintIndex(id, user.apiKey);
  await redis.sadd("app:users", id);

  // Owner index (legacy `app:user:apikey:{teamId}` kept as owner pointer, NX only).
  if (role === "owner") {
    await redis.set(`app:team:${user.teamId}:owner`, id, { nx: true });
    await redis.set(`app:user:apikey:${user.teamId}`, id, { nx: true });
  }

  if (!opts?.skipMembership) {
    await upsertMembership({
      userId: id,
      teamId: user.teamId,
      role,
      createdAt: user.createdAt,
    });
  }

  return user;
}

/**
 * @deprecated Identity v2: do not upsert users by teamId — teammates would
 * collapse onto one record. Prefer findOrCreateUserForApiKey / getUserByApiKey.
 * Kept for migration callers; NX-claims the owner index only.
 */
export async function upsertUserByTeamId(
  data: Omit<UserRecord, "id">
): Promise<UserRecord> {
  const existingOwner = await getTeamOwnerId(data.teamId);
  if (existingOwner) {
    const existing = await getUserById(existingOwner);
    if (existing) {
      await redis.sadd("app:users", existing.id);
      return existing;
    }
  }
  return createUser(data, { role: "owner" });
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const raw = await redis.get<string>(`app:user:${id}`);
  if (!raw) return null;
  return deserialiseUser(raw);
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const id = await redis.get<string>(`app:user:email:${email}`);
  if (!id) return null;
  return getUserById(id);
}

/** Look up the user who owns this exact apiKey (digest index). */
export async function getUserByApiKey(apiKey: string): Promise<UserRecord | null> {
  if (!apiKey) return null;
  const id = await redis.get<string>(keyHintKey(apiKey));
  if (!id) return null;
  return getUserById(id);
}

/**
 * Team owner lookup. Prefers `app:team:{teamId}:owner`; falls back to legacy
 * `app:user:apikey:{teamId}` (deprecated exclusive-identity index).
 */
export async function getTeamOwnerId(teamId: string): Promise<string | null> {
  const owner = await redis.get<string>(`app:team:${teamId}:owner`);
  if (owner) return owner;
  return redis.get<string>(`app:user:apikey:${teamId}`);
}

/** @deprecated Use getTeamOwnerId + memberships. Returns the team owner user only. */
export async function getUserByTeamId(teamId: string): Promise<UserRecord | null> {
  const id = await getTeamOwnerId(teamId);
  if (!id) return null;
  return getUserById(id);
}

export async function getUserByProvider(
  provider: "google" | "github",
  externalId: string
): Promise<UserRecord | null> {
  const id = await redis.get<string>(`app:user:${provider}:${externalId}`);
  if (!id) return null;
  return getUserById(id);
}

export async function updateUser(
  id: string,
  patch: Partial<UserRecord>
): Promise<void> {
  const existing = await getUserById(id);
  if (!existing) throw new Error(`User ${id} not found`);

  if (patch.email && patch.email !== existing.email) {
    if (existing.email) await redis.del(`app:user:email:${existing.email}`);
    await redis.set(`app:user:email:${patch.email}`, id);
  }

  if (patch.apiKey !== undefined && patch.apiKey !== existing.apiKey) {
    await clearKeyHintIndex(existing.apiKey);
    await setKeyHintIndex(id, patch.apiKey);
  }

  const updated = { ...existing, ...patch };
  await redis.set(`app:user:${id}`, serialiseUser(updated));
}

/** Soft-disable: keep the account row, block dashboard login. */
export async function disableUser(id: string): Promise<void> {
  await updateUser(id, { disabledAt: new Date().toISOString() });
}

/** Re-enable a disabled account (they still need a valid roomd key). */
export async function enableUser(id: string): Promise<void> {
  const existing = await getUserById(id);
  if (!existing) throw new Error(`User ${id} not found`);
  const rest = { ...existing };
  delete rest.disabledAt;
  await redis.set(`app:user:${id}`, serialiseUser(rest));
}

/** Hard-delete the dashboard user record, memberships, and indexes. */
export async function deleteUser(id: string): Promise<void> {
  const existing = await getUserById(id);
  if (!existing) return;

  const teamIds = await listUserTeamIds(id);
  for (const teamId of teamIds) {
    await removeMembership(id, teamId);
  }

  if (existing.email) await redis.del(`app:user:email:${existing.email}`);
  await clearKeyHintIndex(existing.apiKey);

  const ownerId = await getTeamOwnerId(existing.teamId);
  if (ownerId === id) {
    await redis.del(`app:team:${existing.teamId}:owner`);
    const legacy = await redis.get<string>(`app:user:apikey:${existing.teamId}`);
    if (legacy === id) await redis.del(`app:user:apikey:${existing.teamId}`);
  }

  await redis.del(`app:user:${id}`);
  await redis.srem("app:users", id);
}

export async function linkAuthMethod(
  userId: string,
  provider: "google" | "github",
  externalId: string
): Promise<void> {
  await redis.set(`app:user:${provider}:${externalId}`, userId);
}

// ---------------------------------------------------------------------------
// Memberships (Identity v2)
// ---------------------------------------------------------------------------

export async function upsertMembership(m: MembershipRecord): Promise<void> {
  await redis.set(membershipKey(m.userId, m.teamId), JSON.stringify(m));
  await redis.sadd(`app:team:${m.teamId}:members`, m.userId);
  await redis.sadd(`app:user:${m.userId}:teams`, m.teamId);

  if (m.role === "owner") {
    await redis.set(`app:team:${m.teamId}:owner`, m.userId, { nx: true });
    await redis.set(`app:user:apikey:${m.teamId}`, m.userId, { nx: true });
  }
}

export async function getMembership(
  userId: string,
  teamId: string,
): Promise<MembershipRecord | null> {
  const raw = await redis.get<string>(membershipKey(userId, teamId));
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as MembershipRecord;
}

export async function removeMembership(userId: string, teamId: string): Promise<void> {
  await redis.del(membershipKey(userId, teamId));
  await redis.srem(`app:team:${teamId}:members`, userId);
  await redis.srem(`app:user:${userId}:teams`, teamId);

  const ownerId = await redis.get<string>(`app:team:${teamId}:owner`);
  if (ownerId === userId) {
    await redis.del(`app:team:${teamId}:owner`);
    const legacy = await redis.get<string>(`app:user:apikey:${teamId}`);
    if (legacy === userId) await redis.del(`app:user:apikey:${teamId}`);
  }
}

export async function listUserTeamIds(userId: string): Promise<string[]> {
  return redis.smembers(`app:user:${userId}:teams`);
}

export async function listTeamMemberIds(teamId: string): Promise<string[]> {
  return redis.smembers(`app:team:${teamId}:members`);
}

export async function countTeamOwners(teamId: string): Promise<number> {
  const ids = await listTeamMemberIds(teamId);
  let n = 0;
  for (const id of ids) {
    const m = await getMembership(id, teamId);
    if (m?.role === "owner") n++;
  }
  return n;
}

/**
 * Find the user for this apiKey digest, or create a NEW person-record.
 * Never attaches a teammate login onto another user's row / never overwrites
 * another person's apiKey just because they share a teamId.
 */
export async function findOrCreateUserForApiKey(
  apiKey: string,
  teamId: string,
  extras?: Partial<Pick<UserRecord, "email" | "name" | "isOperator">>,
): Promise<UserRecord> {
  const byKey = await getUserByApiKey(apiKey);
  if (byKey) {
    const membership = await getMembership(byKey.id, teamId);
    if (!membership) {
      const ownerId = await getTeamOwnerId(teamId);
      const role = ownerId && ownerId !== byKey.id ? "member" : "owner";
      await upsertMembership({
        userId: byKey.id,
        teamId,
        role,
        createdAt: new Date().toISOString(),
      });
    }
    // Repair empty apiKey after decrypt failure — same person's key only.
    if (!byKey.apiKey) {
      await updateUser(byKey.id, { apiKey, teamId });
      return { ...byKey, apiKey, teamId };
    }
    if (byKey.teamId !== teamId) {
      await updateUser(byKey.id, { teamId });
      return { ...byKey, teamId };
    }
    return byKey;
  }

  // Optional: email already has a user joining via a teammate key.
  if (extras?.email) {
    const byEmail = await getUserByEmail(extras.email);
    if (byEmail) {
      await upsertMembership({
        userId: byEmail.id,
        teamId,
        role: "member",
        createdAt: new Date().toISOString(),
      });
      // Store THIS personal key on THEIR record only (not the owner's).
      await updateUser(byEmail.id, { apiKey, teamId });
      const methods = byEmail.authMethods.includes("apikey")
        ? byEmail.authMethods
        : ([...byEmail.authMethods, "apikey"] as UserRecord["authMethods"]);
      if (methods !== byEmail.authMethods) {
        await updateUser(byEmail.id, { authMethods: methods });
      }
      return { ...byEmail, apiKey, teamId, authMethods: methods };
    }
  }

  const ownerId = await getTeamOwnerId(teamId);
  const role: "owner" | "member" = ownerId ? "member" : "owner";

  return createUser(
    {
      teamId,
      apiKey,
      email: extras?.email,
      name: extras?.name,
      isOperator: extras?.isOperator,
      authMethods: ["apikey"],
      createdAt: new Date().toISOString(),
    },
    { role },
  );
}

/** Pending teammate invite: key digest → email so first login can attach email. */
export async function savePendingTeammateInvite(
  apiKey: string,
  data: { email: string; teamId: string },
): Promise<void> {
  const key = `app:invite:keyhint:${apiKeyDigestHint(apiKey)}`;
  await redis.set(key, JSON.stringify(data), { ex: 60 * 60 * 24 * 14 });
}

export async function takePendingTeammateInvite(
  apiKey: string,
): Promise<{ email: string; teamId: string } | null> {
  const key = `app:invite:keyhint:${apiKeyDigestHint(apiKey)}`;
  const raw = await redis.get<string>(key);
  if (!raw) return null;
  await redis.del(key);
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as {
    email: string;
    teamId: string;
  };
}

// ---------------------------------------------------------------------------
// Rooms (web-app metadata only; actual room data lives in roomd)
// ---------------------------------------------------------------------------

export async function createRoom(meta: RoomMeta): Promise<void> {
  await redis.set(`app:room:${meta.roomId}`, JSON.stringify(meta));
  await redis.sadd(`app:rooms:${meta.createdBy}`, meta.roomId);
  await redis.sadd("app:rooms:all", meta.roomId);
}

/** Attach an existing room id to a user's dashboard index (Identity v2 repair). */
export async function linkRoomToUser(userId: string, roomId: string): Promise<void> {
  await redis.sadd(`app:rooms:${userId}`, roomId);
  await redis.sadd("app:rooms:all", roomId);
}

/** Every user record. Operator analytics only. */
export async function getAllUsers(): Promise<UserRecord[]> {
  const ids = await redis.smembers("app:users");
  if (!ids.length) return [];
  const users = await Promise.all(ids.map((id) => getUserById(id)));
  return users.filter((u): u is UserRecord => u !== null);
}

/** Every room's metadata, across all users. Operator analytics only. */
export async function getAllRoomMeta(): Promise<RoomMeta[]> {
  const ids = await redis.smembers("app:rooms:all");
  if (!ids.length) return [];
  const metas = await Promise.all(ids.map((id) => redis.get<string>(`app:room:${id}`)));
  return metas
    .filter(Boolean)
    .map((raw) => (typeof raw === "string" ? JSON.parse(raw) : raw) as RoomMeta);
}

export async function getRoomsForUser(userId: string): Promise<RoomMeta[]> {
  const roomIds = await redis.smembers(`app:rooms:${userId}`);
  if (!roomIds.length) return [];

  const metas = await Promise.all(
    roomIds.map((id) => redis.get<string>(`app:room:${id}`))
  );

  return metas
    .filter(Boolean)
    .map((raw) => (typeof raw === "string" ? JSON.parse(raw) : raw) as RoomMeta);
}

export async function getRoomMeta(roomId: string): Promise<RoomMeta | null> {
  const raw = await redis.get<string>(`app:room:${roomId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw as unknown as RoomMeta;
}

// ---------------------------------------------------------------------------
// Waitlist (landing-page requests only — never mixed with direct invites)
// ---------------------------------------------------------------------------

import type { OrgInviteEntry, WaitlistEntry } from "@/types";

const waitlistMetaKey = (email: string) => `app:waitlist:meta:${email}`;
const orgInviteMetaKey = (email: string) => `app:org-invite:meta:${email}`;
const accessDraftKey = (email: string) => `app:access-draft:${email}`;

export type AccessSource = "direct" | "waitlist";

/** In-flight invite: key minted, not yet fully finished (Send and/or Copy). */
export interface AccessDraft {
  email: string;
  source: AccessSource;
  teamId: string;
  keyId: string;
  keyHint: string;
  /** sha256 of the minted secret — confirm must present the matching secret. */
  secretHash?: string;
  createdAt: string;
  /** Set after Copy or Send so abandon does not revoke a delivered key. */
  confirmedAt?: string;
  /** Last delivery method used while the draft was still open. */
  delivery?: "email" | "copy";
}

/**
 * Record a waitlist signup. Idempotent: joining twice keeps the original entry
 * and its status. The email SET drives enumeration; the meta record tracks
 * status so the operator can see who is pending and who has been invited.
 */
export async function addToWaitlist(email: string): Promise<void> {
  await redis.sadd("app:waitlist", email);
  const meta: WaitlistEntry = { email, status: "pending", createdAt: new Date().toISOString() };
  await redis.set(waitlistMetaKey(email), JSON.stringify(meta), { nx: true });
}

/** One waitlist row by email, or null if never joined. */
export async function getWaitlistEntry(email: string): Promise<WaitlistEntry | null> {
  const raw = await redis.get<string>(waitlistMetaKey(email));
  if (raw) {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as WaitlistEntry;
  }
  const inSet = await redis.sismember("app:waitlist", email);
  if (!inSet) return null;
  return { email, status: "pending", createdAt: "" };
}

/** Every waitlist entry, newest first. Emails with no meta are treated as pending. */
export async function listWaitlist(): Promise<WaitlistEntry[]> {
  const emails = await redis.smembers("app:waitlist");
  if (!emails.length) return [];

  const metas = await Promise.all(emails.map((e) => redis.get<string>(waitlistMetaKey(e))));
  const entries: WaitlistEntry[] = emails.map((email, i) => {
    const raw = metas[i];
    if (raw) return (typeof raw === "string" ? JSON.parse(raw) : raw) as WaitlistEntry;
    return { email, status: "pending", createdAt: "" };
  });

  return entries.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

/**
 * Mark a waitlisted email as accepted. Only touches the waitlist set — never
 * used for direct Owner → Invite rows.
 */
export async function markWaitlistInvited(
  email: string,
  teamId: string,
  keyId?: string,
): Promise<void> {
  const existing = await redis.get<string>(waitlistMetaKey(email));
  const base: WaitlistEntry =
    existing
      ? ((typeof existing === "string" ? JSON.parse(existing) : existing) as WaitlistEntry)
      : { email, status: "pending", createdAt: new Date().toISOString() };

  const updated: WaitlistEntry = {
    ...base,
    status: "invited",
    invitedAt: new Date().toISOString(),
    teamId,
    ...(keyId ? { keyId } : {}),
  };
  await redis.set(waitlistMetaKey(email), JSON.stringify(updated));
}

/** Decline a waitlist request. Keeps the row for history; no key is issued. */
export async function markWaitlistDeclined(email: string): Promise<void> {
  const existing = await redis.get<string>(waitlistMetaKey(email));
  const base: WaitlistEntry =
    existing
      ? ((typeof existing === "string" ? JSON.parse(existing) : existing) as WaitlistEntry)
      : { email, status: "pending", createdAt: new Date().toISOString() };

  const updated: WaitlistEntry = {
    ...base,
    status: "declined",
    declinedAt: new Date().toISOString(),
  };
  await redis.set(waitlistMetaKey(email), JSON.stringify(updated));
}

/** Remove one email from the waitlist. Scoped to a single, explicit entry. */
export async function removeFromWaitlist(email: string): Promise<void> {
  await redis.srem("app:waitlist", email);
  await redis.del(waitlistMetaKey(email));
}

// ---------------------------------------------------------------------------
// Direct org invites (Owner → Invite). Separate from waitlist.
// ---------------------------------------------------------------------------

export async function listOrgInvites(): Promise<OrgInviteEntry[]> {
  const emails = await redis.smembers("app:org-invites");
  if (!emails.length) return [];
  const metas = await Promise.all(emails.map((e) => redis.get<string>(orgInviteMetaKey(e))));
  const entries: OrgInviteEntry[] = [];
  for (let i = 0; i < emails.length; i++) {
    const raw = metas[i];
    if (!raw) continue;
    entries.push((typeof raw === "string" ? JSON.parse(raw) : raw) as OrgInviteEntry);
  }
  return entries.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export async function upsertOrgInvite(entry: OrgInviteEntry): Promise<void> {
  await redis.sadd("app:org-invites", entry.email);
  await redis.set(orgInviteMetaKey(entry.email), JSON.stringify(entry));
}

export async function getOrgInvite(email: string): Promise<OrgInviteEntry | null> {
  const raw = await redis.get<string>(orgInviteMetaKey(email));
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as OrgInviteEntry;
}

export async function markOrgInviteRevoked(email: string): Promise<void> {
  const existing = await getOrgInvite(email);
  if (!existing) return;
  const updated: OrgInviteEntry = {
    ...existing,
    status: "revoked",
    revokedAt: new Date().toISOString(),
  };
  await upsertOrgInvite(updated);
}

/** Drop a direct invite that was never delivered. */
export async function removeOrgInvitePending(email: string): Promise<void> {
  const existing = await getOrgInvite(email);
  if (!existing || existing.status !== "pending_delivery") return;
  await redis.srem("app:org-invites", email);
  await redis.del(orgInviteMetaKey(email));
}

/** Permanently remove a direct invite row. */
export async function deleteOrgInvite(email: string): Promise<void> {
  await redis.srem("app:org-invites", email);
  await redis.del(orgInviteMetaKey(email));
}

export async function markWaitlistRevoked(email: string): Promise<void> {
  const existing = await redis.get<string>(waitlistMetaKey(email));
  if (!existing) return;
  const base = (typeof existing === "string" ? JSON.parse(existing) : existing) as WaitlistEntry;
  const updated: WaitlistEntry = {
    ...base,
    status: "revoked",
    revokedAt: new Date().toISOString(),
    keyId: undefined,
  };
  await redis.set(waitlistMetaKey(email), JSON.stringify(updated));
}

// ---------------------------------------------------------------------------
// Access drafts (prepared key, not yet Send/Copy confirmed)
// ---------------------------------------------------------------------------

export async function saveAccessDraft(draft: AccessDraft): Promise<void> {
  // 1 hour TTL — abandoned dialogs don't leave drafts forever.
  await redis.set(accessDraftKey(draft.email), JSON.stringify(draft), { ex: 60 * 60 });
}

export async function getAccessDraft(email: string): Promise<AccessDraft | null> {
  const raw = await redis.get<string>(accessDraftKey(email));
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as AccessDraft;
}

export async function deleteAccessDraft(email: string): Promise<void> {
  await redis.del(accessDraftKey(email));
}
