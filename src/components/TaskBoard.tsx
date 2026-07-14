"use client";

import { useState } from "react";
import { LayoutGrid, List, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

const STATUS_COLUMNS: TaskStatus[] = ["pending", "in_progress", "done", "blocked"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "bg-muted/50 border-border",
  in_progress: "bg-primary/5 border-primary/30",
  done: "bg-primary/10 border-primary/40",
  blocked: "bg-rose-500/5 border-rose-500/30",
};

const STATUS_BADGE: Record<TaskStatus, "gray" | "blue" | "green" | "red"> = {
  pending: "gray",
  in_progress: "blue",
  done: "green",
  blocked: "red",
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <div
      className={`cursor-pointer rounded-lg border p-3 transition-all hover:shadow-sm ${STATUS_COLORS[task.status]}`}
      onClick={onClick}
    >
      <p className="text-sm font-medium leading-snug mb-1">{task.title}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{task.owner ?? "unassigned"}</span>
        <span>{formatRelativeTime(task.updated_at)}</span>
      </div>
    </div>
  );
}

interface TaskBoardProps {
  tasks: Task[];
  roomId: string;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function TaskBoard({ tasks, roomId, onRefresh, refreshing }: TaskBoardProps) {
  const [view, setView] = useState<"kanban" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("taskView") as "kanban" | "list") ?? "kanban";
    }
    return "kanban";
  });
  const [selected, setSelected] = useState<Task | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  function toggleView(v: "kanban" | "list") {
    setView(v);
    localStorage.setItem("taskView", v);
  }

  async function handleStatusChange(status: string) {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      await fetch(`/api/rooms/${roomId}/tasks/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onRefresh();
      setSelected(null);
    } finally {
      setUpdatingStatus(false);
    }
  }

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-3">
        <p className="font-medium">No tasks yet</p>
        <p className="text-sm">Agents add tasks using the add_task tool.</p>
        <pre className="text-xs bg-muted p-3 rounded-md text-left">
          {`add_task({\n  roomId: "${roomId}",\n  title: "...",\n  description: "..."\n})`}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 max-w-sm">
          <Progress value={progressPct} className="h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {doneTasks}/{tasks.length} done
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none h-8"
              onClick={() => toggleView("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none h-8"
              onClick={() => toggleView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STATUS_COLUMNS.map((status) => {
            const col = tasks.filter((t) => t.status === status);
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {col.map((t) => (
                    <TaskCard key={t.id} task={t} onClick={() => setSelected(t)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 cursor-pointer"
              onClick={() => setSelected(task)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant={STATUS_BADGE[task.status]} className="shrink-0">
                  {STATUS_LABELS[task.status]}
                </Badge>
                <span className="text-sm font-medium truncate">{task.title}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                <span>{task.owner ?? "unassigned"}</span>
                <span>{formatRelativeTime(task.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    ID: <code className="text-xs">{selected.id}</code>
                  </p>
                  {selected.description && (
                    <p className="text-sm">{selected.description}</p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Owner</span>
                <span>{selected.owner ?? "unassigned"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatRelativeTime(selected.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Select
                  defaultValue={selected.status}
                  onValueChange={handleStatusChange}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-36 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_COLUMNS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
