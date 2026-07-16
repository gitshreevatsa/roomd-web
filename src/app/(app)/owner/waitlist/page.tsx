"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerNav } from "@/components/owner/OwnerNav";
import {
  InviteResultDialog,
  type InviteResult,
} from "@/components/owner/InviteResultDialog";
import { formatDate } from "@/lib/utils";
import type { WaitlistEntry } from "@/types";
import { Send, Trash2 } from "lucide-react";

/**
 * Owner → Waitlist: people who requested access from the landing page.
 */
export default function OwnerWaitlistPage() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteResult | null>(null);

  async function fetchWaitlist() {
    const res = await fetch("/api/admin/waitlist");
    if (res.ok) {
      const data = (await res.json()) as { entries: WaitlistEntry[] };
      setWaitlist(data.entries);
    }
  }

  useEffect(() => {
    void fetchWaitlist();
  }, []);

  async function issueKey(email: string) {
    setBusyEmail(email);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = (await res.json()) as InviteResult;
        setInvite(data);
        void fetchWaitlist();
      }
    } finally {
      setBusyEmail(null);
    }
  }

  async function remove(email: string) {
    await fetch(`/api/admin/waitlist?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
    void fetchWaitlist();
  }

  const pending = waitlist.filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
        <p className="text-sm text-muted-foreground">
          Requests from roomd.sh/waitlist. Invite to provision a key and email them.
        </p>
      </div>

      <OwnerNav />

      <Card>
        <CardHeader>
          <CardTitle>
            Waitlist
            {pending > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                {pending} pending
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="mt-1">
            Everyone who requested access from the landing page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {waitlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has requested access yet.</p>
          ) : (
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
                  {waitlist.map((w) => (
                    <tr key={w.email}>
                      <td className="px-4 py-2">{w.email}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {w.createdAt ? formatDate(w.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        {w.status === "invited" ? (
                          <Badge variant="green" className="text-xs">
                            Invited
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={busyEmail === w.email}
                            onClick={() => void issueKey(w.email)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            {w.status === "invited" ? "New key" : "Invite & create key"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => void remove(w.email)}
                            aria-label={`Remove ${w.email}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      <InviteResultDialog invite={invite} onClose={() => setInvite(null)} />
    </div>
  );
}
