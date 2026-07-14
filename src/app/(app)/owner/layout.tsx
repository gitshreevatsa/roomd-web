import { redirect } from "next/navigation";
import { getServerIdentity, isOperator } from "@/lib/session";

/**
 * Gate for the whole owner portal. Only the deployment owner (the holder of the
 * master key) may enter; every other signed-in user, an invited org, is sent to
 * their own dashboard. This is enforced server-side, so the owner pages never
 * even render for a non-owner.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");
  if (!isOperator(identity)) redirect("/dashboard");
  return <>{children}</>;
}
