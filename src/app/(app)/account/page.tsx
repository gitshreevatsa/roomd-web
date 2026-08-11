import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerIdentity, isOperator } from "@/lib/session";
import { getUserById } from "@/lib/redis";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { deleteAccountAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const identity = await getServerIdentity();
  if (!identity) redirect("/login");

  const user = await getUserById(identity.userId);
  const owner = isOperator(identity) || Boolean(user?.isOperator);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Profile and account controls.
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between gap-4 border-b pb-3">
          <span className="text-muted-foreground">Email</span>
          <span className="font-mono text-right break-all">
            {session.user.email ?? "—"}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-b pb-3">
          <span className="text-muted-foreground">Team</span>
          <span className="font-mono text-right break-all">
            {session.user.teamId ?? identity.teamId}
          </span>
        </div>
      </div>

      {!owner ? (
        <section className="space-y-3 border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete your account. You’ll lose access and be signed out.
              This cannot be undone.
            </p>
          </div>
          <DeleteAccountButton action={deleteAccountAction} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Operator accounts cannot be self-deleted.
        </p>
      )}
    </div>
  );
}
