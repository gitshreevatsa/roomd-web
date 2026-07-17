"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { formatDate } from "@/lib/utils";
import type { DynKey, InviteToken, RoomSummary } from "@/types";
import type { WebhookRow } from "@/lib/roomd";
import { Plus, Trash2, Send } from "lucide-react";

type PendingDelete =
  | { kind: "key"; id: string; label: string }
  | { kind: "invite"; id: string; label: string }
  | { kind: "webhook"; id: string; label: string };

interface InviteResult {
  email: string;
  secret: string;
  emailed: boolean;
}

export default function AdminPage() {
  const [keys, setKeys] = useState<DynKey[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  const [newKey, setNewKey] = useState<string | null>(null);
  const [newInvite, setNewInvite] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState("never");

  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [teammateEmail, setTeammateEmail] = useState("");
  const [keyNote, setKeyNote] = useState("");
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [loading, setLoading] = useState(false);

  async function fetchKeys() {
    const res = await fetch("/api/admin/keys");
    if (res.ok) {
      const data = await res.json() as { keys: DynKey[] };
      setKeys(data.keys);
    }
  }

  async function fetchWebhooks() {
    const res = await fetch("/api/admin/webhooks");
    if (res.ok) {
      const data = (await res.json()) as { webhooks: WebhookRow[] };
      setWebhooks(data.webhooks);
    }
  }

  async function addWebhook() {
    const url = webhookUrl.trim();
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = (await res.json()) as { secret: string };
        setNewWebhookSecret(data.secret);
        setWebhookUrl("");
        void fetchWebhooks();
      }
    } finally {
      setLoading(false);
    }
  }

  async function removeWebhook(id: string) {
    await fetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
    void fetchWebhooks();
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) return;
    setConfirmBusy(true);
    try {
      if (pendingDelete.kind === "key") {
        await revokeKey(pendingDelete.id);
      } else if (pendingDelete.kind === "invite") {
        await revokeInvite(pendingDelete.id);
      } else {
        await removeWebhook(pendingDelete.id);
      }
      setPendingDelete(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function fetchRooms() {
    const res = await fetch("/api/rooms");
    if (res.ok) {
      const data = await res.json() as { rooms: RoomSummary[] };
      setRooms(data.rooms);
      if (data.rooms.length > 0 && !selectedRoom) {
        setSelectedRoom(data.rooms[0].roomId);
      }
    }
  }

  async function fetchInvites(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}/invite`);
    if (res.ok) {
      const data = await res.json() as { invites: InviteToken[] };
      setInvites(data.invites);
    }
  }

  async function inviteTeammate() {
    const email = teammateEmail.trim();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/keys/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = (await res.json()) as InviteResult;
        setInviteResult(data);
        setTeammateEmail("");
        fetchKeys();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
    fetchRooms();
    void fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRoom) fetchInvites(selectedRoom);
  }, [selectedRoom]);

  async function createKey() {
    const note = keyNote.trim();
    if (!note) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        const data = await res.json() as { secret: string };
        // Keep keyNote so the result step can show the (now fixed) name.
        setNewKey(data.secret);
        fetchKeys();
      }
    } finally {
      setLoading(false);
    }
  }

  /** Reset and close the create-key dialog. */
  function closeCreateKey() {
    setCreateKeyOpen(false);
    setNewKey(null);
    setKeyNote("");
  }

  async function revokeKey(keyId: string) {
    await fetch(`/api/admin/keys/${keyId}`, { method: "DELETE" });
    fetchKeys();
  }

  async function createInvite() {
    if (!selectedRoom) return;
    setLoading(true);
    try {
      const expiresIn =
        inviteExpiry === "never"
          ? undefined
          : inviteExpiry === "24h"
          ? 86400
          : inviteExpiry === "7d"
          ? 604800
          : undefined;

      const res = await fetch(`/api/rooms/${selectedRoom}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expiresIn !== undefined ? { expiresIn } : {}),
      });
      if (res.ok) {
        const data = await res.json() as { token: string };
        setNewInvite(data.token);
        fetchInvites(selectedRoom);
      }
    } finally {
      setLoading(false);
    }
  }

  async function revokeInvite(tokenId: string) {
    await fetch(`/api/rooms/${selectedRoom}/invite?tokenId=${tokenId}`, {
      method: "DELETE",
    });
    fetchInvites(selectedRoom);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates into your workspace, manage your keys, and share individual rooms.
        </p>
      </div>

      {/* Section 1: API Keys and teammates */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Teammates &amp; keys</CardTitle>
              <CardDescription className="mt-1">
                A key signs someone in to your team and all its rooms. Invite a teammate by
                email, or create a key to hand out yourself.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={teammateEmail}
                  onChange={(e) => setTeammateEmail(e.target.value)}
                  className="h-9 w-full sm:w-56"
                />
                <Button
                  size="sm"
                  onClick={inviteTeammate}
                  disabled={loading || !teammateEmail.trim()}
                  className="gap-1.5 shrink-0"
                >
                  <Send className="h-4 w-4" />
                  Invite
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateKeyOpen(true)}
                className="gap-1.5 sm:self-end"
              >
                <Plus className="h-4 w-4" />
                Create key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Note</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Key ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Secret hint</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {keys.map((key) => (
                    <tr key={key.keyId}>
                      <td className="px-4 py-2">
                        {key.note || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{key.keyId.slice(0, 10)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{key.hint}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {key.createdAt ? formatDate(key.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive gap-1"
                          onClick={() =>
                            setPendingDelete({
                              kind: "key",
                              id: key.keyId,
                              label: key.note || key.keyId.slice(0, 10),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription className="mt-1">
            HTTPS endpoints notified when room events are posted. Verify with the
            X-Roomd-Signature HMAC header.
          </CardDescription>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              type="url"
              placeholder="https://example.com/hooks/roomd"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="sm:max-w-md"
            />
            <Button
              size="sm"
              onClick={() => void addWebhook()}
              disabled={loading || !webhookUrl.trim()}
              className="gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">URL</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Secret</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {webhooks.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-2 font-mono text-xs break-all">{h.url}</td>
                      <td className="px-4 py-2 font-mono text-xs">{h.secretHint}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {h.createdAt ? formatDate(h.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive gap-1"
                          onClick={() =>
                            setPendingDelete({
                              kind: "webhook",
                              id: h.id,
                              label: h.url,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!newWebhookSecret} onOpenChange={(o) => !o && setNewWebhookSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook secret</DialogTitle>
            <DialogDescription>
              Save this now. It won&apos;t be shown again. Use it to verify X-Roomd-Signature.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted p-3 font-mono text-sm break-all">
            {newWebhookSecret}
          </div>
          <DialogFooter className="gap-2">
            <CopyButton text={newWebhookSecret ?? ""} label="Copy secret" />
            <Button variant="outline" onClick={() => setNewWebhookSecret(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section 2: Room Invites */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Room invites</CardTitle>
              <CardDescription className="mt-1">
                Room-scoped tokens let someone access one room only.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {rooms.length > 0 && (
                <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                  <SelectTrigger className="w-48 h-9 text-sm">
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r.roomId} value={r.roomId}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={inviteExpiry} onValueChange={setInviteExpiry}>
                <SelectTrigger className="w-28 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={createInvite}
                disabled={loading || !selectedRoom}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Create invite
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedRoom ? (
            <p className="text-sm text-muted-foreground">
              {rooms.length === 0
                ? "Create a room first to manage invites."
                : "Select a room to see its invites."}
            </p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active invites for this room.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Token ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Hint</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Expires</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invites.map((inv) => (
                    <tr key={inv.tokenId}>
                      <td className="px-4 py-2 font-mono text-xs">{inv.tokenId.slice(0, 10)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{inv.hint}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {inv.createdAt ? formatDate(inv.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {inv.expiresAt ? formatDate(inv.expiresAt) : "never"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive gap-1"
                          onClick={() =>
                            setPendingDelete({
                              kind: "invite",
                              id: inv.tokenId,
                              label: inv.tokenId.slice(0, 10),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create key dialog: name it, create, then reveal the key + name (read-only) */}
      <Dialog open={createKeyOpen} onOpenChange={(o) => { if (!o) closeCreateKey(); }}>
        <DialogContent>
          {!newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Create a key</DialogTitle>
                <DialogDescription>
                  Give it a name so you remember what it&apos;s for later. You can&apos;t change
                  the name after this.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  autoFocus
                  placeholder="e.g. Maya's laptop, CI test"
                  value={keyNote}
                  onChange={(e) => setKeyNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && keyNote.trim() && !loading) createKey();
                  }}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeCreateKey}>Cancel</Button>
                <Button onClick={createKey} disabled={loading || !keyNote.trim()}>
                  {loading ? "Creating…" : "Create key"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Key created</DialogTitle>
                <DialogDescription>
                  Save it now. It won&apos;t be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Name</p>
                  <div className="rounded-md border bg-muted p-3 text-sm">{keyNote}</div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Key</p>
                  <div className="rounded-md border bg-muted p-3 font-mono text-sm break-all">
                    {newKey}
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <CopyButton text={newKey ?? ""} label="Copy key" />
                <Button variant="outline" onClick={closeCreateKey}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New invite modal */}
      <Dialog open={!!newInvite} onOpenChange={(o) => !o && setNewInvite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Room invite created</DialogTitle>
            <DialogDescription>
              Save this now. It won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted p-4 font-mono text-sm break-all">
            {newInvite}
          </div>
          <DialogFooter className="gap-2">
            <CopyButton text={newInvite ?? ""} label="Copy token" />
            <Button variant="outline" onClick={() => setNewInvite(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite result modal: shown after inviting a teammate */}
      <Dialog open={!!inviteResult} onOpenChange={(o) => !o && setInviteResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invited {inviteResult?.email}</DialogTitle>
            <DialogDescription>
              {inviteResult?.emailed
                ? `We emailed the key to ${inviteResult?.email}. Here is a copy in case.`
                : `This key is shown once. Send it to ${inviteResult?.email} so they can sign in.`}{" "}
              They will join your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {inviteResult?.emailed && (
              <Badge variant="green" className="text-xs">Emailed</Badge>
            )}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Their key</p>
              <div className="rounded-md border bg-muted p-3 font-mono text-sm break-all">
                {inviteResult?.secret}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Message to send them</p>
              <div className="rounded-md border bg-muted p-3 text-sm whitespace-pre-wrap">
                {inviteMessage(inviteResult)}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <CopyButton text={inviteResult?.secret ?? ""} label="Copy key" />
            <CopyButton text={inviteMessage(inviteResult)} label="Copy message" />
            <Button variant="outline" onClick={() => setInviteResult(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !confirmBusy) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === "key"
            ? "Revoke this key?"
            : pendingDelete?.kind === "invite"
              ? "Revoke this invite?"
              : "Remove this webhook?"
        }
        description={
          pendingDelete?.kind === "key"
            ? `“${pendingDelete.label}” will stop working immediately. Anyone using it will be signed out.`
            : pendingDelete?.kind === "invite"
              ? `Invite ${pendingDelete.label}… will no longer work.`
              : `Stop sending events to ${pendingDelete?.label ?? "this endpoint"}.`
        }
        confirmLabel={
          pendingDelete?.kind === "webhook" ? "Remove" : "Revoke"
        }
        loading={confirmBusy}
        onConfirm={confirmPendingDelete}
      />
    </div>
  );
}

/** The ready-to-paste teammate-invite message, used when SMTP is off or as a copy. */
function inviteMessage(invite: InviteResult | null): string {
  if (!invite) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.roomd.sh";
  return (
    `Sign in to roomd at ${origin}/login with this key:\n\n` +
    `${invite.secret}\n\n` +
    `It joins you to our team. Keep it somewhere safe.`
  );
}
