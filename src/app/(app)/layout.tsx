import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getServerIdentity, isOperator } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppNav } from "@/components/AppNav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
            <Link
              href="/account"
              className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px] hover:text-foreground underline-offset-4 hover:underline"
            >
              {session.user.email ?? session.user.teamId}
            </Link>
            <ThemeToggle />
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
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
