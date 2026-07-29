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

/**
 * Review the invite email, then deliver via Send and/or Copy.
 * Closing without either abandons the draft and revokes the minted key.
 * Copy then Send is allowed — the draft stays until email succeeds or close.
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
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    setBusy(false);
    setCopied(false);
    setEmailed(false);
    setSendError(null);
    inFlight.current = false;
  }, [invite?.email, invite?.secret]);

  async function confirm(delivery: "email" | "copy") {
    if (!invite || inFlight.current) return;
    if (delivery === "copy" && copied) return;
    if (delivery === "email" && emailed) return;

    inFlight.current = true;
    setBusy(true);
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
        return;
      }
      if (delivery === "email") setEmailed(true);
      else setCopied(true);
      onDelivered?.();
    } catch {
      setSendError("Something went wrong. Try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function cleanupOnClose() {
    if (!invite || inFlight.current) return;
    // Email confirm already deleted the draft. Skip if we only emailed.
    if (emailed) return;
    // No delivery → revoke key. Copy-only → draft has confirmedAt, so abandon
    // only clears the leftover draft (does not revoke).
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
      await cleanupOnClose();
      setBusy(false);
      setCopied(false);
      setEmailed(false);
      setSendError(null);
      onClose();
    }
  }

  const done = copied || emailed;

  return (
    <Dialog open={!!invite} onOpenChange={(o) => void handleOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invite?.source === "waitlist" ? "Accept" : "Invite"} {invite?.email}
          </DialogTitle>
          <DialogDescription>
            Preview the email, then send it and/or copy the key. You can do both.
            Closing without either cancels the invite.
          </DialogDescription>
        </DialogHeader>

        {invite && (
          <div className="space-y-4">
            {done && (
              <Badge variant="green" className="text-xs">
                {emailed && copied
                  ? "Key copied and email sent"
                  : emailed
                    ? "Email sent"
                    : "Key copied. You can still send the email."}
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
            {done ? "Done" : "Cancel"}
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!invite || busy || copied}
              onClick={() => void confirm("copy")}
            >
              {copied ? "Key copied" : "Copy key & confirm"}
            </Button>
            <CopyButton text={invite?.text ?? ""} label="Copy message" />
            <Button
              className="gap-1.5"
              disabled={!invite || busy || emailed}
              onClick={() => void confirm("email")}
            >
              {busy && !emailed ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {emailed ? "Sent" : "Send email"}
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
