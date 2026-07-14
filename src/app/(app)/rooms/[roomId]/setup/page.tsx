import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerIdentity } from "@/lib/session";
import { getRoomMeta } from "@/lib/redis";
import { SetupSnippet } from "@/components/SetupSnippet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  params: { roomId: string };
}

export default async function SetupPage({ params }: Props) {
  // This page shows the operator their own team key so they can paste it into
  // Claude Code, Cursor, or another MCP client. It is the one place the key is
  // rendered on purpose.
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");

  const meta = await getRoomMeta(params.roomId);
  if (!meta) redirect("/dashboard");

  const collabMcpUrl = process.env.ROOMD_URL ?? "http://localhost:3000";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up {meta.name}</h1>
        <p className="text-sm text-muted-foreground">
          Room ID:{" "}
          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {params.roomId}
          </code>
          . Connect Claude Code, Cursor, or any MCP client — pick a tab below.
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
