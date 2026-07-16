"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OwnerNav } from "@/components/owner/OwnerNav";
import {
  AcceptInviteDialog,
  prepareInvite,
  type PreparedInvite,
} from "@/components/owner/AcceptInviteDialog";
import { Loader2, Send } from "lucide-react";

/**
 * Owner → Invite: issue access directly. Opens the same review dialog as Accept
 * on the waitlist (preview → Send email or Copy key).
 */
export default function OwnerInvitePage() {
  const [directEmail, setDirectEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<PreparedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startInvite() {
    const email = directEmail.trim();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const prepared = await prepareInvite(email);
      setInvite(prepared);
      setDirectEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
        <p className="text-sm text-muted-foreground">
          Invite someone who never joined the waitlist. You&apos;ll review the email, then
          send or copy their key.
        </p>
      </div>

      <OwnerNav />

      <Card>
        <CardHeader>
          <CardTitle>Invite an org</CardTitle>
          <CardDescription className="mt-1">
            Enter their email. Next you&apos;ll see the invite preview before anything is
            sent.
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

      <AcceptInviteDialog invite={invite} onClose={() => setInvite(null)} />
    </div>
  );
}
