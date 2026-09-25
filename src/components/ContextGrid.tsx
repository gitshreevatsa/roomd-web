"use client";

import { Fragment, useState } from "react";
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

/** Chat notes store prose in `payload.text` — show that, not a one-line JSON dump. */
function hasProseText(payload: Record<string, unknown>): boolean {
  return typeof payload.text === "string" && payload.text.trim().length > 0;
}

function formatMetaValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function ContextPayloadView({ payload }: { payload: Record<string, unknown> }) {
  if (hasProseText(payload)) {
    const text = payload.text as string;
    const meta = Object.entries(payload).filter(([key]) => key !== "text");

    return (
      <div className="space-y-3">
        {meta.length > 0 && (
          <div className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
            {meta.map(([key, value]) => (
              <Fragment key={key}>
                <div className="text-muted-foreground">{key}</div>
                <div className="min-w-0 break-words">{formatMetaValue(value)}</div>
              </Fragment>
            ))}
          </div>
        )}
        <div className="rounded-md bg-muted p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {text}
        </div>
      </div>
    );
  }

  return (
    <pre className="max-h-none overflow-x-hidden overflow-y-visible whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
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

      {/* Detail drawer — vertical scroll; wrap long payload text instead of horizontal scroll */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
            <div className="shrink-0 space-y-4 border-b px-6 pb-4 pt-6 pr-12">
              <SheetHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={TYPE_BADGE[selected.type as ContextType]}>
                    {TYPE_LABEL[selected.type as ContextType]}
                  </Badge>
                </div>
                <SheetTitle className="text-left break-words [overflow-wrap:anywhere]">
                  {selected.summary}
                </SheetTitle>
              </SheetHeader>

              <div className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <div className="text-muted-foreground">Author</div>
                <div className="min-w-0 break-words">{selected.author}</div>
                <div className="text-muted-foreground">Timestamp</div>
                <div>{formatRelativeTime(selected.timestamp)}</div>
                <div className="text-muted-foreground">Version</div>
                <div>{selected.version}</div>
                {selected.consuming_agents.length > 0 && (
                  <>
                    <div className="text-muted-foreground">Consuming agents</div>
                    <div className="min-w-0 break-words">
                      {selected.consuming_agents.join(", ")}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {hasProseText(selected.payload) ? "Message" : "Payload"}
                </p>
                <ContextPayloadView payload={selected.payload} />
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
