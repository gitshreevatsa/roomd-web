"use client";

import { Button } from "@/components/ui/button";

export function DeleteAccountButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Delete your account permanently? API keys will be revoked and you will be signed out.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        type="submit"
        className="text-muted-foreground hover:text-destructive"
      >
        Delete account
      </Button>
    </form>
  );
}
