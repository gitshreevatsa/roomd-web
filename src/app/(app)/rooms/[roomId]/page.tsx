"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskBoard } from "@/components/TaskBoard";
import { AgentPresence } from "@/components/AgentPresence";
import { EventFeed } from "@/components/EventFeed";
import { ContextGrid } from "@/components/ContextGrid";
import { CopyButton } from "@/components/CopyButton";
import { PendingLink } from "@/components/PendingLink";
import { Settings, BookOpen, UserPlus } from "lucide-react";
import type { Plan, ContextEntry, Event, AgentPresence as AgentPresenceType } from "@/types";

interface RoomData {
  plan: Plan | null;
  context: ContextEntry[];
  events: Event[];
  agents: AgentPresenceType[];
}

const POLL_INTERVAL = 25000;

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [data, setData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roomName, setRoomName] = useState(roomId);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const [roomRes, metaRes] = await Promise.all([
          fetch(`/api/rooms/${roomId}`, { cache: "no-store" }),
          fetch(`/api/rooms`),
        ]);

        if (roomRes.ok) {
          const d = await roomRes.json() as RoomData;
          setData(d);
        }

        if (metaRes.ok) {
          const { rooms } = await metaRes.json() as { rooms: { roomId: string; name: string }[] };
          const meta = rooms.find((r) => r.roomId === roomId);
          if (meta) setRoomName(meta.name);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roomId]
  );

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const tasks = data?.plan?.tasks ?? [];
  const onlineAgents = (data?.agents ?? []).filter((a) => a.status === "online");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{roomName}</h1>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs text-muted-foreground">{roomId}</code>
            <CopyButton text={roomId} label="" className="h-6 w-6 p-0" />
            {onlineAgents.length > 0 ? (
              <Badge variant="green" className="text-xs">
                <span className="roomd-live h-1.5 w-1.5 rounded-full bg-primary" />
                {onlineAgents.length} agent{onlineAgents.length !== 1 ? "s" : ""} online
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                no agents online
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PendingLink href={`/rooms/${roomId}/setup`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Setup guide</span>
            </Button>
          </PendingLink>
          <PendingLink href="/admin">
            <Button variant="outline" size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Invite</span>
            </Button>
          </PendingLink>
          <PendingLink href="/admin">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
          </PendingLink>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 roomd-page-enter">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">
              Tasks
              {tasks.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="agents">
              Agents
              {(data?.agents ?? []).length > 0 && (
                <span className="ml-1.5 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                  {(data?.agents ?? []).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="events">
              Events
              {(data?.events ?? []).length > 0 && (
                <span className="ml-1.5 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                  {(data?.events ?? []).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="context">
              Context
              {(data?.context ?? []).length > 0 && (
                <span className="ml-1.5 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                  {(data?.context ?? []).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <TaskBoard
              tasks={tasks}
              roomId={roomId}
              onRefresh={() => fetchData(true)}
              refreshing={refreshing}
            />
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <AgentPresence
              agents={data?.agents ?? []}
              tasks={tasks}
              roomId={roomId}
              onRefresh={() => fetchData(true)}
              refreshing={refreshing}
            />
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <EventFeed
              events={data?.events ?? []}
              onRefresh={() => fetchData(true)}
              refreshing={refreshing}
            />
          </TabsContent>

          <TabsContent value="context" className="mt-4">
            <ContextGrid
              entries={data?.context ?? []}
              onRefresh={() => fetchData(true)}
              refreshing={refreshing}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
