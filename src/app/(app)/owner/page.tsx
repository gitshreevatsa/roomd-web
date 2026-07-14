"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/CopyButton";
import { formatDate } from "@/lib/utils";
import type { WaitlistEntry } from "@/types";
import { Send, Trash2, BarChart3 } from "lucide-react";

interface InviteResult {
  email: string;
  secret: string;
  emailed: boolean;
}

/**
 * The owner portal. Only the master-key holder reaches this (gated in
 * owner/layout.tsx). Review the waitlist, invite people, and hand out keys; each
 * invite provisions the person their own isolated org.
 */
export default function OwnerPage() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [directEmail, setDirectEmail] = useState("");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);

  async function fetchWaitlist() {
    const res = await fetch("/api/admin/waitlist");
    if (res.ok) {
      const data = (await res.json()) as { entries: WaitlistEntry[] };
      setWaitlist(data.entries);
    }
  }

  useEffect(() => {
    fetchWaitlist();
  }, []);

  async function issueKey(email: string, isDirect = false) {
    if (isDirect) setLoading(true);
    else setBusyEmail(email);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = (await res.json()) as InviteResult;
        setInvite(data);
        if (isDirect) setDirectEmail("");
        fetchWaitlist();
      }
    } finally {
      setBusyEmail(null);
      setLoading(false);
    }
  }

  async function remove(email: string) {
    await fetch(`/api/admin/waitlist?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    fetchWaitlist();
  }

  const pending = waitlist.filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
          <p className="text-sm text-muted-foreground">
            Issue access to people who requested it, and invite orgs directly. Each invite
            gives that person their own private workspace.
          </p>
        </div>
        <Link href="/owner/usage" className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Usage
          </Button>
        </Link>
      </div>

      {/* Invite someone directly (not necessarily on the waitlist) */}
      <Card>
        <CardHeader>
          <CardTitle>Invite an org</CardTitle>
          <CardDescription className="mt-1">
            Send someone a key even if they never joined the waitlist. They get a fresh,
            isolated workspace. We email the key when SMTP is set up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="founder@company.com"
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              className="sm:max-w-xs"
            />
            <Button
              onClick={() => issueKey(directEmail.trim(), true)}
              disabled={loading || !directEmail.trim()}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              Invite &amp; email key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist */}
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
            <div className="rounded-md border overflow-x-auto">
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
                          <Badge variant="green" className="text-xs">Invited</Badge>
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
                            onClick={() => issueKey(w.email)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            {w.status === "invited" ? "New key" : "Invite & create key"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => remove(w.email)}
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

      {/* Result modal: the key once, plus a message to send */}
      <Dialog open={!!invite} onOpenChange={(o) => !o && setInvite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invited {invite?.email}</DialogTitle>
            <DialogDescription>
              {invite?.emailed
                ? `We emailed the key to ${invite?.email}. Here is a copy in case.`
                : `This key is shown once. Send it to ${invite?.email} so they can sign in.`}{" "}
              They get their own private workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {invite?.emailed && <Badge variant="green" className="text-xs">Emailed</Badge>}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Their key</p>
              <div className="rounded-md border bg-muted p-3 font-mono text-sm break-all">
                {invite?.secret}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Message to send them</p>
              <div className="rounded-md border bg-muted p-3 text-sm whitespace-pre-wrap">
                {inviteMessage(invite)}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <CopyButton text={invite?.secret ?? ""} label="Copy key" />
            <CopyButton text={inviteMessage(invite)} label="Copy message" />
            <Button variant="outline" onClick={() => setInvite(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function inviteMessage(invite: InviteResult | null): string {
  if (!invite) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.roomd.sh";
  return (
    `You're in. Sign in to roomd at ${origin}/login with this key:\n\n` +
    `${invite.secret}\n\n` +
    `It's tied to your own private workspace. Keep it somewhere safe.`
  );
}
