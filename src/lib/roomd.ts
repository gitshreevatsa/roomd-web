import type { Plan, ContextEntry, Event, AgentPresence, DynKey, InviteToken } from "@/types";

const ROOMD_URL = process.env.ROOMD_URL!;

/** The exact message roomd returns when a room belongs to another team. */
export const ROOM_ACCESS_DENIED = "Room not found or access denied";

// ---------------------------------------------------------------------------
// Low-level MCP JSON-RPC caller
// ---------------------------------------------------------------------------

interface McpResponse {
  result?: {
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { message: string };
}

/**
 * Call one MCP tool and return its decoded result.
 *
 * roomd tools serialise their return value directly, so read_plan yields
 * a Plan and list_context yields a ContextEntry[]. There is no envelope to
 * unwrap.
 *
 * A tool that fails sets isError and puts the message in the text content.
 * That is a failure, not data, so it is raised rather than returned.
 */
/**
 * Decode an MCP HTTP response body, whether it came back as a single JSON
 * object or as a Server-Sent Events stream. For SSE, the JSON-RPC message is
 * the last `data:` line.
 */
function parseMcpBody(body: string): unknown {
  const trimmed = body.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(body);
  }
  const dataLines = body
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  if (dataLines.length === 0) throw new Error("Empty MCP response");
  return JSON.parse(dataLines[dataLines.length - 1]!);
}

async function callTool(
  tool: string,
  args: Record<string, unknown>,
  apiKey: string
): Promise<unknown> {
  const res = await fetch(`${ROOMD_URL}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`roomd ${tool} failed: ${res.status}`);
  }

  // The streamable-HTTP transport answers as SSE (event: message / data: {...})
  // or as plain JSON, depending on what it negotiates. Parse either.
  const json = parseMcpBody(await res.text()) as McpResponse;
  if (json.error) throw new Error(json.error.message);

  const text = json.result?.content?.[0]?.text;

  if (json.result?.isError) {
    // Handlers format failures as "Error: <message>".
    throw new Error(text?.replace(/^Error:\s*/, "") ?? `roomd ${tool} failed`);
  }

  if (text === undefined) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Room data (proxies MCP tools)
// ---------------------------------------------------------------------------

export async function readPlan(roomId: string, apiKey: string): Promise<Plan | null> {
  return await callTool("read_plan", { roomId }, apiKey) as Plan | null;
}

export async function listContext(
  roomId: string,
  apiKey: string,
  type?: string
): Promise<ContextEntry[]> {
  const args: Record<string, unknown> = { roomId };
  if (type) args.type = type;
  return (await callTool("list_context", args, apiKey) as ContextEntry[] | null) ?? [];
}

export async function readContext(
  roomId: string,
  id: string,
  apiKey: string
): Promise<ContextEntry | null> {
  return await callTool("read_context", { roomId, id }, apiKey) as ContextEntry | null;
}

export async function readEvents(
  roomId: string,
  apiKey: string,
  limit = 50
): Promise<Event[]> {
  return (await callTool("read_events", { roomId, limit }, apiKey) as Event[] | null) ?? [];
}

export async function getPresence(
  roomId: string,
  apiKey: string
): Promise<AgentPresence[]> {
  return (await callTool("get_presence", { roomId }, apiKey) as AgentPresence[] | null) ?? [];
}

export async function updateTask(
  roomId: string,
  taskId: string,
  patch: { status?: string; owner?: string },
  apiKey: string
): Promise<void> {
  await callTool("update_task", { roomId, taskId, ...patch }, apiKey);
}

/**
 * Claim a roomId for the caller's team.
 *
 * Room ids are global in roomd and owned by whichever team touches them
 * first. Reading the plan is the cheapest tool call that triggers that claim,
 * so a room created in the dashboard is owned before an agent ever connects.
 *
 * Returns false when the id is already owned by another team.
 */
export async function claimRoom(roomId: string, apiKey: string): Promise<boolean> {
  try {
    await readPlan(roomId, apiKey);
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes(ROOM_ACCESS_DENIED)) return false;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Operator analytics
// ---------------------------------------------------------------------------

export interface RoomStats {
  roomId: string;
  owner: string | null;
  taskCount: number;
  doneTasks: number;
  contextCount: number;
  agentCount: number;
  eventCount: number;
  lastActivity: string | null;
}

/**
 * Cross-tenant usage for one room. Requires a static operator key (the master
 * key); ordinary team keys get a 403. Returns null on any failure so one bad
 * room never breaks the whole usage page.
 */
export async function getRoomStats(roomId: string, masterKey: string): Promise<RoomStats | null> {
  try {
    const res = await fetch(`${ROOMD_URL}/admin/rooms/${roomId}/stats`, {
      headers: { Authorization: `Bearer ${masterKey}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as RoomStats;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Admin: key management
// ---------------------------------------------------------------------------

interface AdminEndpointResponse {
  keys?: DynKey[];
  keyId?: string;
  secret?: string;
  teamId?: string;
  createdAt?: string;
}

export async function createAdminKey(
  apiKey: string,
  note?: string
): Promise<{ keyId: string; secret: string; teamId: string; createdAt: string }> {
  const res = await fetch(`${ROOMD_URL}/admin/keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(note ? { note } : {}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`createAdminKey failed: ${res.status}`);
  const data = await res.json() as AdminEndpointResponse;
  return {
    keyId: data.keyId!,
    secret: data.secret!,
    teamId: data.teamId!,
    createdAt: data.createdAt!,
  };
}

/**
 * Provision a key for a brand-new teamId.
 * Only callable with a static master key. Used for OAuth and email onboarding.
 */
export async function provisionTeamKey(
  newTeamId: string,
  masterKey: string,
  note?: string
): Promise<{ keyId: string; secret: string; teamId: string; createdAt: string }> {
  const res = await fetch(`${ROOMD_URL}/admin/keys/provision`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${masterKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(note ? { teamId: newTeamId, note } : { teamId: newTeamId }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`provisionTeamKey failed: ${res.status}`);
  const data = await res.json() as AdminEndpointResponse;
  return {
    keyId: data.keyId!,
    secret: data.secret!,
    teamId: data.teamId!,
    createdAt: data.createdAt!,
  };
}

export async function listAdminKeys(apiKey: string): Promise<DynKey[]> {
  const res = await fetch(`${ROOMD_URL}/admin/keys`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`listAdminKeys failed: ${res.status}`);
  const data = await res.json() as AdminEndpointResponse;
  return data.keys ?? [];
}

export async function revokeAdminKey(
  keyId: string,
  apiKey: string
): Promise<void> {
  const res = await fetch(`${ROOMD_URL}/admin/keys/${keyId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`revokeAdminKey failed: ${res.status}`);
}

/** Operator-only: list dynamic keys for any team. */
export async function listTeamKeys(
  teamId: string,
  masterKey: string
): Promise<DynKey[]> {
  const res = await fetch(
    `${ROOMD_URL}/admin/teams/${encodeURIComponent(teamId)}/keys`,
    {
      headers: { Authorization: `Bearer ${masterKey}` },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`listTeamKeys failed: ${res.status}`);
  const data = (await res.json()) as AdminEndpointResponse;
  return data.keys ?? [];
}

/** Operator-only: revoke every dynamic key for a team. */
export async function revokeAllTeamKeys(
  teamId: string,
  masterKey: string
): Promise<number> {
  const keys = await listTeamKeys(teamId, masterKey);
  let n = 0;
  for (const k of keys) {
    await revokeAdminKey(k.keyId, masterKey);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Admin: room invites
// ---------------------------------------------------------------------------

interface InviteEndpointResponse {
  invites?: InviteToken[];
  tokenId?: string;
  token?: string;
  roomId?: string;
  createdAt?: string;
  expiresAt?: string;
}

export async function createRoomInvite(
  roomId: string,
  apiKey: string,
  expiresIn?: number
): Promise<InviteToken> {
  const res = await fetch(`${ROOMD_URL}/admin/rooms/${roomId}/invite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(expiresIn !== undefined ? { expiresIn } : {}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`createRoomInvite failed: ${res.status}`);
  const data = await res.json() as InviteEndpointResponse;
  return {
    tokenId: data.tokenId!,
    token: data.token,
    hint: `****${(data.token ?? "").slice(-4)}`,
    roomId: data.roomId!,
    createdAt: data.createdAt!,
    expiresAt: data.expiresAt,
  };
}

export async function listRoomInvites(
  roomId: string,
  apiKey: string
): Promise<InviteToken[]> {
  const res = await fetch(`${ROOMD_URL}/admin/rooms/${roomId}/invites`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`listRoomInvites failed: ${res.status}`);
  const data = await res.json() as InviteEndpointResponse;
  return data.invites ?? [];
}

export async function revokeRoomInvite(
  tokenId: string,
  roomId: string,
  apiKey: string
): Promise<void> {
  const res = await fetch(
    `${ROOMD_URL}/admin/rooms/${roomId}/invites/${tokenId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`revokeRoomInvite failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Key validation (used during login)
// ---------------------------------------------------------------------------

export async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; teamId?: string }> {
  try {
    const res = await fetch(`${ROOMD_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) return { valid: false };
    const data = await res.json() as { teamId?: string };
    return { valid: true, teamId: data.teamId };
  } catch {
    return { valid: false };
  }
}

// ---------------------------------------------------------------------------
// Admin: webhooks
// ---------------------------------------------------------------------------

export interface WebhookRow {
  id: string;
  url: string;
  roomId?: string;
  createdAt: string;
  secretHint: string;
}

export async function listWebhooks(apiKey: string): Promise<WebhookRow[]> {
  const res = await fetch(`${ROOMD_URL}/admin/webhooks`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`listWebhooks failed: ${res.status}`);
  const data = (await res.json()) as { webhooks?: WebhookRow[] };
  return data.webhooks ?? [];
}

export async function createWebhook(
  apiKey: string,
  url: string,
  roomId?: string,
): Promise<{ id: string; url: string; secret: string; roomId?: string; createdAt: string }> {
  const res = await fetch(`${ROOMD_URL}/admin/webhooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, roomId: roomId || undefined }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`createWebhook failed: ${res.status}`);
  return res.json() as Promise<{
    id: string;
    url: string;
    secret: string;
    roomId?: string;
    createdAt: string;
  }>;
}

export async function deleteWebhook(apiKey: string, webhookId: string): Promise<void> {
  const res = await fetch(`${ROOMD_URL}/admin/webhooks/${encodeURIComponent(webhookId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`deleteWebhook failed: ${res.status}`);
}
