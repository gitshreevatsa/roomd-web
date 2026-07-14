import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  readPlan,
  listContext,
  readEvents,
  getPresence,
  readContext,
  claimRoom,
  ROOM_ACCESS_DENIED,
} from "@/lib/roomd";

/**
 * These tests pin the contract between roomd-web and roomd.
 *
 * roomd tools serialise their return value directly into the MCP text
 * content. There is no `{ plan: ... }` envelope. A client that assumes one
 * silently renders an empty dashboard, which is exactly the bug these cover.
 */

/** Build the MCP JSON-RPC response roomd actually returns (as a text body). */
function mcpEnvelope(value: unknown, isError = false) {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
      ...(isError ? { isError: true } : {}),
    },
  };
}

/** roomd replies as plain JSON. */
function mcpResult(value: unknown, isError = false) {
  return { ok: true, text: async () => JSON.stringify(mcpEnvelope(value, isError)) };
}

/** roomd replies as a Server-Sent Events stream (the streamable-HTTP default). */
function mcpSse(value: unknown, isError = false) {
  const body = `event: message\ndata: ${JSON.stringify(mcpEnvelope(value, isError))}\n\n`;
  return { ok: true, text: async () => body };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readPlan", () => {
  it("returns the plan that roomd serialised, not an envelope field", async () => {
    const plan = {
      project: "room-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      tasks: [{ id: "t1", title: "Build auth", status: "pending" }],
    };
    fetchMock.mockResolvedValue(mcpResult(plan));

    const result = await readPlan("room-1", "key");
    expect(result).toEqual(plan);
    expect(result?.tasks).toHaveLength(1);
  });

  it("sends a tools/call request with the room id", async () => {
    fetchMock.mockResolvedValue(mcpResult({ tasks: [] }));
    await readPlan("room-1", "secret-key");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://roomd.test/mcp");
    expect(init.headers.Authorization).toBe("Bearer secret-key");

    const body = JSON.parse(init.body);
    expect(body.method).toBe("tools/call");
    expect(body.params).toEqual({ name: "read_plan", arguments: { roomId: "room-1" } });
  });
});

describe("list-shaped tools", () => {
  it("listContext returns the array directly", async () => {
    const entries = [{ id: "c1", type: "api_contract", summary: "Auth API" }];
    fetchMock.mockResolvedValue(mcpResult(entries));
    expect(await listContext("room-1", "key")).toEqual(entries);
  });

  it("listContext passes the type filter through", async () => {
    fetchMock.mockResolvedValue(mcpResult([]));
    await listContext("room-1", "key", "api_contract");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.arguments).toEqual({ roomId: "room-1", type: "api_contract" });
  });

  it("readEvents returns the array directly", async () => {
    const events = [{ id: "e1", type: "task_updated" }];
    fetchMock.mockResolvedValue(mcpResult(events));
    expect(await readEvents("room-1", "key")).toEqual(events);
  });

  it("getPresence returns the array directly", async () => {
    const agents = [{ agentId: "backend", status: "online", lastSeen: "now" }];
    fetchMock.mockResolvedValue(mcpResult(agents));
    expect(await getPresence("room-1", "key")).toEqual(agents);
  });

  it("a null body degrades to an empty list rather than throwing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [] } }),
    });
    expect(await listContext("room-1", "key")).toEqual([]);
    expect(await readEvents("room-1", "key")).toEqual([]);
  });

  it("parses an SSE-framed response, not just plain JSON", async () => {
    // The streamable-HTTP transport answers as `event: message\ndata: {...}`.
    const plan = { project: "room-1", tasks: [{ id: "t1", status: "done" }] };
    fetchMock.mockResolvedValue(mcpSse(plan));
    expect(await readPlan("room-1", "key")).toEqual(plan);
  });
});

describe("error handling", () => {
  it("raises when a tool reports isError instead of returning the message as data", async () => {
    fetchMock.mockResolvedValue(mcpResult("Error: Task not found: t9", true));

    await expect(readContext("room-1", "t9", "key")).rejects.toThrow("Task not found: t9");
  });

  it("raises on a JSON-RPC level error", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "Method not found" } }),
    });
    await expect(readPlan("room-1", "key")).rejects.toThrow("Method not found");
  });

  it("raises on a non-200 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(readPlan("room-1", "key")).rejects.toThrow("roomd read_plan failed: 401");
  });
});

describe("claimRoom", () => {
  it("returns true when the room is free or already ours", async () => {
    fetchMock.mockResolvedValue(mcpResult({ project: "room-1", tasks: [] }));
    expect(await claimRoom("room-1", "key")).toBe(true);
  });

  it("returns false when another team owns the id", async () => {
    fetchMock.mockResolvedValue(mcpResult(`Error: ${ROOM_ACCESS_DENIED}`, true));
    expect(await claimRoom("taken", "key")).toBe(false);
  });

  it("rethrows an unrelated failure rather than reporting the id as taken", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(claimRoom("room-1", "key")).rejects.toThrow(/500/);
  });
});
