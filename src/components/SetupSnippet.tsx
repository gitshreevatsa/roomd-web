"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildAgentsMd,
  buildClientSnippet,
  buildCodexExportLine,
  buildSessionPrompt,
  type McpSnippetClient,
} from "@/lib/mcp-snippets";

interface SetupSnippetProps {
  collabMcpUrl: string;
  apiKey: string;
  roomId: string;
}

type ClientId = McpSnippetClient;

interface ClientGuide {
  id: ClientId;
  label: string;
  configPath: string;
  restartHint: string;
  ruleHint: string;
  /** Codex: key lives in env, not in the TOML snippet. */
  keyInEnv?: boolean;
  note?: string;
}

const CLIENTS: ClientGuide[] = [
  {
    id: "claude",
    label: "Claude Code",
    configPath: ".claude/settings.json",
    restartHint: "Restart Claude Code after saving.",
    ruleHint: "Paste into CLAUDE.md in the project root (or merge with an existing roomd section).",
  },
  {
    id: "cursor",
    label: "Cursor",
    configPath: ".cursor/mcp.json",
    restartHint: "Reload MCP in Cursor Settings → Tools & MCP, or restart Cursor.",
    ruleHint: "Paste into AGENTS.md in the project root (or a Cursor project rule).",
  },
  {
    id: "codex",
    label: "Codex",
    configPath: "~/.codex/config.toml (or .codex/config.toml in a trusted project)",
    restartHint:
      "Restart Codex (CLI / IDE / ChatGPT desktop). Or run: codex mcp add roomd --url <url> --bearer-token-env-var ROOMD_API_KEY",
    ruleHint: "Paste into AGENTS.md (Codex reads it at session start).",
    keyInEnv: true,
    note:
      "Codex uses TOML, not JSON. Put your team key (or room invite token) in the ROOMD_API_KEY env var — do not hard-code it in config.toml. Roomd is Bearer-only (no OAuth).",
  },
  {
    id: "other",
    label: "Other MCP",
    configPath: "your MCP client config",
    restartHint: "Reload or restart the client after adding the server.",
    ruleHint: "Put this AGENTS.md block somewhere your agent reads on every session.",
  },
];

export function SetupSnippet({ collabMcpUrl, apiKey, roomId }: SetupSnippetProps) {
  const [revealed, setRevealed] = useState(false);
  const [client, setClient] = useState<ClientId>("claude");

  const guide = CLIENTS.find((c) => c.id === client) ?? CLIENTS[0];
  const mcpBase = collabMcpUrl.replace(/\/$/, "");
  const maskedKey = `${"•".repeat(Math.max(apiKey.length - 4, 8))}${apiKey.slice(-4)}`;
  const displayKey = revealed ? apiKey : maskedKey;

  const agentsMd = buildAgentsMd(roomId);
  const promptText = buildSessionPrompt(roomId);

  return (
    <div className="space-y-8">
      <Tabs value={client} onValueChange={(v) => setClient(v as ClientId)}>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">Step 1: connect your agent</h3>
            <TabsList className="h-auto w-full flex-wrap sm:w-auto">
              {CLIENTS.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="flex-1 text-xs sm:flex-none sm:text-sm">
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {CLIENTS.map((c) => {
            const snippetDisplay = c.keyInEnv
              ? buildClientSnippet(c.id, mcpBase, "")
              : buildClientSnippet(c.id, mcpBase, displayKey);
            const snippetCopy = c.keyInEnv
              ? buildClientSnippet(c.id, mcpBase, "")
              : buildClientSnippet(c.id, mcpBase, apiKey);

            return (
              <TabsContent key={c.id} value={c.id} className="mt-0 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add this to{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {c.configPath}
                  </code>
                  . {c.restartHint}
                </p>

                {c.note && <p className="text-sm text-muted-foreground">{c.note}</p>}

                {c.id === "other" && (
                  <p className="text-sm text-muted-foreground">
                    roomd speaks streamable HTTP at{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {mcpBase}/mcp
                    </code>
                    . Any MCP client that can send a Bearer header to an HTTP server
                    works (Windsurf, Continue, custom agents, etc.).
                  </p>
                )}

                {c.keyInEnv && (
                  <div className="relative overflow-hidden rounded-xl border bg-muted/40">
                    <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-xs">
                      {buildCodexExportLine(displayKey)}
                    </pre>
                    <div className="flex items-center gap-2 border-t bg-background/50 p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevealed((r) => !r)}
                        className="gap-1.5 text-muted-foreground"
                      >
                        {revealed ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Hide key
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Reveal key
                          </>
                        )}
                      </Button>
                      <CopyButton
                        text={buildCodexExportLine(apiKey)}
                        label="Copy export"
                        className="ml-auto"
                      />
                    </div>
                  </div>
                )}

                <div className="relative overflow-hidden rounded-xl border bg-muted/40">
                  <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-xs">
                    {snippetDisplay}
                  </pre>
                  <div className="flex items-center gap-2 border-t bg-background/50 p-2">
                    {!c.keyInEnv && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevealed((r) => !r)}
                        className="gap-1.5 text-muted-foreground"
                      >
                        {revealed ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Hide key
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Reveal key
                          </>
                        )}
                      </Button>
                    )}
                    <CopyButton text={snippetCopy} label="Copy snippet" className="ml-auto" />
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Step 2: add AGENTS.md (stay online + log chats)</h3>
        <p className="text-sm text-muted-foreground">{guide.ruleHint}</p>
        <p className="text-sm text-muted-foreground">
          This block makes the agent call <code className="font-mono text-xs">heartbeat</code>{" "}
          so it stays green on the Agents tab, and{" "}
          <code className="font-mono text-xs">write_context</code> so every chat turn lands in
          room context.
        </p>
        <div className="relative overflow-hidden rounded-xl border bg-muted/40">
          <pre className="max-h-96 overflow-auto whitespace-pre p-4 font-mono text-xs">{agentsMd}</pre>
          <div className="flex justify-end border-t bg-background/50 p-2">
            <CopyButton text={agentsMd} label="Copy AGENTS.md" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Same <code className="font-mono">roomId</code> for every teammate; a different{" "}
          <code className="font-mono">agentId</code> per chat or process. Replace{" "}
          <code className="font-mono">agent-yourname</code> before saving.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Step 3: start the session</h3>
        <p className="text-sm text-muted-foreground">
          Paste this (or say it in your own words) once the MCP server is connected. Confirm the
          agent appears online on the room dashboard, then check Context for chat notes.
        </p>
        <div className="relative overflow-hidden rounded-xl border bg-muted/40">
          <pre className="whitespace-pre p-4 font-mono text-xs">{promptText}</pre>
          <div className="flex justify-end border-t bg-background/50 p-2">
            <CopyButton text={promptText} label="Copy prompt" />
          </div>
        </div>
      </div>
    </div>
  );
}
