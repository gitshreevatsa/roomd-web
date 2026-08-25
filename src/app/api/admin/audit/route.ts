import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity, isOperator } from "@/lib/session";
import { listGlobalAudit } from "@/lib/audit";
import { captureError } from "@/lib/telemetry";

/**
 * Operator-only audit feed (who invited / disabled / deleted whom).
 * GET /api/admin/audit?limit=100
 */
export async function GET(req: NextRequest) {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(identity)) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  const raw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(500, Math.max(1, parseInt(raw ?? "100", 10) || 100));

  try {
    const entries = await listGlobalAudit(limit);
    return NextResponse.json({ entries });
  } catch (err) {
    captureError(err, { route: "audit:list" });
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }
}
