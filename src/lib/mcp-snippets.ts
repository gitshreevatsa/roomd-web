/**
 * Ready-to-paste MCP client configs for the dashboard setup guide / landing.
 * Keep shapes in sync with roomd/docs/SETUP.md and roomd-docs/guides/connect-*.
 */

export type McpSnippetClient = "claude" | "cursor" | "codex" | "other";

function mcpEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return base.endsWith("/mcp") ? base : `${base}/mcp`;
}

export function buildClaudeSnippet(mcpBaseUrl: string, apiKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        roomd: {
          type: "http",
          url: mcpEndpoint(mcpBaseUrl),
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      },
    },
    null,
    2,
  );
}

export function buildCursorSnippet(mcpBaseUrl: string, apiKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        roomd: {
          url: mcpEndpoint(mcpBaseUrl),
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      },
    },
    null,
    2,
  );
}

/**
 * Codex uses TOML + env-var bearer. Never embed the secret in config.toml.
 */
export function buildCodexSnippet(mcpBaseUrl: string): string {
  const url = mcpEndpoint(mcpBaseUrl);
  return [
    "[mcp_servers.roomd]",
    `url = "${url}"`,
    'bearer_token_env_var = "ROOMD_API_KEY"',
    "tool_timeout_sec = 60",
  ].join("\n");
}

export function buildCodexExportLine(apiKey: string): string {
  return `export ROOMD_API_KEY="${apiKey}"`;
}

export function buildOtherSnippet(mcpBaseUrl: string, apiKey: string): string {
  return buildCursorSnippet(mcpBaseUrl, apiKey);
}

export function buildClientSnippet(
  client: McpSnippetClient,
  mcpBaseUrl: string,
  apiKey: string,
): string {
  switch (client) {
    case "claude":
      return buildClaudeSnippet(mcpBaseUrl, apiKey);
    case "cursor":
      return buildCursorSnippet(mcpBaseUrl, apiKey);
    case "codex":
      return buildCodexSnippet(mcpBaseUrl);
    case "other":
      return buildOtherSnippet(mcpBaseUrl, apiKey);
  }
}

/**
 * AGENTS.md / CLAUDE.md / Cursor rule block.
 * Keep agents online on the dashboard and log every chat turn into room context.
 */
export function buildAgentsMd(
  roomId: string,
  agentId = "agent-yourname",
): string {
  return `## roomd

You are connected to a roomd room over MCP. Coordinate there — do not keep
shared state only in this chat.

### Identity
- roomId: \`${roomId}\`
- agentId: \`${agentId}\` (unique per chat/process — never share an id across two sessions)

### Stay online (dashboard Agents tab)
Presence expires **120 seconds** after the last heartbeat. You look offline on
the dashboard when you go quiet.

1. **Every turn start:** call \`heartbeat\` with your roomId + agentId.
2. Then call \`get_my_summary\` (tasks, unread events, new context, presence).
3. While working, call \`heartbeat\` about every **60 seconds**, or at least once
   per turn if turns are shorter than that.
4. Optional on exit: \`leave_room\` so peers see you leave immediately.

### Post every chat into room context
After each user message **and** after each meaningful assistant reply, write a
\`note\` so the room (and humans on the dashboard) have the conversation:

\`\`\`
write_context({
  roomId: "${roomId}",
  type: "note",
  summary: "chat: <one-line topic>",
  author: "${agentId}",
  consuming_agents: [],
  payload: {
    text: "<user ask and/or your outcome — no secrets>",
    kind: "chat_turn",
    role: "user" | "assistant",
    turn: <1-based integer>
  }
})
\`\`\`

Rules for chat notes:
- One context note per turn (user + assistant can share one note, or two notes).
- Omit secrets, API keys, tokens, and private .env values.
- Prefer outcome summaries when the turn is long; keep \`payload.text\` under ~4KB.
- Leave \`consuming_agents\` empty for routine logs (avoids event spam). List peer
  agent ids only when they must act on this note.
- Durable contracts still use typed context: \`api_contract\`, \`arch_decision\`,
  \`change_request\`, \`task\` — not free-form chat notes.

### Turn loop
\`\`\`
heartbeat → get_my_summary → (claim work / implement) → write_context chat note
  → write_context / post_event for real coordination → release_lock if held
\`\`\`

### Context vs events
- Durable agreements → \`write_context\` / \`update_context\`
- Ephemeral signals → \`post_event\` (e.g. \`task_blocked\`, \`peer_request\`)
`;
}

/** Short paste prompt for "start the session" in the setup guide. */
export function buildSessionPrompt(
  roomId: string,
  agentId = "your-name",
): string {
  return (
    `We coordinate through a roomd room. Room ID: ${roomId}\n\n` +
    `Use agentId "${agentId}" (different id per engineer / client / chat).\n\n` +
    `Every turn:\n` +
    `1. heartbeat({ roomId: "${roomId}", agentId: "${agentId}" })\n` +
    `2. get_my_summary({ roomId: "${roomId}", agentId: "${agentId}" })\n` +
    `3. After the user message and after your reply, write_context type "note" ` +
    `with kind "chat_turn" so the chat is stored in room context.\n`
  );
}
