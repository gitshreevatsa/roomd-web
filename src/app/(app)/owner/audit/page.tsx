"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { AuditEntry } from "@/lib/audit";
import { Loader2, RefreshCw } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  "user.disable": "Disabled access",
  "user.enable": "Re-enabled access",
  "user.delete": "Removed account",
  "keys.revoke_team": "Revoked team keys",
  "invites.revoke_team": "Revoked team invites",
  "keys.invite_teammate": "Invited teammate",
  "access.prepare": "Prepared invite",
  "access.confirm": "Sent / delivered invite",
  "access.abandon": "Cancelled invite",
  "access.redeem": "Redeemed invite",
  "membership.add": "Added member",
  "membership.remove": "Removed member",
  "operator.bootstrap": "Operator bootstrap",
  "billing.plan_change": "Plan changed",
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

/**
 * Operator-only activity log. Backed by Redis audit entries written from
 * invite / disable / delete paths. Invisible to non-operators (layout gate + API 403).
 */
export default function OwnerAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/audit?limit=200", { credentials: "same-origin" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not load activity");
        setEntries([]);
        return;
      }
      const data = (await res.json()) as { entries: AuditEntry[] };
      setEntries(data.entries ?? []);
    } catch {
      setError("Could not load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
          <p className="text-sm text-muted-foreground">
            Your private activity log — invites, disables, and removals.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <OwnerNav />

      <Card>
        <CardHeader>
          <CardTitle>
            Activity
            {!loading && (
              <Badge variant="outline" className="ml-2 text-xs">
                {entries.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="mt-1">
            Only visible to the operator account. Newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          {loading && entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing logged yet. Invite, disable, or remove someone and it will show up here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">When</th>
                    <th className="px-4 py-2 text-left font-medium">What</th>
                    <th className="px-4 py-2 text-left font-medium">Who</th>
                    <th className="px-4 py-2 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2 align-top text-muted-foreground">
                        <div title={formatDate(e.at)}>{formatRelativeTime(e.at)}</div>
                      </td>
                      <td className="px-4 py-2 align-top font-medium">{actionLabel(e.action)}</td>
                      <td className="px-4 py-2 align-top">
                        {e.targetEmail ?? e.targetUserId ?? e.targetTeamId ?? "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-muted-foreground">
                        {e.meta && Object.keys(e.meta).length > 0
                          ? Object.entries(e.meta)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(" · ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
