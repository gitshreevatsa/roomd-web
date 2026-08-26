import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerIdentity, isOperator } from "@/lib/session";
import { getUserByTeamId, updateUser } from "@/lib/redis";
import { appendAudit } from "@/lib/audit";
import { captureError } from "@/lib/telemetry";
import {
  TIER_CATALOG,
  effectiveTierForTeam,
  getTeamTierConfig,
  normalizeTierId,
  setTeamTierConfig,
  type TierExclusions,
  type TierId,
  type TierOverrides,
} from "@/lib/tiering";

/**
 * Operator-only tiering controls.
 * GET  ?teamId=…  — catalog + effective limits for a team
 * PATCH            — set plan / overrides / exclusion switches
 */

const patchSchema = z.object({
  teamId: z.string().min(1).max(64),
  plan: z.enum(["free", "startup", "enterprise", "team"]).optional(),
  overrides: z
    .object({
      maxOrgs: z.number().int().min(0).optional(),
      maxMembers: z.number().int().min(0).optional(),
      maxRooms: z.number().int().min(0).optional(),
      maxKeys: z.number().int().min(0).optional(),
      maxAgentsPerRoom: z.number().int().min(0).optional(),
      rateLimitPerMinute: z.number().int().min(0).optional(),
    })
    .nullable()
    .optional(),
  exclusions: z
    .object({
      bypassOrgCap: z.boolean().optional(),
      bypassMemberCap: z.boolean().optional(),
      bypassRoomCap: z.boolean().optional(),
      bypassKeyCap: z.boolean().optional(),
      bypassAgentFanout: z.boolean().optional(),
      bypassRateLimit: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  /** Also stamp plan onto the team-owner user record for billing display. */
  syncUserPlan: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  const teamId = req.nextUrl.searchParams.get("teamId")?.trim();
  if (!teamId) {
    return NextResponse.json({
      catalog: TIER_CATALOG,
      note: "Pass ?teamId=… for a team's effective limits",
    });
  }

  try {
    const owner = await getUserByTeamId(teamId);
    const config = await getTeamTierConfig(teamId);
    const effective = await effectiveTierForTeam(teamId, owner?.plan);
    return NextResponse.json({
      teamId,
      userPlan: owner?.plan ?? null,
      config,
      effective,
      catalog: TIER_CATALOG,
    });
  } catch (err) {
    captureError(err, { route: "tiering:get" });
    return NextResponse.json({ error: "Failed to load tier" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const plan = body.plan ? (normalizeTierId(body.plan) as TierId) : undefined;
    const config = await setTeamTierConfig(body.teamId, {
      plan,
      overrides: body.overrides as TierOverrides | null | undefined,
      exclusions: body.exclusions as TierExclusions | null | undefined,
      updatedBy: identity.userId,
    });

    if (body.syncUserPlan !== false && plan) {
      const owner = await getUserByTeamId(body.teamId);
      if (owner) {
        await updateUser(owner.id, { plan });
      }
    }

    await appendAudit({
      actorUserId: identity.userId,
      actorTeamId: identity.teamId,
      action: "billing.plan_change",
      targetTeamId: body.teamId,
      meta: {
        plan: config.plan,
        overrides: config.overrides ?? null,
        exclusions: config.exclusions ?? null,
      },
    });

    const effective = await effectiveTierForTeam(body.teamId, plan);
    return NextResponse.json({ ok: true, config, effective });
  } catch (err) {
    captureError(err, { route: "tiering:patch" });
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
  }
}
