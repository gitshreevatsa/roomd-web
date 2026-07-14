"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32)
    .replace(/^-|-$/g, "");
}

export default function NewRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [roomIdEdited, setRoomIdEdited] = useState(false);
  const [roomIdError, setRoomIdError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (roomIdEdited) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRoomId(slugify(name));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, roomIdEdited]);

  function handleRoomIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
    setRoomId(val);
    setRoomIdEdited(true);
    if (val && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(val) && val.length > 1) {
      setRoomIdError("Only lowercase letters, numbers, and hyphens. Must not start/end with hyphen.");
    } else {
      setRoomIdError("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !roomId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), roomId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create room");
      }
      const { roomId: created } = await res.json();
      router.push(`/rooms/${created}/setup`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create a room</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rooms are namespaced workspaces for a project.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Room details</CardTitle>
          <CardDescription>
            The room ID is what your agents use in tool calls. Keep it short and memorable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Room name</Label>
              <Input
                id="name"
                placeholder="My SaaS Backend"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="roomId">
                Room ID
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  (used in tool calls)
                </span>
              </Label>
              <Input
                id="roomId"
                placeholder="my-saas-backend"
                value={roomId}
                onChange={handleRoomIdChange}
                className="font-mono"
                required
              />
              {roomIdError && (
                <p className="text-xs text-destructive">{roomIdError}</p>
              )}
              {!roomIdError && roomId && (
                <p className="text-xs text-muted-foreground">
                  Agents will call:{" "}
                  <code className="text-foreground">
                    read_plan(&#123; roomId: &quot;{roomId}&quot; &#125;)
                  </code>
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Cancel</Button>
              </Link>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !name || !roomId || !!roomIdError}
              >
                {loading ? "Creating…" : "Create room →"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
