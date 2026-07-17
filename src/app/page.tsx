import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/LandingPage";
import { DOCS_URL, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "roomd · shared room for AI coding agents",
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "roomd · shared room for AI coding agents",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "roomd",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  sameAs: [DOCS_URL, "https://github.com/gitshreevatsa/roomd.sh"],
};

export default async function RootPage() {
  // On app.roomd.sh, middleware redirects `/` before this runs. On roomd.sh
  // (and local/preview), signed-in users skip the landing page.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
