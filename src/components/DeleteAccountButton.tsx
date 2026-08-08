"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function DeleteAccountButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => setOpen(true)}
      >
        Delete account
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title="Delete your account?"
        description="This permanently removes your account. API keys will be revoked and you will be signed out."
        confirmLabel="Delete account"
        loading={pending}
        onConfirm={() => {
          startTransition(async () => {
            await action();
          });
        }}
      />
    </>
  );
}
