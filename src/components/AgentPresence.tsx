"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import type { AgentPresence as AgentPresenceType, Task } from "@/types";
import { PendingLink } from "@/components/PendingLink";

interface AgentPresenceProps {
  agents: AgentPresenceType[];
  tasks: Task[];
  roomId: string;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function AgentPresence({ agents, tasks, roomId, onRefresh, refreshing }: AgentPresenceProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-3">
        <p className="font-medium">No agents have connected yet.</p>
        <p className="text-sm">Follow the setup guide to connect your first agent (Claude Code, Cursor, or any MCP client).</p>
        <PendingLink href={`/rooms/${roomId}/setup`}>
          <Button variant="outline" size="sm">Open setup guide</Button>
        </PendingLink>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const isOnline = agent.status === "online";
          const activeTask = tasks.find(
            (t) => t.owner === agent.agentId && t.status === "in_progress"
          );

          return (
            <div
              key={agent.agentId}
              className="rounded-lg border p-4 space-y-1"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    isOnline ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <span className="font-medium text-sm truncate">{agent.agentId}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isOnline ? "online" : "offline"} · last seen{" "}
                {formatRelativeTime(agent.lastSeen)}
              </p>
              {activeTask ? (
                <p className="text-xs text-blue-600 truncate">
                  Working on: {activeTask.title}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No active task</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
