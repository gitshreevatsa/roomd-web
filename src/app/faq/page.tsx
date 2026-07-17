import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FAQ_ITEMS, faqJsonLd } from "@/lib/faq";
import { DOCS_URL, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "What roomd is, how MCP agents share a room, how to get access, and how it relates to the Room Protocol.",
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "FAQ · roomd",
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/faq`,
  },
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
            <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
              roomd
            </Link>
            <div className="flex items-center gap-2">
              <a
                href={DOCS_URL}
                className="text-sm text-muted-foreground hover:text-foreground"
                rel="noopener noreferrer"
              >
                Docs
              </a>
              <ThemeToggle />
              <Button asChild size="sm">
                <Link href="/waitlist">Request access</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-14">
          <h1 className="text-3xl font-semibold tracking-tight">FAQ</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Short answers for humans and agents. For setup steps, see the{" "}
            <a
              href={`${DOCS_URL}/quickstart`}
              className="text-foreground underline-offset-4 hover:underline"
              rel="noopener noreferrer"
            >
              quickstart
            </a>
            .
          </p>

          <dl className="mt-12 space-y-10">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <dt className="text-lg font-medium tracking-tight">{item.question}</dt>
                <dd className="mt-2 text-muted-foreground leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-14 text-sm text-muted-foreground">
            Machine-readable index:{" "}
            <a href="/llms.txt" className="underline-offset-4 hover:underline">
              /llms.txt
            </a>
            {" · "}
            <a
              href={`${DOCS_URL}/llms.txt`}
              className="underline-offset-4 hover:underline"
              rel="noopener noreferrer"
            >
              docs llms.txt
            </a>
          </p>
        </main>
      </div>
    </>
  );
}
