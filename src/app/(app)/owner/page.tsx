"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OwnerNav } from "@/components/owner/OwnerNav";
import {
  AcceptInviteDialog,
  prepareInvite,
  type PreparedInvite,
} from "@/components/owner/AcceptInviteDialog";
import { formatDate } from "@/lib/utils";
import type { OrgInviteEntry } from "@/types";
import { Loader2, Send, ShieldOff, Trash2 } from "lucide-react";

/**
 * Owner → Invite: direct invites only (separate from waitlist).
 */
export default function OwnerInvitePage() {
  const [directEmail, setDirectEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<PreparedInvite | null>(null);
  const [invites, setInvites] = useState<OrgInviteEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [deleteEmail, setDeleteEmail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/access");
    if (res.ok) {
      const data = (await res.json()) as { invites: OrgInviteEntry[] };
      setInvites(data.invites.filter((i) => i.status !== "pending_delivery"));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startInvite() {
    const email = directEmail.trim();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const prepared = await prepareInvite(email, "direct");
      setInvite(prepared);
      setDirectEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  async function act(email: string, action: "disable" | "delete") {
    setRevoking(`${email}:${action}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, source: "direct" }),
      });
      if (!res.ok) {
        setError(action === "delete" ? "Could not delete" : "Could not disable");
        return;
      }
      if (action === "delete") setDeleteEmail(null);
      void refresh();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
        <p className="text-sm text-muted-foreground">
          Invite orgs directly. They show up here, not on the waitlist.
        </p>
      </div>

      <OwnerNav />

      <Card>
        <CardHeader>
          <CardTitle>Invite an org</CardTitle>
          <CardDescription className="mt-1">
            Enter their email, review the invite, then send or copy the key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="founder@company.com"
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void startInvite();
              }}
              className="sm:max-w-xs"
            />
            <Button
              onClick={() => void startInvite()}
              disabled={loading || !directEmail.trim()}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Continue
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent invites</CardTitle>
          <CardDescription className="mt-1">
            Orgs you invited. Disable pulls their key but keeps the row; Delete removes them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites sent yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-left font-medium">Sent</th>
                    <th className="px-4 py-2 text-left font-medium">Via</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invites.map((i) => (
                    <tr key={i.email}>
                      <td className="px-4 py-2 font-medium">{i.email}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {i.deliveredAt ? formatDate(i.deliveredAt) : formatDate(i.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {i.delivery === "email" ? "Email" : i.delivery === "copy" ? "Copied" : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {i.status === "delivered" ? (
                          <Badge variant="green" className="text-xs">
                            Active ···{i.keyHint}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          {i.status === "delivered" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={revoking === `${i.email}:disable`}
                              onClick={() => void act(i.email, "disable")}
                            >
                              {revoking === `${i.email}:disable` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ShieldOff className="h-3.5 w-3.5" />
                              )}
                              Disable
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            disabled={revoking === `${i.email}:delete`}
                            onClick={() => setDeleteEmail(i.email)}
                          >
                            {revoking === `${i.email}:delete` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AcceptInviteDialog
        invite={invite}
        onClose={() => setInvite(null)}
        onDelivered={() => void refresh()}
      />

      <ConfirmDialog
        open={!!deleteEmail}
        onOpenChange={(open) => {
          if (!open && !revoking) setDeleteEmail(null);
        }}
        title="Delete this invite?"
        description={
          deleteEmail
            ? `Delete ${deleteEmail}? Their keys will be revoked and this invite row removed.`
            : ""
        }
        loading={!!deleteEmail && revoking === `${deleteEmail}:delete`}
        onConfirm={() => {
          if (deleteEmail) void act(deleteEmail, "delete");
        }}
      />
    </div>
  );
}
