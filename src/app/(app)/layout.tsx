import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getServerIdentity, isOperator } from "@/lib/session";
import { deleteUser, getUserById } from "@/lib/redis";
import { revokeAllTeamKeys } from "@/lib/roomd";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { AppNav } from "@/components/AppNav";

async function deleteAccountAction() {
  "use server";
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");
  const user = await getUserById(identity.userId);
  if (!user) redirect("/login");
  const master = process.env.ROOMD_MASTER_KEY;
  if (master && user.apiKey === master) {
    throw new Error("Operator account cannot self-delete");
  }
  if (master) {
    try {
      await revokeAllTeamKeys(user.teamId, master);
    } catch {
      /* best-effort */
    }
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
  const owner = identity ? isOperator(identity) : false;

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
