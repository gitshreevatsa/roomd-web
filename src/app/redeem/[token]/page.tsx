import Link from "next/link";
import { consumeRedeemToken } from "@/lib/redeem";

export const metadata = {
  title: "Reveal access key · roomd",
  robots: { index: false, follow: false },
};

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const { token } = await Promise.resolve(params);
  let secret: string | null = null;
  let error: string | null = null;

  try {
    const payload = await consumeRedeemToken(token);
    if (!payload) error = "This link expired or was already used.";
    else secret = payload.secret;
  } catch {
    error = "Could not redeem this link. Try again or ask for a new invite.";
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <p className="font-mono text-sm font-semibold tracking-tight">roomd</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {secret ? "Your access key" : "Link unavailable"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {secret
              ? "Copy this key now. It will not be shown again."
              : error}
          </p>
        </div>

        {secret && (
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 font-mono text-sm break-all whitespace-pre-wrap">
            {secret}
          </pre>
        )}

        <p className="text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Sign in with your key →
          </Link>
        </p>
      </div>
    </div>
  );
}
