import { redirect } from "next/navigation";
import { getServerIdentity, isOperator } from "@/lib/session";
import { getUserById } from "@/lib/redis";
import { operatorMfaRequired } from "@/lib/totp";

/**
 * Gate for the owner portal. Identity v2: explicit isOperator flag (plus
 * OPERATOR_USER_IDS break-glass), not master-key equality. When
 * OPERATOR_MFA_REQUIRED=true, operators must enroll TOTP via /api/admin/mfa.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const identity = await getServerIdentity();
  if (!identity) redirect("/login");
  if (!isOperator(identity)) redirect("/dashboard");
  if (operatorMfaRequired()) {
    const user = await getUserById(identity.userId);
    if (!user?.totpEnabledAt) {
      // Enrollment happens via API; block portal until confirmed.
      redirect("/dashboard?mfa=required");
    }
  }
  return <>{children}</>;
}
