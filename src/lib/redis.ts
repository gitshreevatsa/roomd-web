import { Redis } from "@upstash/redis";
import { generateId } from "@/lib/utils";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { UserRecord, RoomMeta } from "@/types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Thrown when an email address is already attached to another account. */
export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = "EmailTakenError";
  }
}

/**
 * The apiKey is a live, team-wide bearer token for roomd, and it shares a
 * Redis instance with roomd's own records. It is encrypted at rest so a
 * database dump alone does not yield working credentials.
 */
function serialiseUser(user: UserRecord): string {
  return JSON.stringify({ ...user, apiKey: encryptSecret(user.apiKey) });
}

function deserialiseUser(raw: string | UserRecord): UserRecord {
  const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as UserRecord;
  // If the stored key cannot be decrypted (NEXTAUTH_SECRET was rotated, or the
  // record predates encryption changes), degrade to an empty key instead of
  // throwing. An API-key login re-stores the real key from what the user typed;
  // an email/OAuth user is prompted to sign in with their key again. Either way
  // login is not bricked.
  let apiKey = "";
  try {
    apiKey = decryptSecret(parsed.apiKey);
  } catch {
    apiKey = "";
  }
  return { ...parsed, apiKey };
}

/**
 * Create a user record.
 *
 * The email index is claimed with SET NX before the record is written, so two
 * concurrent signups for the same address cannot both succeed. To attach a new
 * login method to an existing address, look the user up first and call
 * linkAuthMethod instead.
 */
export async function createUser(
  data: Omit<UserRecord, "id">
): Promise<UserRecord> {
  const id = generateId("user");
  const user: UserRecord = { ...data, id };

  if (user.email) {
    const claimed = await redis.set(`app:user:email:${user.email}`, id, { nx: true });
    if (claimed !== "OK") throw new EmailTakenError(user.email);
  }

  await redis.set(`app:user:${id}`, serialiseUser(user));
  await redis.set(`app:user:apikey:${user.teamId}`, id);
  await redis.sadd("app:users", id);

  return user;
}

/**
 * Idempotent create-or-fetch for API key logins.
 *
 * Uses SET NX on the teamId index so concurrent first-logins for the same
 * teamId converge to one user record rather than creating duplicates.
 * The winner of the SET NX race creates the record; the loser reads it.
 */
export async function upsertUserByTeamId(
  data: Omit<UserRecord, "id">
): Promise<UserRecord> {
  const newId = generateId("user");
  const indexKey = `app:user:apikey:${data.teamId}`;

  // Atomically claim the index slot. Returns "OK" if we won, null if already set.
  const claimed = await redis.set(indexKey, newId, { nx: true });

  if (claimed === "OK") {
    // We won the race, so write the full user record.
    const user: UserRecord = { ...data, id: newId };
    await redis.set(`app:user:${newId}`, serialiseUser(user));
    if (user.email) await redis.set(`app:user:email:${user.email}`, newId);
    await redis.sadd("app:users", newId);
    return user;
  }

  // Another request already created this user, so read and return it.
  const existingId = await redis.get<string>(indexKey);
  if (!existingId) throw new Error("upsertUserByTeamId: index race, slot missing");
  const existing = await getUserById(existingId);
  if (!existing) throw new Error("upsertUserByTeamId: index points to missing user");
  // Backfill the global index on every login, so accounts created before the
  // index existed still show up in operator analytics.
  await redis.sadd("app:users", existing.id);
  return existing;
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

export async function getUserByTeamId(teamId: string): Promise<UserRecord | null> {
  const id = await redis.get<string>(`app:user:apikey:${teamId}`);
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

  const updated = { ...existing, ...patch };
  await redis.set(`app:user:${id}`, serialiseUser(updated));
}

export async function linkAuthMethod(
  userId: string,
  provider: "google" | "github",
  externalId: string
): Promise<void> {
  await redis.set(`app:user:${provider}:${externalId}`, userId);
}

// ---------------------------------------------------------------------------
// Rooms (web-app metadata only; actual room data lives in roomd)
// ---------------------------------------------------------------------------

export async function createRoom(meta: RoomMeta): Promise<void> {
  await redis.set(`app:room:${meta.roomId}`, JSON.stringify(meta));
  await redis.sadd(`app:rooms:${meta.createdBy}`, meta.roomId);
  await redis.sadd("app:rooms:all", meta.roomId);
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

/** In-flight invite: key minted, not yet delivered (Send/Copy). */
export interface AccessDraft {
  email: string;
  source: AccessSource;
  teamId: string;
  keyId: string;
  keyHint: string;
  createdAt: string;
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
