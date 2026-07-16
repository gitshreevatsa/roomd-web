"use client";

import { useEffect, useState } from "react";
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
  secret: string;
  html: string;
  text: string;
  loginUrl: string;
}

type Phase = "ready" | "sending" | "sent" | "copied";

/**
 * Review the invite email, then deliver via Send or Copy.
 * Key is already minted; this dialog is about delivery, not provisioning.
 */
export function AcceptInviteDialog({
  invite,
  onClose,
  onSent,
}: {
  invite: PreparedInvite | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    setPhase("ready");
    setSendError(null);
  }, [invite?.email, invite?.secret]);

  async function sendEmail() {
    if (!invite) return;
    setPhase("sending");
    setSendError(null);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: invite.email,
          secret: invite.secret,
        }),
      });
      const data = (await res.json()) as { emailed?: boolean; reason?: string; error?: string };
      if (!res.ok || !data.emailed) {
        setSendError(
          data.error ??
            data.reason ??
            "Email did not send. Copy the key and share it manually.",
        );
        setPhase("ready");
        return;
      }
      setPhase("sent");
      onSent?.();
    } catch {
      setSendError("Email did not send. Copy the key and share it manually.");
      setPhase("ready");
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setPhase("ready");
      setSendError(null);
      onClose();
    }
  }

  return (
    <Dialog open={!!invite} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept {invite?.email}</DialogTitle>
          <DialogDescription>
            Review the invite email, then send it or copy the key. This key is shown once.
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
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <CopyButton
              text={invite?.secret ?? ""}
              label="Copy key"
              onCopied={() => {
                setPhase("copied");
                onSent?.();
              }}
            />
            <CopyButton text={invite?.text ?? ""} label="Copy message" />
            <Button
              className="gap-1.5"
              disabled={!invite || phase === "sending" || phase === "sent"}
              onClick={() => void sendEmail()}
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

/** Shared helper to prepare an invite (mint key + email HTML). */
export async function prepareInvite(email: string): Promise<PreparedInvite> {
  const res = await fetch("/api/admin/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "prepare", email }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to prepare invite");
  }
  return (await res.json()) as PreparedInvite;
}
