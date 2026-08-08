"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildClaudeSnippet,
  buildCodexCliAdd,
  buildCodexExportLine,
  buildCodexSnippet,
  buildCursorSnippet,
} from "@/lib/mcp-snippets";

const PLACEHOLDER_KEY = "<key>";
const MCP_BASE = "https://api.roomd.sh";

type SnippetBlock = {
  label: string;
  text: string;
};

type ClientSnippet = {
  path: string;
  hint?: string;
  blocks: SnippetBlock[];
};

const SNIPPETS: Record<string, ClientSnippet> = {
  claude: {
    path: ".claude/settings.json",
    blocks: [{ label: "Paste into settings", text: buildClaudeSnippet(MCP_BASE, PLACEHOLDER_KEY) }],
  },
  cursor: {
    path: ".cursor/mcp.json",
    blocks: [{ label: "Paste into mcp.json", text: buildCursorSnippet(MCP_BASE, PLACEHOLDER_KEY) }],
  },
  codex: {
    path: "~/.codex/config.toml",
    hint: "Codex is TOML + an env var — not the Claude/Cursor JSON block.",
    blocks: [
      {
        label: "1. Export the key",
        text: buildCodexExportLine(PLACEHOLDER_KEY),
      },
      {
        label: "2. Add to config.toml",
        text: buildCodexSnippet(MCP_BASE),
      },
      {
        label: "Or one CLI command",
        text: buildCodexCliAdd(MCP_BASE),
      },
    ],
  },
  other: {
    path: "any MCP client",
    blocks: [
      {
        label: "URL + Bearer header",
        text: `{
  "url": "https://api.roomd.sh/mcp",
  "headers": {
    "Authorization": "Bearer <key>"
  }
}`,
      },
    ],
  },
};

type Client = keyof typeof SNIPPETS;

/**
 * Landing connect panel: same multi-client story as the in-app setup guide.
 */
export function LandingConnect() {
  const [client, setClient] = useState<Client>("cursor");
  const active = SNIPPETS[client];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.03] dark:shadow-none dark:ring-white/[0.04]">
      <Tabs value={client} onValueChange={(v) => setClient(v as Client)}>
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-9 w-full flex-wrap sm:w-auto">
            <TabsTrigger value="claude" className="flex-1 text-xs sm:flex-none sm:text-sm">
              Claude Code
            </TabsTrigger>
            <TabsTrigger value="cursor" className="flex-1 text-xs sm:flex-none sm:text-sm">
              Cursor
            </TabsTrigger>
            <TabsTrigger value="codex" className="flex-1 text-xs sm:flex-none sm:text-sm">
              Codex
            </TabsTrigger>
            <TabsTrigger value="other" className="flex-1 text-xs sm:flex-none sm:text-sm">
              Other MCP
            </TabsTrigger>
          </TabsList>
          <span className="font-mono text-xs text-muted-foreground">{active.path}</span>
        </div>

        {(Object.keys(SNIPPETS) as Client[]).map((id) => {
          const snip = SNIPPETS[id];
          return (
            <TabsContent key={id} value={id} className="mt-0">
              <div className="space-y-0 divide-y divide-border/70">
                {snip.hint && (
                  <p className="px-5 py-3 text-xs text-muted-foreground md:text-sm">{snip.hint}</p>
                )}
                {snip.blocks.map((block) => (
                  <div key={block.label} className="px-5 py-4">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {block.label}
                    </p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground/90 md:text-sm md:break-normal md:whitespace-pre">
                      {block.text}
                    </pre>
                  </div>
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
