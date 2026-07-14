import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerIdentity, isOperator } from "@/lib/session";
import { buildUsageReport } from "@/lib/usage";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Usage — roomd" };

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function UsagePage() {
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");
  // Operator only. A non-operator who guesses the URL is sent back to /admin.
  if (!isOperator(identity)) redirect("/dashboard");

  const masterKey = process.env.ROOMD_MASTER_KEY ?? identity.apiKey;
  const report = await buildUsageReport(masterKey);
  const o = report.overview;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">
            Every org, room, and how much each is being used. Operator view.
          </p>
        </div>
        <Link href="/owner">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Owner
          </Button>
        </Link>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Orgs" value={o.orgs} />
        <Stat label="Rooms" value={o.rooms} />
        <Stat label="Active rooms" value={o.activeRooms} />
        <Stat label="Tasks" value={o.totalTasks} />
        <Stat label="Events" value={o.totalEvents} />
        <Stat label="Context entries" value={o.totalContext} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <Stat label="Waitlist pending" value={o.waitlistPending} />
        <Stat label="Waitlist invited" value={o.waitlistInvited} />
      </div>

      {/* Per org */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">By org</h2>
        {report.orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orgs yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Org</th>
                  <th className="px-4 py-2 text-left font-medium">Sign-in</th>
                  <th className="px-4 py-2 text-right font-medium">Rooms</th>
                  <th className="px-4 py-2 text-right font-medium">Tasks</th>
                  <th className="px-4 py-2 text-right font-medium">Events</th>
                  <th className="px-4 py-2 text-left font-medium">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.orgs.map((org) => (
                  <tr key={org.teamId}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{org.email ?? org.name ?? "API-key account"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{org.teamId}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{org.authMethods.join(", ")}</td>
                    <td className="px-4 py-2 text-right">{org.roomCount}</td>
                    <td className="px-4 py-2 text-right">{org.taskCount}</td>
                    <td className="px-4 py-2 text-right">{org.eventCount}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatRelativeTime(org.lastActivity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per room */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">By room</h2>
        {report.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rooms yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Room</th>
                  <th className="px-4 py-2 text-left font-medium">Owner</th>
                  <th className="px-4 py-2 text-right font-medium">Tasks</th>
                  <th className="px-4 py-2 text-right font-medium">Agents</th>
                  <th className="px-4 py-2 text-right font-medium">Events</th>
                  <th className="px-4 py-2 text-right font-medium">Context</th>
                  <th className="px-4 py-2 text-left font-medium">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.rooms.map((r) => (
                  <tr key={r.roomId}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.roomId}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.ownerEmail ?? r.ownerTeam ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.stats ? `${r.stats.doneTasks}/${r.stats.taskCount}` : "-"}
                    </td>
                    <td className="px-4 py-2 text-right">{r.stats?.agentCount ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{r.stats?.eventCount ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{r.stats?.contextCount ?? "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.stats?.lastActivity ? formatRelativeTime(r.stats.lastActivity) : formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
