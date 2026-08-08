import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerIdentity } from "@/lib/session";
import { getRoomMeta } from "@/lib/redis";
import { SetupSnippet } from "@/components/SetupSnippet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: { roomId: string };
  searchParams?: { name?: string };
}

export default async function SetupPage({ params, searchParams }: Props) {
  // Shows the caller's own team key so they can paste it into Claude Code,
  // Cursor, or another MCP client. Any signed-in teammate may open this —
  // roomd enforces room access when the agent connects.
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");

  const meta = await getRoomMeta(params.roomId);
  const roomName = meta?.name ?? searchParams?.name ?? params.roomId;

  // Public MCP URL only — never an internal service hostname.
  const collabMcpUrl =
    process.env.NEXT_PUBLIC_ROOMD_URL ??
    process.env.ROOMD_URL ??
    "http://localhost:3000";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up {roomName}</h1>
        <p className="text-sm text-muted-foreground">
          Room ID:{" "}
          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {params.roomId}
          </code>
          . Connect an MCP client, paste AGENTS.md so the agent stays online and
          logs every chat into room context, then open the room dashboard.
        </p>
      </div>

      <SetupSnippet
        collabMcpUrl={collabMcpUrl}
        apiKey={identity.apiKey}
        roomId={params.roomId}
      />

      <div className="flex items-center justify-between pt-4 border-t">
        <Link href="/dashboard">
          <Button variant="outline" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
        <Link href={`/rooms/${params.roomId}`}>
          <Button className="gap-1.5">
            Open room dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
