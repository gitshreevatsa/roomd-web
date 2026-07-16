"use client";

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

export interface InviteResult {
  email: string;
  secret: string;
  emailed: boolean;
}

export function InviteResultDialog({
  invite,
  onClose,
}: {
  invite: InviteResult | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!invite} onOpenChange={(o) => !o && onClose()}>
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
          {invite?.emailed && (
            <Badge variant="green" className="text-xs">
              Emailed
            </Badge>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Their key</p>
            <div className="break-all rounded-md border bg-muted p-3 font-mono text-sm">
              {invite?.secret}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Message to send them
            </p>
            <div className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-sm">
              {inviteMessage(invite)}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <CopyButton text={invite?.secret ?? ""} label="Copy key" />
          <CopyButton text={inviteMessage(invite)} label="Copy message" />
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function inviteMessage(invite: InviteResult | null): string {
  if (!invite) return "";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.roomd.sh";
  return (
    `You're in. Sign in to roomd at ${origin}/login with this key:\n\n` +
    `${invite.secret}\n\n` +
    `It's tied to your own private workspace. Keep it somewhere safe.`
  );
}
