import { describe, it, expect } from "vitest";

import {
  buildClaudeSnippet,
  buildCodexExportLine,
  buildCodexSnippet,
  buildCursorSnippet,
  buildClientSnippet,
  buildAgentsMd,
  buildSessionPrompt,
} from "@/lib/mcp-snippets";

describe("mcp-snippets", () => {
  const base = "https://api.roomd.sh";
  const key = "rk_test_secret";

  it("builds Claude JSON with type http and Bearer header", () => {
    const snip = buildClaudeSnippet(base, key);
    const parsed = JSON.parse(snip) as {
      mcpServers: { roomd: { type: string; url: string; headers: { Authorization: string } } };
    };
    expect(parsed.mcpServers.roomd.type).toBe("http");
    expect(parsed.mcpServers.roomd.url).toBe("https://api.roomd.sh/mcp");
    expect(parsed.mcpServers.roomd.headers.Authorization).toBe(`Bearer ${key}`);
  });

  it("builds Cursor JSON without type field", () => {
    const snip = buildCursorSnippet(base, key);
    const parsed = JSON.parse(snip) as {
      mcpServers: { roomd: { type?: string; url: string; headers: { Authorization: string } } };
    };
    expect(parsed.mcpServers.roomd.type).toBeUndefined();
    expect(parsed.mcpServers.roomd.url).toBe("https://api.roomd.sh/mcp");
    expect(parsed.mcpServers.roomd.headers.Authorization).toBe(`Bearer ${key}`);
  });

  it("builds Codex TOML with bearer_token_env_var and no embedded secret", () => {
    const snip = buildCodexSnippet(base);
    expect(snip).toContain("[mcp_servers.roomd]");
    expect(snip).toContain('url = "https://api.roomd.sh/mcp"');
    expect(snip).toContain('bearer_token_env_var = "ROOMD_API_KEY"');
    expect(snip).toContain("tool_timeout_sec = 60");
    expect(snip).not.toContain(key);
    expect(snip).not.toContain("Authorization");
    expect(snip).not.toContain("Bearer");
  });

  it("does not double-append /mcp when base already ends with it", () => {
    expect(buildCodexSnippet("https://api.roomd.sh/mcp")).toContain(
      'url = "https://api.roomd.sh/mcp"',
    );
    expect(buildCodexSnippet("https://api.roomd.sh/mcp")).not.toContain("/mcp/mcp");
  });

  it("builds Codex export line with the real key", () => {
    expect(buildCodexExportLine(key)).toBe(`export ROOMD_API_KEY="${key}"`);
  });

  it("routes buildClientSnippet for codex without requiring a key in TOML", () => {
    const snip = buildClientSnippet("codex", base, key);
    expect(snip).toBe(buildCodexSnippet(base));
    expect(snip).not.toContain(key);
  });

  it("builds AGENTS.md with heartbeat + chat→context instructions", () => {
    const md = buildAgentsMd("sprint-42", "cursor-frontend");
    expect(md).toContain("roomId: `sprint-42`");
    expect(md).toContain("agentId: `cursor-frontend`");
    expect(md).toContain("heartbeat");
    expect(md).toContain('kind: "chat_turn"');
    expect(md).toContain("write_context");
    expect(md).toContain("get_my_summary");
  });

  it("builds session prompt that starts with heartbeat", () => {
    const prompt = buildSessionPrompt("sprint-42", "cursor-frontend");
    expect(prompt).toContain('heartbeat({ roomId: "sprint-42", agentId: "cursor-frontend" })');
    expect(prompt).toContain("chat_turn");
  });
});
