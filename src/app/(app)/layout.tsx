import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getServerIdentity, isOperator } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const identity = await getServerIdentity();
  const owner = identity ? isOperator(identity) : false;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-6">
            <Link href="/dashboard" className="font-mono text-sm font-semibold tracking-tight">
              roomd
            </Link>
            <nav className="flex items-center gap-0.5 sm:gap-1">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3">Dashboard</Button>
              </Link>
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3">Admin</Button>
              </Link>
              {owner && (
                <Link href="/owner">
                  <Button variant="ghost" size="sm" className="px-2 sm:px-3">Owner</Button>
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
              {session.user.email ?? session.user.teamId}
            </span>
            <ThemeToggle />
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
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
