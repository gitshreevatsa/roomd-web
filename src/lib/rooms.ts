import {
  createRoom,
  getRoomMeta,
  getRoomsForUser,
  linkRoomToUser,
} from "@/lib/redis";
import { listTeamRooms, readPlan, getPresence, readEvents, listContext } from "@/lib/roomd";
import type { RoomMeta, RoomSummary } from "@/types";

/**
 * Build the dashboard summary for every room the caller's team owns.
 *
 * Room metadata (name, creator) lives in roomd-web's Redis namespace, while
 * the live state (tasks, agents, events, context) lives in roomd. This
 * joins the two. Server only: it needs the team's API key.
 *
 * Source of truth for "which rooms exist" is roomd's team room index
 * (`GET /admin/rooms`). The per-user `app:rooms:{userId}` set is only a
 * dashboard cache — after Identity v2, a new userId can orphan that set even
 * though the rooms are still on the team. We merge roomd + local meta and
 * backfill the user index when needed.
 *
 * A room roomd cannot serve still appears, with zeroed counts, so one
 * unreachable room does not blank the whole dashboard.
 */
export async function getRoomSummaries(
  userId: string,
  apiKey: string
): Promise<RoomSummary[]> {
  const [localMetas, teamRoomIds] = await Promise.all([
    getRoomsForUser(userId),
    listTeamRooms(apiKey).catch(() => [] as string[]),
  ]);

  const byId = new Map<string, RoomMeta>();
  for (const meta of localMetas) {
    byId.set(meta.roomId, meta);
  }

  const missingFromLocal = teamRoomIds.filter((id) => !byId.has(id));
  if (missingFromLocal.length > 0) {
    await Promise.all(
      missingFromLocal.map(async (roomId) => {
        const existing = await getRoomMeta(roomId);
        if (existing) {
          byId.set(roomId, existing);
          await linkRoomToUser(userId, roomId);
          return;
        }
        const meta: RoomMeta = {
          roomId,
          name: roomId,
          createdBy: userId,
          createdAt: new Date().toISOString(),
        };
        await createRoom(meta);
        byId.set(roomId, meta);
      }),
    );
  }

  // Keep any local-only rows (e.g. meta written before roomd claim finished).
  const metas = [
    ...teamRoomIds.map((id) => byId.get(id)).filter((m): m is RoomMeta => Boolean(m)),
    ...localMetas.filter((m) => !teamRoomIds.includes(m.roomId)),
  ];

  // Dedupe while preserving order (team rooms first).
  const seen = new Set<string>();
  const ordered = metas.filter((m) => {
    if (seen.has(m.roomId)) return false;
    seen.add(m.roomId);
    return true;
  });

  return Promise.all(
    ordered.map(async (meta) => {
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
