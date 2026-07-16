"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SetupSnippetProps {
  collabMcpUrl: string;
  apiKey: string;
  roomId: string;
}

type ClientId = "claude" | "cursor" | "other";

interface ClientGuide {
  id: ClientId;
  label: string;
  configPath: string;
  restartHint: string;
  ruleHint: string;
  /** JSON config object for this client (key still raw for copy). */
  buildConfig: (mcpUrl: string, apiKey: string) => object;
}

const CLIENTS: ClientGuide[] = [
  {
    id: "claude",
    label: "Claude Code",
    configPath: ".claude/settings.json",
    restartHint: "Restart Claude Code after saving.",
    ruleHint: "Add the room details to CLAUDE.md in the project root.",
    buildConfig: (mcpUrl, apiKey) => ({
      mcpServers: {
        roomd: {
          type: "http",
          url: `${mcpUrl}/mcp`,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    }),
  },
  {
    id: "cursor",
    label: "Cursor",
    configPath: ".cursor/mcp.json",
    restartHint: "Reload MCP in Cursor Settings → Tools & MCP, or restart Cursor.",
    ruleHint: "Add the room details to a Cursor rule or AGENTS.md in the project.",
    buildConfig: (mcpUrl, apiKey) => ({
      mcpServers: {
        roomd: {
          url: `${mcpUrl}/mcp`,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    }),
  },
  {
    id: "other",
    label: "Other MCP",
    configPath: "your MCP client config",
    restartHint: "Reload or restart the client after adding the server.",
    ruleHint: "Put the room details somewhere your agent reads on every session.",
    buildConfig: (mcpUrl, apiKey) => ({
      mcpServers: {
        roomd: {
          url: `${mcpUrl}/mcp`,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    }),
  },
];

export function SetupSnippet({ collabMcpUrl, apiKey, roomId }: SetupSnippetProps) {
  const [revealed, setRevealed] = useState(false);
  const [client, setClient] = useState<ClientId>("claude");

  const guide = CLIENTS.find((c) => c.id === client) ?? CLIENTS[0];
  const mcpBase = collabMcpUrl.replace(/\/$/, "");

  const maskedKey = `${"•".repeat(Math.max(apiKey.length - 4, 8))}${apiKey.slice(-4)}`;
  const displayKey = revealed ? apiKey : maskedKey;

  const promptText =
    `We coordinate through a roomd room. Room ID: ${roomId}\n\n` +
    `At the start of the session, call:\n` +
    `get_my_summary({\n  roomId: "${roomId}",\n  agentId: "your-name"\n})\n\n` +
    `Use a different agentId per engineer / client.`;

  const ruleBlock =
    `## roomd\n` +
    `- roomId: \`${roomId}\`\n` +
    `- your agent id: \`agent-yourname\`\n` +
    `- call get_my_summary at the start of every session\n`;

  return (
    <div className="space-y-8">
      <Tabs value={client} onValueChange={(v) => setClient(v as ClientId)}>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">Step 1: connect your agent</h3>
            <TabsList className="h-9 w-full sm:w-auto">
              {CLIENTS.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="flex-1 text-xs sm:flex-none sm:text-sm">
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {CLIENTS.map((c) => (
            <TabsContent key={c.id} value={c.id} className="mt-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Add this to{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {c.configPath}
                </code>{" "}
                in the project the agent works in. {c.restartHint}
              </p>

              {c.id === "other" && (
                <p className="text-sm text-muted-foreground">
                  roomd speaks streamable HTTP at{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {mcpBase}/mcp
                  </code>
                  . Any MCP client that can send a Bearer header to an HTTP
                  server works (Windsurf, Continue, custom agents, etc.).
                </p>
              )}

              <div className="relative overflow-hidden rounded-xl border bg-muted/40">
                <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-xs">
                  {JSON.stringify(c.buildConfig(mcpBase, displayKey), null, 2)}
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
                    text={JSON.stringify(c.buildConfig(mcpBase, apiKey), null, 2)}
                    label="Copy snippet"
                    className="ml-auto"
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Step 2: room identity (same for every client) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Step 2: tell the agent which room to join</h3>
        <p className="text-sm text-muted-foreground">{guide.ruleHint}</p>
        <div className="relative overflow-hidden rounded-xl border bg-muted/40">
          <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-xs">{ruleBlock}</pre>
          <div className="flex justify-end border-t bg-background/50 p-2">
            <CopyButton text={ruleBlock} label="Copy room block" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Every agent uses the same <code className="font-mono">roomId</code> and a
          different <code className="font-mono">agentId</code>.
        </p>
      </div>

      {/* Step 3: kickoff prompt */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Step 3: start the session</h3>
        <p className="text-sm text-muted-foreground">
          Paste this (or say it in your own words) once the MCP server is connected.
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
