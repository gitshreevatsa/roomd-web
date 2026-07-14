"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SNIPPETS = {
  claude: {
    path: ".claude/settings.json",
    json: `{
  "mcpServers": {
    "roomd": {
      "type": "http",
      "url": "https://api.roomd.sh/mcp",
      "headers": {
        "Authorization": "Bearer <key>"
      }
    }
  }
}`,
  },
  cursor: {
    path: ".cursor/mcp.json",
    json: `{
  "mcpServers": {
    "roomd": {
      "url": "https://api.roomd.sh/mcp",
      "headers": {
        "Authorization": "Bearer <key>"
      }
    }
  }
}`,
  },
  other: {
    path: "any MCP client",
    json: `{
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
          <TabsList className="h-9 w-full sm:w-auto">
            <TabsTrigger value="claude" className="flex-1 text-xs sm:flex-none sm:text-sm">
              Claude Code
            </TabsTrigger>
            <TabsTrigger value="cursor" className="flex-1 text-xs sm:flex-none sm:text-sm">
              Cursor
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
              {SNIPPETS[id].json}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
