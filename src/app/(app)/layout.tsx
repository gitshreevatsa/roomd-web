import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getServerIdentity, isOperator } from "@/lib/session";
import {
  countTeamOwners,
  deleteUser,
  getMembership,
  getUserById,
  listTeamMemberIds,
  removeMembership,
} from "@/lib/redis";
import {
  purgeTeamRooms,
  revokeTeamAccess,
  revokeUserApiKey,
} from "@/lib/roomd";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { AppNav } from "@/components/AppNav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function deleteAccountAction() {
  "use server";
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");
  const user = await getUserById(identity.userId);
  if (!user) redirect("/login");
  if (isOperator(identity) || user.isOperator) {
    throw new Error("Operator account cannot self-delete");
  }

  const master = process.env.ROOMD_MASTER_KEY;
  if (!master) {
    throw new Error("Cannot revoke safely — ROOMD_MASTER_KEY missing");
  }
  const membership = await getMembership(user.id, user.teamId);
  const role = membership?.role ?? "owner";

  if (role === "owner") {
    const owners = await countTeamOwners(user.teamId);
    if (owners > 1) {
      throw new Error("Transfer ownership before deleting this account");
    }
    try {
      await revokeTeamAccess(user.teamId, master);
    } catch {
      throw new Error("Revocation incomplete — account not deleted");
    }
    try {
      await purgeTeamRooms(user.teamId, master);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not available")) {
        throw new Error("Room purge failed — account not deleted");
      }
    }
    const members = await listTeamMemberIds(user.teamId);
    for (const mid of members) {
      if (mid !== user.id) await removeMembership(mid, user.teamId);
    }
  } else {
    try {
      await revokeUserApiKey(user.teamId, user.apiKey, master);
    } catch {
      throw new Error("Key revocation failed — account not deleted");
    }
    await removeMembership(user.id, user.teamId);
  }

  await deleteUser(user.id);
  await signOut({
    redirectTo: process.env.MARKETING_URL ?? "https://roomd.sh",
  });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const identity = await getServerIdentity();
  if (!identity) redirect("/login");
  const owner = isOperator(identity);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-6">
            <Link href="/dashboard" className="font-mono text-sm font-semibold tracking-tight">
              roomd
            </Link>
            <AppNav showOwner={owner} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
              {session.user.email ?? session.user.teamId}
            </span>
            <ThemeToggle />
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            {!owner && <DeleteAccountButton action={deleteAccountAction} />}
            <form
              action={async () => {
                "use server";
                await signOut({
                  redirectTo: process.env.MARKETING_URL ?? "https://roomd.sh",
                });
              }}
            >
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
