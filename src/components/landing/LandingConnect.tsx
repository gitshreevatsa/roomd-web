"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildClaudeSnippet,
  buildCodexSnippet,
  buildCursorSnippet,
} from "@/lib/mcp-snippets";

const PLACEHOLDER_KEY = "<key>";

const SNIPPETS = {
  claude: {
    path: ".claude/settings.json",
    text: buildClaudeSnippet("https://api.roomd.sh", PLACEHOLDER_KEY),
  },
  cursor: {
    path: ".cursor/mcp.json",
    text: buildCursorSnippet("https://api.roomd.sh", PLACEHOLDER_KEY),
  },
  codex: {
    path: "~/.codex/config.toml",
    text: `${buildCodexSnippet("https://api.roomd.sh")}\n\n# export ROOMD_API_KEY="<key>"`,
  },
  other: {
    path: "any MCP client",
    text: `{
  "url": "https://api.roomd.sh/mcp",
  "headers": {
    "Authorization": "Bearer <key>"
  }
}`,
  },
} as const;

type Client = keyof typeof SNIPPETS;

/**
 * Landing connect panel: same multi-client story as the in-app setup guide.
 */
export function LandingConnect() {
  const [client, setClient] = useState<Client>("cursor");

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
          <span className="font-mono text-xs text-muted-foreground">
            {SNIPPETS[client].path}
          </span>
        </div>

        {(Object.keys(SNIPPETS) as Client[]).map((id) => (
          <TabsContent key={id} value={id} className="mt-0">
            <pre className="overflow-x-auto px-5 py-5 font-mono text-xs leading-relaxed text-foreground/90 md:text-sm">
              {SNIPPETS[id].text}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
