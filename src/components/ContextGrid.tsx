"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatRelativeTime } from "@/lib/utils";
import type { ContextEntry, ContextType } from "@/types";

const TYPE_BADGE: Record<ContextType, "blue" | "purple" | "orange" | "red" | "gray"> = {
  api_contract: "blue",
  arch_decision: "purple",
  task: "gray",
  change_request: "orange",
  note: "gray",
};

const TYPE_LABEL: Record<ContextType, string> = {
  api_contract: "API Contract",
  arch_decision: "Arch Decision",
  task: "Task",
  change_request: "Change Request",
  note: "Note",
};

interface ContextGridProps {
  entries: ContextEntry[];
  onRefresh: () => void;
  refreshing?: boolean;
}

export function ContextGrid({ entries, onRefresh, refreshing }: ContextGridProps) {
  const [selected, setSelected] = useState<ContextEntry | null>(null);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-2">
        <p className="font-medium">No context stored yet.</p>
        <p className="text-sm max-w-sm">
          Agents write structured context using write_context: API contracts, architecture
          decisions, notes, and more.
        </p>
      </div>
    );
  }

  // Group by type
  const grouped = entries.reduce<Partial<Record<ContextType, ContextEntry[]>>>(
    (acc, entry) => {
      const key = entry.type as ContextType;
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(entry);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
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

      {(Object.keys(grouped) as ContextType[]).map((type) => (
        <div key={type} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {TYPE_LABEL[type]} ({grouped[type]!.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped[type]!.map((entry) => (
              <Card
                key={entry.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelected(entry)}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant={TYPE_BADGE[entry.type as ContextType]} className="shrink-0">
                      {TYPE_LABEL[entry.type as ContextType]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  <p className="text-sm font-medium line-clamp-2">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">by {entry.author}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={TYPE_BADGE[selected.type as ContextType]}>
                  {TYPE_LABEL[selected.type as ContextType]}
                </Badge>
              </div>
              <SheetTitle className="text-left">{selected.summary}</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Author</div>
                <div>{selected.author}</div>
                <div className="text-muted-foreground">Timestamp</div>
                <div>{formatRelativeTime(selected.timestamp)}</div>
                <div className="text-muted-foreground">Version</div>
                <div>{selected.version}</div>
                {selected.consuming_agents.length > 0 && (
                  <>
                    <div className="text-muted-foreground">Consuming agents</div>
                    <div>{selected.consuming_agents.join(", ")}</div>
                  </>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Payload</p>
                <pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto whitespace-pre">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
