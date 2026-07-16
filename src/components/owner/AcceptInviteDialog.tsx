"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/CopyButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Send } from "lucide-react";

export interface PreparedInvite {
  email: string;
  source: "direct" | "waitlist";
  secret: string;
  keyId: string;
  html: string;
  text: string;
  loginUrl: string;
}

type Phase = "ready" | "sending" | "sent" | "copied";

/**
 * Review the invite email, then deliver via Send or Copy.
 * Closing without Send/Copy abandons the draft and revokes the minted key.
 */
export function AcceptInviteDialog({
  invite,
  onClose,
  onDelivered,
}: {
  invite: PreparedInvite | null;
  onClose: () => void;
  onDelivered?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [sendError, setSendError] = useState<string | null>(null);
  const delivered = useRef(false);

  useEffect(() => {
    setPhase("ready");
    setSendError(null);
    delivered.current = false;
  }, [invite?.email, invite?.secret]);

  async function confirm(delivery: "email" | "copy") {
    if (!invite) return;
    if (delivery === "email") setPhase("sending");
    setSendError(null);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          email: invite.email,
          secret: invite.secret,
          delivery,
        }),
      });
      const data = (await res.json()) as {
        confirmed?: boolean;
        emailed?: boolean;
        reason?: string;
        error?: string;
      };
      if (!res.ok || !data.confirmed) {
        setSendError(
          data.error ??
            data.reason ??
            (delivery === "email"
              ? "Email did not send. Try Copy key instead."
              : "Could not confirm invite."),
        );
        setPhase("ready");
        return;
      }
      delivered.current = true;
      setPhase(delivery === "email" ? "sent" : "copied");
      onDelivered?.();
    } catch {
      setSendError("Something went wrong. Try again.");
      setPhase("ready");
    }
  }

  async function abandonIfNeeded() {
    if (!invite || delivered.current) return;
    try {
      await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abandon", email: invite.email }),
      });
    } catch {
      // best-effort cleanup
    }
  }

  async function handleOpenChange(open: boolean) {
    if (!open) {
      await abandonIfNeeded();
      setPhase("ready");
      setSendError(null);
      onClose();
    }
  }

  return (
    <Dialog open={!!invite} onOpenChange={(o) => void handleOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invite?.source === "waitlist" ? "Accept" : "Invite"} {invite?.email}
          </DialogTitle>
          <DialogDescription>
            Preview the email, then send it or copy the key. Closing without either cancels
            the invite.
          </DialogDescription>
        </DialogHeader>

        {invite && (
          <div className="space-y-4">
            {(phase === "sent" || phase === "copied") && (
              <Badge variant="green" className="text-xs">
                {phase === "sent" ? "Email sent" : "Key copied — share it with them"}
              </Badge>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">API key</p>
              <div className="break-all rounded-md border bg-muted px-3 py-2.5 font-mono text-sm">
                {invite.secret}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Email preview</p>
              <div className="overflow-hidden rounded-lg border bg-[#f4f4f5]">
                <iframe
                  title="Invite email preview"
                  srcDoc={invite.html}
                  className="h-[360px] w-full border-0 bg-white"
                  sandbox=""
                />
              </div>
            </div>

            {sendError && <p className="text-sm text-destructive">{sendError}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => void handleOpenChange(false)}>
            {phase === "sent" || phase === "copied" ? "Done" : "Cancel"}
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!invite || phase === "sending" || phase === "sent" || phase === "copied"}
              onClick={() => void confirm("copy")}
            >
              Copy key &amp; confirm
            </Button>
            <CopyButton text={invite?.text ?? ""} label="Copy message" />
            <Button
              className="gap-1.5"
              disabled={!invite || phase === "sending" || phase === "sent" || phase === "copied"}
              onClick={() => void confirm("email")}
            >
              {phase === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {phase === "sent" ? "Sent" : "Send email"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function prepareInvite(
  email: string,
  source: "direct" | "waitlist",
): Promise<PreparedInvite> {
  const res = await fetch("/api/admin/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "prepare", email, source }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to prepare invite");
  }
  return (await res.json()) as PreparedInvite;
}
