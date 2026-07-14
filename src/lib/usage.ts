import { getAllUsers, getAllRoomMeta, listWaitlist } from "@/lib/redis";
import { getRoomStats, type RoomStats } from "@/lib/roomd";

/**
 * The operator usage report: everything the deployment owner can see about how
 * roomd is being used. Joins roomd-web's own records (users, rooms, waitlist)
 * with per-room usage read from roomd through the master key.
 *
 * "Org" here means one team, and there is one team per user, so an org maps to a
 * signed-in account (an invited person or a teammate).
 */

export interface RoomUsage {
  roomId: string;
  name: string;
  ownerTeam: string | null;
  ownerEmail: string | null;
  createdAt: string;
  stats: RoomStats | null;
}

export interface OrgUsage {
  teamId: string;
  email: string | null;
  name: string | null;
  authMethods: string[];
  createdAt: string;
  roomCount: number;
  taskCount: number;
  eventCount: number;
  lastActivity: string | null;
}

export interface UsageReport {
  overview: {
    orgs: number;
    rooms: number;
    activeRooms: number;
    waitlistPending: number;
    waitlistInvited: number;
    totalTasks: number;
    totalEvents: number;
    totalContext: number;
  };
  orgs: OrgUsage[];
  rooms: RoomUsage[];
}

const latest = (values: (string | null | undefined)[]): string | null =>
  values.filter(Boolean).sort().pop() ?? null;

export async function buildUsageReport(masterKey: string): Promise<UsageReport> {
  const [users, roomMetas, waitlist] = await Promise.all([
    getAllUsers(),
    getAllRoomMeta(),
    listWaitlist(),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));

  const rooms: RoomUsage[] = await Promise.all(
    roomMetas.map(async (m) => {
      const stats = await getRoomStats(m.roomId, masterKey);
      const creator = userById.get(m.createdBy);
      return {
        roomId: m.roomId,
        name: m.name,
        createdAt: m.createdAt,
        ownerTeam: stats?.owner ?? creator?.teamId ?? null,
        ownerEmail: creator?.email ?? null,
        stats,
      };
    })
  );

  const roomsByTeam = new Map<string, RoomUsage[]>();
  for (const r of rooms) {
    if (!r.ownerTeam) continue;
    const list = roomsByTeam.get(r.ownerTeam) ?? [];
    list.push(r);
    roomsByTeam.set(r.ownerTeam, list);
  }

  const orgs: OrgUsage[] = users
    .map((u) => {
      const rs = roomsByTeam.get(u.teamId) ?? [];
      return {
        teamId: u.teamId,
        email: u.email ?? null,
        name: u.name ?? null,
        authMethods: u.authMethods,
        createdAt: u.createdAt,
        roomCount: rs.length,
        taskCount: rs.reduce((a, r) => a + (r.stats?.taskCount ?? 0), 0),
        eventCount: rs.reduce((a, r) => a + (r.stats?.eventCount ?? 0), 0),
        lastActivity: latest(rs.map((r) => r.stats?.lastActivity)),
      };
    })
    .sort((a, b) => b.roomCount - a.roomCount || (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));

  rooms.sort((a, b) =>
    (b.stats?.lastActivity ?? "").localeCompare(a.stats?.lastActivity ?? "") ||
    b.createdAt.localeCompare(a.createdAt)
  );

  return {
    overview: {
      orgs: users.length,
      rooms: rooms.length,
      activeRooms: rooms.filter((r) => r.stats?.lastActivity).length,
      waitlistPending: waitlist.filter((w) => w.status === "pending").length,
      waitlistInvited: waitlist.filter((w) => w.status === "invited").length,
      totalTasks: rooms.reduce((a, r) => a + (r.stats?.taskCount ?? 0), 0),
      totalEvents: rooms.reduce((a, r) => a + (r.stats?.eventCount ?? 0), 0),
      totalContext: rooms.reduce((a, r) => a + (r.stats?.contextCount ?? 0), 0),
    },
    orgs,
    rooms,
  };
}
