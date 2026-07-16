"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerNav } from "@/components/owner/OwnerNav";
import {
  AcceptInviteDialog,
  prepareInvite,
  type PreparedInvite,
} from "@/components/owner/AcceptInviteDialog";
import { formatDate } from "@/lib/utils";
import type { WaitlistEntry } from "@/types";
import { Check, Loader2, ShieldOff, X } from "lucide-react";

/**
 * Waitlist inbox only. Accept → review dialog → Send/Copy confirms.
 * Direct invites live on /owner, not here.
 */
export default function OwnerWaitlistPage() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [invite, setInvite] = useState<PreparedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/waitlist");
    if (res.ok) {
      const data = (await res.json()) as { entries: WaitlistEntry[] };
      setWaitlist(data.entries);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pending = useMemo(
    () => waitlist.filter((w) => w.status === "pending"),
    [waitlist],
  );
  const decided = useMemo(
    () => waitlist.filter((w) => w.status !== "pending"),
    [waitlist],
  );

  async function accept(email: string) {
    setBusyEmail(email);
    setError(null);
    try {
      const prepared = await prepareInvite(email, "waitlist");
      setInvite(prepared);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept this request");
    } finally {
      setBusyEmail(null);
    }
  }

  async function decline(email: string) {
    setBusyEmail(email);
    setError(null);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", email }),
      });
      if (!res.ok) {
        setError("Could not decline this request");
        return;
      }
      void refresh();
    } finally {
      setBusyEmail(null);
    }
  }

  async function revoke(email: string) {
    setBusyEmail(email);
    setError(null);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", email, source: "waitlist" }),
      });
      if (!res.ok) {
        setError("Could not revoke this key");
        return;
      }
      void refresh();
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
        <p className="text-sm text-muted-foreground">
          Landing-page requests only. Accept opens the invite for review — nothing is
          accepted until you send or copy the key.
        </p>
      </div>

      <OwnerNav />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>
            Pending
            {pending.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                {pending.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="mt-1">
            New requests from roomd.sh/waitlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-left font-medium">Requested</th>
                    <th className="px-4 py-2 text-right font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pending.map((w) => (
                    <tr key={w.email}>
                      <td className="px-4 py-3 font-medium">{w.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {w.createdAt ? formatDate(w.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={busyEmail === w.email}
                            onClick={() => void decline(w.email)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={busyEmail === w.email}
                            onClick={() => void accept(w.email)}
                          >
                            {busyEmail === w.email ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Accept
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

      {decided.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription className="mt-1">
              Accepted, declined, and revoked waitlist requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-left font-medium">Requested</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {decided.map((w) => (
                    <tr key={w.email}>
                      <td className="px-4 py-2">{w.email}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {w.createdAt ? formatDate(w.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        {w.status === "invited" ? (
                          <Badge variant="green" className="text-xs">
                            Accepted
                          </Badge>
                        ) : w.status === "revoked" ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Revoked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Declined
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {w.status === "invited" && w.keyId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            disabled={busyEmail === w.email}
                            onClick={() => void revoke(w.email)}
                          >
                            {busyEmail === w.email ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldOff className="h-3.5 w-3.5" />
                            )}
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AcceptInviteDialog
        invite={invite}
        onClose={() => {
          setInvite(null);
          void refresh();
        }}
        onDelivered={() => void refresh()}
      />
    </div>
  );
}
