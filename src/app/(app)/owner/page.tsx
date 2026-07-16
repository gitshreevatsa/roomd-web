"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OwnerNav } from "@/components/owner/OwnerNav";
import {
  InviteResultDialog,
  type InviteResult,
} from "@/components/owner/InviteResultDialog";
import { Send } from "lucide-react";

/**
 * Owner → Invite: issue access directly (not from the waitlist).
 * Waitlist requests live on /owner/waitlist.
 */
export default function OwnerInvitePage() {
  const [directEmail, setDirectEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function issueKey() {
    const email = directEmail.trim();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError("Invite failed. Check the email and try again.");
        return;
      }
      const data = (await res.json()) as InviteResult;
      setInvite(data);
      setDirectEmail("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
        <p className="text-sm text-muted-foreground">
          Invite orgs directly. Each invite provisions an isolated workspace and emails
          the key when SMTP is configured.
        </p>
      </div>

      <OwnerNav />

      <Card>
        <CardHeader>
          <CardTitle>Invite an org</CardTitle>
          <CardDescription className="mt-1">
            Send a key to someone who never joined the waitlist. They get a fresh private
            workspace.
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
                if (e.key === "Enter") void issueKey();
              }}
              className="sm:max-w-xs"
            />
            <Button
              onClick={() => void issueKey()}
              disabled={loading || !directEmail.trim()}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              Invite &amp; email key
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <InviteResultDialog invite={invite} onClose={() => setInvite(null)} />
    </div>
  );
}
