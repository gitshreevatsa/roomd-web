import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity, isOperator } from "@/lib/session";
import {
  deleteAccessDraft,
  getAccessDraft,
  getOrgInvite,
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
  type AccessSource,
} from "@/lib/redis";
import { provisionTeamKey, revokeAdminKey, revokeAllTeamKeys } from "@/lib/roomd";
import { waitlistTeamId } from "@/lib/teams";
import { sendInviteEmail } from "@/lib/mail";
import { buildInviteEmailHtml } from "@/lib/email/invite-template";
import type { OrgInviteEntry } from "@/types";

/**
 * Unified access issuance for Owner portal.
 *
 * prepare  — mint key + draft (does NOT accept waitlist / does NOT deliver)
 * confirm  — Send email or Copy key → then mark accepted/delivered
 * abandon  — dialog closed without delivery → revoke minted key
 * disable  — revoke API key(s), keep the row (alias: revoke)
 * delete   — revoke keys and remove the invite/waitlist row (+ linked user if any)
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

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) return NextResponse.json({ error: "Operator only" }, { status: 403 });

  try {
    return NextResponse.json({ invites: await listOrgInvites() });
  } catch (err) {
    console.error("[access:list]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) return NextResponse.json({ error: "Operator only" }, { status: 403 });

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
    const key = await provisionTeamKey(waitlistTeamId(email), mk, email);
    const draft = {
      email,
      source,
      teamId: key.teamId,
      keyId: key.keyId,
      keyHint: key.secret.slice(-4),
      createdAt: new Date().toISOString(),
    };
    await saveAccessDraft(draft);

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
    const scope = "You get your own private workspace.";
    const url = loginUrl();
    const html = buildInviteEmailHtml({ key: key.secret, loginUrl: url, who, scope });
    const text =
      `${who} to roomd.\n\n` +
      `Sign in at ${url} with this key:\n\n${key.secret}\n\n` +
      `${scope} Keep the key somewhere safe.`;

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

    let emailed = false;
    let reason: string | undefined;
    if (delivery === "email") {
      const mail = await sendInviteEmail({ to: email, key: secret, loginUrl: loginUrl() });
      emailed = mail.sent;
      reason = mail.reason;
      if (!emailed) {
        return NextResponse.json({ emailed: false, reason }, { status: 502 });
      }
    }

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

    await deleteAccessDraft(email);
    return NextResponse.json({ email, emailed, delivery, confirmed: true });
  } catch (err) {
    console.error("[access:confirm]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to confirm invite" }, { status: 500 });
  }
}

async function abandon(email: string, mk: string) {
  try {
    const draft = await getAccessDraft(email);
    if (draft) {
      try {
        await revokeAdminKey(draft.keyId, mk);
      } catch (err) {
        console.error("[access:abandon:revoke]", err instanceof Error ? err.message : err);
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

/** Disable = revoke keys, keep the history row. */
async function disableAccess(email: string, source: AccessSource, mk: string) {
  try {
    const teamId = await resolveTeamId(email, source);
    if (teamId) {
      try {
        await revokeAllTeamKeys(teamId, mk);
      } catch (err) {
        console.error("[access:disable:keys]", err instanceof Error ? err.message : err);
      }
      const user = await getUserByTeamId(teamId);
      if (user) await disableUser(user.id);
    } else if (source === "direct") {
      const invite = await getOrgInvite(email);
      if (invite?.keyId) await revokeAdminKey(invite.keyId, mk);
    } else {
      const entry = (await listWaitlist()).find((e) => e.email === email);
      if (entry?.keyId) await revokeAdminKey(entry.keyId, mk);
    }

    if (source === "direct") await markOrgInviteRevoked(email);
    else await markWaitlistRevoked(email);

    return NextResponse.json({ ok: true, email, action: "disable" });
  } catch (err) {
    console.error("[access:disable]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to disable" }, { status: 500 });
  }
}

/** Delete = revoke keys and remove the row (and linked dashboard user). */
async function deleteAccess(email: string, source: AccessSource, mk: string) {
  try {
    const teamId = await resolveTeamId(email, source);
    if (teamId) {
      try {
        await revokeAllTeamKeys(teamId, mk);
      } catch (err) {
        console.error("[access:delete:keys]", err instanceof Error ? err.message : err);
      }
      const user = await getUserByTeamId(teamId);
      if (user) await deleteUser(user.id);
    } else if (source === "direct") {
      const invite = await getOrgInvite(email);
      if (invite?.keyId) {
        try {
          await revokeAdminKey(invite.keyId, mk);
        } catch {
          /* already gone */
        }
      }
    } else {
      const entry = (await listWaitlist()).find((e) => e.email === email);
      if (entry?.keyId) {
        try {
          await revokeAdminKey(entry.keyId, mk);
        } catch {
          /* already gone */
        }
      }
    }

    if (source === "direct") await deleteOrgInvite(email);
    else await removeFromWaitlist(email);

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
