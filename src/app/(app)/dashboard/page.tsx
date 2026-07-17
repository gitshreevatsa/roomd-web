import { redirect } from "next/navigation";
import { getServerIdentity } from "@/lib/session";
import { getRoomSummaries } from "@/lib/rooms";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/RoomCard";
import { PendingLink } from "@/components/PendingLink";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");

  const rooms = await getRoomSummaries(identity.userId, identity.apiKey);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rooms.length} room{rooms.length !== 1 ? "s" : ""}
          </p>
        </div>
        <PendingLink href="/rooms/new">
          <Button>
            <Plus className="h-4 w-4" />
            New room
          </Button>
        </PendingLink>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Create your first room</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              A room is one project workspace: its own agents, tasks, events, and context.
              Create one, then point Claude or Cursor at it with your MCP config.
            </p>
          </div>
          <PendingLink href="/rooms/new">
            <Button size="lg">
              <Plus className="h-4 w-4" />
              Create your first room
            </Button>
          </PendingLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.roomId} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
