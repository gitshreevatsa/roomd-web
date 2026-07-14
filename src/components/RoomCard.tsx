"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CopyButton } from "@/components/CopyButton";
import { formatRelativeTime } from "@/lib/utils";
import type { RoomSummary } from "@/types";

interface RoomCardProps {
  room: RoomSummary;
}

export function RoomCard({ room }: RoomCardProps) {
  const progressPct =
    room.taskCount > 0
      ? Math.round((room.doneTasks / room.taskCount) * 100)
      : 0;

  return (
    <Link href={`/rooms/${room.roomId}`} className="block">
      <Card className="h-full cursor-pointer transition-all hover:border-primary/40 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{room.name}</CardTitle>
            {room.agentsOnline > 0 ? (
              <Badge variant="green" className="shrink-0">
                <span className="roomd-live h-1.5 w-1.5 rounded-full bg-primary" />
                {room.agentsOnline} online
              </Badge>
            ) : room.agents.length > 0 ? (
              <Badge variant="gray" className="shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                offline
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 text-muted-foreground">
                never connected
              </Badge>
            )}
          </div>

          <div
            className="mt-1.5 flex items-center gap-1"
            onClick={(e) => e.preventDefault()}
          >
            <code className="font-mono text-xs text-muted-foreground">{room.roomId}</code>
            <CopyButton text={room.roomId} label="" className="h-6 w-6 p-0" />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {room.taskCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {room.doneTasks}/{room.taskCount} tasks done
                </span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Last activity:{" "}
            {room.lastActivity ? formatRelativeTime(room.lastActivity) : "none"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
