import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import {
  identityErrorMessage,
  isOperator,
  resolveServerIdentity,
} from "@/lib/session";
import {
  createUser,
  deleteAccessDraft,
  getAccessDraft,
  getOrgInvite,
  getUserByEmail,
  listOrgInvites,
  listWaitlist,
  markOrgInviteRevoked,
  markWaitlistInvited,
  markWaitlistRevoked,
  removeFromWaitlist,
  removeOrgInvitePending,
  deleteOrgInvite,
  saveAccessDraft,
  upsertOrgInvite,
  getUserByTeamId,
  disableUser,
  deleteUser,
  EmailTakenError,
  type AccessSource,
} from "@/lib/redis";
import {
  provisionTeamKey,
  purgeTeamRooms,
  revokeAdminKey,
  revokeTeamAccess,
} from "@/lib/roomd";
import { emailTeamId } from "@/lib/teams";
import { sendInviteEmail } from "@/lib/mail";
import { buildInviteEmailHtml } from "@/lib/email/invite-template";
import { appendAudit } from "@/lib/audit";
import { track, captureError } from "@/lib/telemetry";
import type { OrgInviteEntry } from "@/types";

/**
 * Unified access issuance for Owner portal.
 *
 * prepare  — mint key + draft (does NOT accept waitlist / does NOT deliver)
 * confirm  — Send email or Copy key → then mark accepted/delivered
 * abandon  — dialog closed without delivery → revoke minted key
 * disable  — revoke API key(s) + invites, keep the row (alias: revoke)
 * delete   — revoke keys/invites, purge rooms, remove the invite/waitlist row
 */

const prepareSchema = z.object({
  action: z.literal("prepare"),
  email: z.string().trim().email().max(254),
  source: z.enum(["direct", "waitlist"]),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  email: z.string().trim().email().max(254),
  secret: z.string().min(8).max(256),
  delivery: z.enum(["email", "copy"]),
});

const abandonSchema = z.object({
  action: z.literal("abandon"),
  email: z.string().trim().email().max(254),
});

const disableSchema = z.object({
  action: z.literal("disable"),
  email: z.string().trim().email().max(254),
  source: z.enum(["direct", "waitlist"]),
});

/** Alias kept for older UI clients that still send action=revoke. */
const revokeSchema = z.object({
  action: z.literal("revoke"),
  email: z.string().trim().email().max(254),
  source: z.enum(["direct", "waitlist"]),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  email: z.string().trim().email().max(254),
  source: z.enum(["direct", "waitlist"]),
});

const bodySchema = z.discriminatedUnion("action", [
  prepareSchema,
  confirmSchema,
  abandonSchema,
  disableSchema,
  revokeSchema,
  deleteSchema,
]);

function loginUrl() {
  return `${process.env.NEXTAUTH_URL ?? "https://app.roomd.sh"}/login`;
}

function masterKey() {
  return process.env.ROOMD_MASTER_KEY;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function failClosed(route: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${route}]`, message);
  captureError(err, { route });
  return NextResponse.json(
    { ok: false, error: "Revocation incomplete — access not changed" },
    { status: 502 },
  );
}

export async function GET() {
  const resolved = await resolveServerIdentity();
  if (!resolved.ok) {
    return NextResponse.json(
      { error: identityErrorMessage(resolved.reason), reason: resolved.reason },
      { status: 401 },
    );
  }
  if (!isOperator(resolved.identity)) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  try {
    return NextResponse.json({ invites: await listOrgInvites() });
  } catch (err) {
    console.error("[access:list]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const resolved = await resolveServerIdentity();
  if (!resolved.ok) {
    return NextResponse.json(
      { error: identityErrorMessage(resolved.reason), reason: resolved.reason },
      { status: 401 },
    );
  }
  if (!isOperator(resolved.identity)) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = body.email.toLowerCase();
  const mk = masterKey();
  if (!mk) {
    return NextResponse.json(
      { error: "ROOMD_MASTER_KEY is not configured" },
      { status: 500 },
    );
  }

  if (body.action === "prepare") {
    return prepare(email, body.source, mk);
  }
  if (body.action === "confirm") {
    return confirm(email, body.secret, body.delivery);
  }
  if (body.action === "abandon") {
    return abandon(email, mk);
  }
  if (body.action === "delete") {
    return deleteAccess(email, body.source, mk);
  }
  return disableAccess(email, body.source, mk);
}

async function prepare(email: string, source: AccessSource, mk: string) {
  try {
    // Reuse teamId only from an in-flight draft. Never reuse a prior invited/
    // waitlist teamId after delete (P0-3) — that reopened purged tenant data.
    // Random emailTeamId() — never waitlistTeamId(email).
    const existingDraft = await getAccessDraft(email);

    // Identity v2 / P1-7: one email → one person. Allow re-prepare only when the
    // existing row is the unfinished draft's pre-created user.
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      const draftOwned =
        existingDraft &&
        !existingDraft.confirmedAt &&
        existingUser.teamId === existingDraft.teamId;
      if (!draftOwned) {
        return NextResponse.json(
          { error: "A dashboard user already exists for this email" },
          { status: 409 },
        );
      }
    }

    const teamId = existingDraft?.teamId ?? emailTeamId();

    if (existingDraft?.keyId && !existingDraft.confirmedAt) {
      try {
        await revokeAdminKey(existingDraft.keyId, mk);
      } catch (err) {
        console.error("[access:prepare:revoke-draft]", err instanceof Error ? err.message : err);
      }
      // Drop the unused person row from a previous unfinished prepare.
      if (existingUser && existingUser.teamId === existingDraft.teamId) {
        await deleteUser(existingUser.id);
      }
    }

    const key = await provisionTeamKey(teamId, mk, email);
    const draft = {
      email,
      source,
      teamId: key.teamId,
      keyId: key.keyId,
      keyHint: key.secret.slice(-4),
      secretHash: hashSecret(key.secret),
      createdAt: new Date().toISOString(),
    };
    await saveAccessDraft(draft);

    // Pre-create person + owner membership so register/OAuth unify onto this
    // identity instead of minting a second team for the same email (P1-7).
    try {
      await createUser({
        email,
        teamId: key.teamId,
        apiKey: key.secret,
        authMethods: ["apikey"],
        createdAt: draft.createdAt,
      });
    } catch (err) {
      if (err instanceof EmailTakenError) {
        return NextResponse.json(
          { error: "A dashboard user already exists for this email" },
          { status: 409 },
        );
      }
      throw err;
    }

    if (source === "direct") {
      const entry: OrgInviteEntry = {
        email,
        status: "pending_delivery",
        teamId: key.teamId,
        keyId: key.keyId,
        keyHint: draft.keyHint,
        createdAt: draft.createdAt,
      };
      await upsertOrgInvite(entry);
    }

    const who = "You have been invited";
    const scope = "You get a team workspace and can create rooms.";
    const url = loginUrl();
    const html = buildInviteEmailHtml({
      apiKey: key.secret,
      loginUrl: url,
      who,
      scope,
    });
    const text =
      `${who} to roomd.\n\n` +
      `${scope}\n\n` +
      `Your API key (keep this email):\n${key.secret}\n\n` +
      `Sign in at ${url} and paste the key.`;

    return NextResponse.json({
      email,
      source,
      secret: key.secret,
      keyId: key.keyId,
      teamId: key.teamId,
      loginUrl: url,
      html,
      text,
    });
  } catch (err) {
    console.error("[access:prepare]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to prepare invite" }, { status: 500 });
  }
}

async function confirm(
  email: string,
  secret: string,
  delivery: "email" | "copy",
) {
  try {
    const draft = await getAccessDraft(email);
    if (!draft) {
      return NextResponse.json(
        { error: "Invite expired or was cancelled. Start again." },
        { status: 409 },
      );
    }

    if (draft.secretHash && draft.secretHash !== hashSecret(secret)) {
      return NextResponse.json(
        { error: "Secret does not match the prepared invite" },
        { status: 400 },
      );
    }
    // Legacy drafts without secretHash: require last-4 hint match.
    if (!draft.secretHash && !secret.endsWith(draft.keyHint)) {
      return NextResponse.json(
        { error: "Secret does not match the prepared invite" },
        { status: 400 },
      );
    }

    let emailed = false;
    let reason: string | undefined;
    if (delivery === "email") {
      const mail = await sendInviteEmail({
        to: email,
        apiKey: secret,
        loginUrl: loginUrl(),
      });
      emailed = mail.sent;
      reason = mail.reason;
      if (!emailed) {
        return NextResponse.json({ emailed: false, reason }, { status: 502 });
      }
    }

    // First successful delivery marks waitlist/org as issued. Later delivery
    // (copy then email, or email then copy) reuses the same draft.
    if (!draft.confirmedAt) {
      if (draft.source === "waitlist") {
        await markWaitlistInvited(email, draft.teamId, draft.keyId);
      } else {
        const existing = (await getOrgInvite(email)) ?? {
          email,
          status: "pending_delivery" as const,
          teamId: draft.teamId,
          keyId: draft.keyId,
          keyHint: draft.keyHint,
          createdAt: draft.createdAt,
        };
        await upsertOrgInvite({
          ...existing,
          status: "delivered",
          deliveredAt: new Date().toISOString(),
          delivery,
          teamId: draft.teamId,
          keyId: draft.keyId,
          keyHint: draft.keyHint,
        });
      }
    } else if (draft.source === "direct" && delivery === "email") {
      const existing = await getOrgInvite(email);
      if (existing) {
        await upsertOrgInvite({ ...existing, delivery: "email" });
      }
    }

    // Keep the draft after copy so Send email still works in the same dialog.
    // Email is the last hop — clear the draft once it succeeds.
    if (delivery === "email") {
      await deleteAccessDraft(email);
    } else {
      await saveAccessDraft({
        ...draft,
        confirmedAt: draft.confirmedAt ?? new Date().toISOString(),
        delivery: "copy",
      });
    }

    track("access_invite_confirmed", {
      delivery,
      emailed,
      source: draft.source,
      teamId: draft.teamId,
    });
    return NextResponse.json({ email, emailed, delivery, confirmed: true });
  } catch (err) {
    captureError(err, { route: "access:confirm" });
    return NextResponse.json({ error: "Failed to confirm invite" }, { status: 500 });
  }
}

async function abandon(email: string, mk: string) {
  try {
    const draft = await getAccessDraft(email);
    if (draft) {
      // Already delivered via Copy — only drop the draft, keep the key + user.
      if (!draft.confirmedAt) {
        try {
          await revokeAdminKey(draft.keyId, mk);
        } catch (err) {
          console.error("[access:abandon:revoke]", err instanceof Error ? err.message : err);
        }
        // prepare() pre-creates the dashboard user — remove the unused person row.
        const user = await getUserByEmail(email);
        if (user && user.teamId === draft.teamId) {
          await deleteUser(user.id);
        }
      }
      await deleteAccessDraft(email);
    }

    const invite = await getOrgInvite(email);
    if (invite?.status === "pending_delivery") {
      await removeOrgInvitePending(email);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[access:abandon]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to cancel invite" }, { status: 500 });
  }
}

/** Disable = revoke keys + invites, keep the history row. Fail closed. */
async function disableAccess(email: string, source: AccessSource, mk: string) {
  try {
    const teamId = await resolveTeamId(email, source);
    // Identity v2: act on the person (email), not the legacy team-owner index alone.
    const user = (await getUserByEmail(email)) ?? (teamId ? await getUserByTeamId(teamId) : null);

    if (teamId) {
      try {
        await revokeTeamAccess(teamId, mk);
      } catch (err) {
        return failClosed("access:disable:revoke", err);
      }
      if (user) await disableUser(user.id);
    } else if (source === "direct") {
      const invite = await getOrgInvite(email);
      if (invite?.keyId) {
        try {
          await revokeAdminKey(invite.keyId, mk);
        } catch (err) {
          return failClosed("access:disable:key", err);
        }
      }
      if (user) await disableUser(user.id);
    } else {
      const entry = (await listWaitlist()).find((e) => e.email === email);
      if (entry?.keyId) {
        try {
          await revokeAdminKey(entry.keyId, mk);
        } catch (err) {
          return failClosed("access:disable:key", err);
        }
      }
      if (user) await disableUser(user.id);
    }

    if (source === "direct") await markOrgInviteRevoked(email);
    else await markWaitlistRevoked(email);

    await appendAudit({
      actorUserId: null,
      actorTeamId: null,
      action: "user.disable",
      targetTeamId: teamId ?? undefined,
      targetUserId: user?.id,
      targetEmail: email,
      meta: { source },
    });

    return NextResponse.json({ ok: true, email, action: "disable" });
  } catch (err) {
    console.error("[access:disable]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to disable" }, { status: 500 });
  }
}

/** Delete = revoke keys/invites, purge rooms, remove row + linked user. Fail closed. */
async function deleteAccess(email: string, source: AccessSource, mk: string) {
  try {
    const teamId = await resolveTeamId(email, source);
    // Identity v2: delete the specific person record for this email.
    const user = (await getUserByEmail(email)) ?? (teamId ? await getUserByTeamId(teamId) : null);

    if (teamId) {
      try {
        await revokeTeamAccess(teamId, mk);
      } catch (err) {
        return failClosed("access:delete:revoke", err);
      }
      try {
        await purgeTeamRooms(teamId, mk);
      } catch (err) {
        return failClosed("access:delete:purge", err);
      }
      if (user) await deleteUser(user.id);
    } else if (source === "direct") {
      const invite = await getOrgInvite(email);
      if (invite?.keyId) {
        try {
          await revokeAdminKey(invite.keyId, mk);
        } catch (err) {
          return failClosed("access:delete:key", err);
        }
      }
      if (user) await deleteUser(user.id);
    } else {
      const entry = (await listWaitlist()).find((e) => e.email === email);
      if (entry?.keyId) {
        try {
          await revokeAdminKey(entry.keyId, mk);
        } catch (err) {
          return failClosed("access:delete:key", err);
        }
      }
      if (user) await deleteUser(user.id);
    }

    if (source === "direct") await deleteOrgInvite(email);
    else await removeFromWaitlist(email);

    await appendAudit({
      actorUserId: null,
      actorTeamId: null,
      action: "user.delete",
      targetTeamId: teamId ?? undefined,
      targetUserId: user?.id,
      targetEmail: email,
      meta: { source },
    });

    return NextResponse.json({ ok: true, email, action: "delete" });
  } catch (err) {
    console.error("[access:delete]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

async function resolveTeamId(
  email: string,
  source: AccessSource,
): Promise<string | undefined> {
  if (source === "direct") {
    return (await getOrgInvite(email))?.teamId;
  }
  return (await listWaitlist()).find((e) => e.email === email)?.teamId;
}
