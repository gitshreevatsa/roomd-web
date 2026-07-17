"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { formatDate } from "@/lib/utils";
import { Loader2, ShieldOff, Trash2, Undo2 } from "lucide-react";

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  teamId: string;
  authMethods: string[];
  createdAt: string;
  disabledAt: string | null;
  source: "invite" | "waitlist" | "unknown";
}

/**
 * Owner directory: every dashboard user/org, with Disable vs Delete.
 */
export default function OwnerUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteUser, setDeleteUser] = useState<{ id: string; label: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = (await res.json()) as { users: UserRow[] };
      setUsers(data.users);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(userId: string, action: "disable" | "enable" | "delete") {
    setBusy(`${userId}:${action}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Action failed");
        return;
      }
      if (action === "delete") setDeleteUser(null);
      void refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
        <p className="text-sm text-muted-foreground">
          All dashboard users and orgs. Disable blocks access but keeps the row; Delete
          removes them.
        </p>
      </div>

      <OwnerNav />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>
            Users &amp; orgs
            <Badge variant="outline" className="ml-2 text-xs">
              {users.length}
            </Badge>
          </CardTitle>
          <CardDescription className="mt-1">
            Anyone who has signed in to the dashboard. Source shows how they were onboarded
            when we know.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">User / org</th>
                    <th className="px-4 py-2 text-left font-medium">Source</th>
                    <th className="px-4 py-2 text-left font-medium">Joined</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className={u.disabledAt ? "opacity-70" : undefined}>
                      <td className="px-4 py-2">
                        <div className="font-medium">
                          {u.email ?? u.name ?? "API-key account"}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{u.teamId}</div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground capitalize">{u.source}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        {u.disabledAt ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Disabled
                          </Badge>
                        ) : (
                          <Badge variant="green" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          {u.disabledAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={busy === `${u.id}:enable`}
                              onClick={() => void act(u.id, "enable")}
                            >
                              {busy === `${u.id}:enable` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="h-3.5 w-3.5" />
                              )}
                              Enable
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={busy === `${u.id}:disable`}
                              onClick={() => void act(u.id, "disable")}
                            >
                              {busy === `${u.id}:disable` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ShieldOff className="h-3.5 w-3.5" />
                              )}
                              Disable
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            disabled={busy === `${u.id}:delete`}
                            onClick={() =>
                              setDeleteUser({
                                id: u.id,
                                label: u.email ?? u.name ?? "this user",
                              })
                            }
                          >
                            {busy === `${u.id}:delete` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
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

      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteUser(null);
        }}
        title="Delete this user?"
        description={
          deleteUser
            ? `Delete ${deleteUser.label} permanently? Their API keys will be revoked and the account removed.`
            : ""
        }
        loading={!!deleteUser && busy === `${deleteUser.id}:delete`}
        onConfirm={() => {
          if (deleteUser) void act(deleteUser.id, "delete");
        }}
      />
    </div>
  );
}
