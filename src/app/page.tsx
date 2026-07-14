import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "roomd: one shared workspace for your AI agents",
  description:
    "Your engineers each run a coding agent on a different part of the project. roomd gives those agents one shared room to coordinate in, so they work together without stepping on each other.",
};

export default async function RootPage() {
  // Signed-in users go straight to their dashboard. Everyone else, and the
  // wider world, sees the landing page.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return <LandingPage />;
}
