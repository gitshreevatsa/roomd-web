import { getRoomsForUser } from "@/lib/redis";
import { readPlan, getPresence, readEvents, listContext } from "@/lib/roomd";
import type { RoomSummary } from "@/types";

/**
 * Build the dashboard summary for every room a user owns.
 *
 * Room metadata (name, creator) lives in roomd-web's Redis namespace, while
 * the live state (tasks, agents, events, context) lives in roomd. This
 * joins the two. Server only: it needs the team's API key.
 *
 * A room roomd cannot serve still appears, with zeroed counts, so one
 * unreachable room does not blank the whole dashboard.
 */
export async function getRoomSummaries(
  userId: string,
  apiKey: string
): Promise<RoomSummary[]> {
  const metas = await getRoomsForUser(userId);

  return Promise.all(
    metas.map(async (meta) => {
      const empty: RoomSummary = {
        roomId: meta.roomId,
        name: meta.name,
        agents: [],
        taskCount: 0,
        doneTasks: 0,
        contextCount: 0,
        lastActivity: null,
        agentsOnline: 0,
      };

      try {
        const [plan, agents, events, context] = await Promise.all([
          readPlan(meta.roomId, apiKey),
          getPresence(meta.roomId, apiKey),
          readEvents(meta.roomId, apiKey, 1),
          listContext(meta.roomId, apiKey),
        ]);

        const tasks = plan?.tasks ?? [];

        return {
          ...empty,
          agents: agents.map((a) => a.agentId),
          taskCount: tasks.length,
          doneTasks: tasks.filter((t) => t.status === "done").length,
          contextCount: context.length,
          lastActivity: events[0]?.timestamp ?? null,
          agentsOnline: agents.filter((a) => a.status === "online").length,
        };
      } catch {
        return empty;
      }
    })
  );
}
