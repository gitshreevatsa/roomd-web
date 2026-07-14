import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, Download, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "The Room Protocol — technical report",
  description:
    "Shared-State Coordination for Multi-Agent Software Development. The technical report behind roomd: read it in the browser or download the PDF.",
};

const PAPER_HTML = "/the-room-protocol.html";
const PAPER_PDF = "/the-room-protocol.pdf";

function Mark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-primary ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-[2px] bg-primary-foreground" />
    </span>
  );
}

const terminology: [string, string][] = [
  ["the Room Protocol", "The design: the room abstraction, five state primitives, exposed over MCP. A spec, not a program."],
  ["roomd", "The reference implementation: the stateless server you run and point agents at."],
  ["roomd-web", "The dashboard humans log into to watch and manage rooms."],
  ["room", "The core primitive: one workspace, named by a roomId, that all coordination state lives under."],
];

const contributions = [
  "The Room Protocol: one abstraction, the room, with a primitive set argued sufficient to coordinate independent coding agents.",
  "A typed-context model: context entries carry a type and a per-type schema, so a consumer relies on shape rather than parsing prose.",
  "A stateless, single-store reference architecture: a fresh MCP server per request over one Redis, durable and restartable.",
  "A layered multi-tenancy and access model: three secret types, first-touch room ownership, and rate limiting that fails open.",
  "A concurrency mechanism: a distributed plan lock, plus per-agent cursors that give each agent an exactly-once view of events.",
  "An evaluation methodology for coordination overhead, handoff correctness, and concurrency safety.",
];

export default function ProtocolPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <Mark />
            <span className="font-mono text-sm font-semibold tracking-tight">roomd</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild size="sm">
              <a href={PAPER_HTML} target="_blank" rel="noopener noreferrer">
                Read the paper
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        {/* title block */}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Technical Report · July 2026
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
          The Room Protocol
        </h1>
        <p className="mt-3 text-balance text-lg text-muted-foreground">
          Shared-State Coordination for Multi-Agent Software Development
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Shreyas Padmakiran · roomd.sh
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-1.5">
            <a href={PAPER_HTML} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4" />
              Read the paper
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-1.5">
            <a href={PAPER_PDF} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </div>

        {/* abstract */}
        <section className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Abstract
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              Large language model coding agents are effective in isolation but have no
              native way to coordinate when several of them work on one software project.
              The common workarounds, a human relaying state, agents exchanging messages,
              or agents sharing only a repository, all treat coordination as
              message-passing. This work argues the better primitive is shared state: a
              small set of structured, persistent, queryable objects that agents read and
              write instead of messaging one another.
            </p>
            <p>
              The Room Protocol organizes coordination around a single abstraction, the
              room, which namespaces five state primitives (a plan, a typed context store,
              an append-only event log, presence, and locks) and is the unit of ownership
              and access control. It is exposed over the Model Context Protocol, so any
              MCP-capable agent can participate without a custom client. The reference
              implementation, roomd, is a fully stateless server backed entirely by a
              single Redis: the properties that make coordination durable are the ones
              that make the system multi-tenant and deployable.
            </p>
          </div>
        </section>

        {/* terminology */}
        <section className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            roomd vs the Room Protocol
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            One idea, one thing that runs it. The same split as HTTP versus a web server.
          </p>
          <div className="mt-5 divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
            {terminology.map(([term, desc]) => (
              <div key={term} className="grid gap-1 p-4 sm:grid-cols-[160px_1fr] sm:gap-4">
                <div className="font-mono text-sm font-medium text-foreground">{term}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* contributions */}
        <section className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contributions
          </h2>
          <ol className="mt-5 space-y-4">
            {contributions.map((c, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-mono text-sm font-semibold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] leading-relaxed text-foreground/90">{c}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* read CTA */}
        <section className="mt-16 rounded-2xl border border-border bg-muted/30 p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Read the full report</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The complete paper covers the protocol operations, the typed-context model, the
            stateless architecture, concurrency and access control, an evaluation
            methodology, and related work.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-1.5">
              <a href={PAPER_HTML} target="_blank" rel="noopener noreferrer">
                Read the paper
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-1.5">
              <a href={PAPER_PDF} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-2">
            <Mark />
            <span className="font-mono text-xs font-semibold">roomd</span>
          </Link>
          <span className="text-xs">The Room Protocol</span>
        </div>
      </footer>
    </div>
  );
}
