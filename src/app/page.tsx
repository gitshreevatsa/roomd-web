import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "roomd",
  description:
    "Each engineer runs a coding agent. roomd gives those agents one shared room so they don't overwrite each other's work.",
};

export default async function RootPage() {
  // On app.roomd.sh, middleware redirects `/` before this runs. On roomd.sh
  // (and local/preview), signed-in users skip the landing page.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return <LandingPage />;
}
