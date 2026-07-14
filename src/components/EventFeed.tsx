"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import type { Event } from "@/types";

const EVENT_COLORS: Record<string, string> = {
  task_updated: "border-l-blue-400",
  task_blocked: "border-l-red-400",
  change_request: "border-l-orange-400",
  contract_ready: "border-l-green-400",
  change_request_fulfilled: "border-l-green-300",
};

function eventBorderColor(type: string): string {
  return EVENT_COLORS[type] ?? "border-l-gray-300";
}

interface EventFeedProps {
  events: Event[];
  onRefresh: () => void;
  refreshing?: boolean;
}

export function EventFeed({ events, onRefresh, refreshing }: EventFeedProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-2">
        <p className="font-medium">No events yet.</p>
        <p className="text-sm max-w-sm">
          Events appear here as agents coordinate: task updates, change requests, contract
          notifications, etc.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
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

      <div className="rounded-md border divide-y">
        {events.map((event) => {
          const isExpanded = expanded.has(event.id);
          return (
            <div key={event.id}>
              <button
                className={`w-full text-left px-4 py-3 border-l-4 hover:bg-muted/50 transition-colors ${eventBorderColor(event.type)}`}
                onClick={() => toggle(event.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {event.from} → {event.to}
                    </span>
                    <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {event.type}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-1 bg-muted/20">
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre bg-muted p-3 rounded-md">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
