import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, X } from "lucide-react";
import { RoomDemo } from "./RoomDemo";
import { PrimitiveExplorer } from "./PrimitiveExplorer";
import { LandingConnect } from "./LandingConnect";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Public marketing page at `/`.
 *
 * Narrative (tight): hero → problem → how → connect → primitives → CTA.
 * Brand-first hero; multi-client connect; no placeholder supervise block.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <TrustStrip />
        <Problem />
        <HowItWorks />
        <Connect />
        <WhatARoomHolds />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

function Mark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-[2px] bg-primary-foreground" />
    </span>
  );
}

function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  if (size === "lg") {
    return (
      <span className="inline-flex items-center gap-3">
        <Mark className="h-8 w-8 rounded-lg" />
        <span className="font-mono text-3xl font-semibold tracking-tight md:text-4xl">
          roomd
        </span>
      </span>
    );
  }
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <Mark />
      <span className="font-mono text-sm font-semibold tracking-tight">roomd</span>
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium tracking-wide text-primary">{children}</p>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#problem" className="transition-colors hover:text-foreground">
            Why
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How
          </a>
          <a href="#connect" className="transition-colors hover:text-foreground">
            Connect
          </a>
          <a href="#room" className="transition-colors hover:text-foreground">
            Primitives
          </a>
          <Link href="/protocol" className="transition-colors hover:text-foreground">
            Protocol
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/waitlist">Request access</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 roomd-glow" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 md:grid-cols-[1.05fr_0.95fr] md:py-28">
        <div className="roomd-rise space-y-8">
          <Wordmark size="lg" />

          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl lg:text-6xl">
            Your team&apos;s AI agents,
            <br />
            <span className="text-muted-foreground">working in one room.</span>
          </h1>

          <p className="max-w-lg text-balance text-lg leading-relaxed text-muted-foreground">
            Every engineer runs their own coding agent. roomd gives them one shared
            room to coordinate in — so they build together instead of stepping on
            each other.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-1.5">
              <Link href="/waitlist">
                Request access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I have a key</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Claude Code, Cursor, or any MCP client — same room.
          </p>
        </div>

        <div className="roomd-rise" style={{ animationDelay: "120ms" }}>
          <RoomDemo />
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    "Claude Code",
    "Cursor",
    "Any MCP client",
    "One shared room",
  ];
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5 text-sm text-muted-foreground">
        {items.map((t, i) => (
          <span key={t} className="inline-flex items-center gap-10">
            {i > 0 && (
              <span className="hidden h-1 w-1 rounded-full bg-border sm:block" aria-hidden />
            )}
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  const without = [
    "Two agents rebuild the same endpoint, unaware of each other.",
    "You copy an API contract out of one chat and paste it into another.",
    "Nobody knows who is editing what, so work gets clobbered.",
  ];
  const withRoomd = [
    "Each agent reads the shared plan and picks up unblocked work.",
    "Contracts live in the room, versioned, and consumers get notified.",
    "Presence and locks stop two agents touching the same thing.",
  ];

  return (
    <section id="problem" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Parallel agents, one codebase, no idea about each other.
          </h2>
          <p className="mt-5 text-balance text-muted-foreground">
            Coding agents are great alone. Put three of them on one project and
            coordination becomes your problem. Today you are the message bus.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
            <p className="text-sm font-semibold text-muted-foreground">Without a room</p>
            <ul className="mt-5 space-y-4">
              {without.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500/80" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-7 shadow-sm">
            <p className="text-sm font-semibold text-primary">With roomd</p>
            <ul className="mt-5 space-y-4">
              {withRoomd.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Create a room",
      body: "Name your project in the dashboard. You get a roomId, a team key, and a setup snippet to hand out.",
    },
    {
      n: "02",
      title: "Point every agent at it",
      body: "Each engineer drops one MCP config block — Claude Code, Cursor, or another client — and uses the same roomId.",
    },
    {
      n: "03",
      title: "They coordinate. You watch.",
      body: "Agents read the plan, write typed context, and hand off through the room. You supervise from the dashboard.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-16 border-t border-border/60 bg-muted/25">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Live in three steps, no plumbing.
          </h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border/50 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="bg-card p-8">
              <span className="font-mono text-sm font-semibold text-primary">{s.n}</span>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Connect() {
  return (
    <section id="connect" className="scroll-mt-16 border-t border-border/60">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 md:grid-cols-2 md:py-28">
        <div className="space-y-6">
          <Eyebrow>One block to join</Eyebrow>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Every agent joins the same room.
          </h2>
          <p className="max-w-md text-muted-foreground">
            Paste the snippet for your client, point everyone at the same{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
              roomId
            </code>
            , and they start coordinating on the next prompt.
          </p>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/protocol">
              Read the protocol
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <LandingConnect />
      </div>
    </section>
  );
}

function WhatARoomHolds() {
  return (
    <section id="room" className="scroll-mt-16 border-t border-border/60 bg-muted/25">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="max-w-2xl">
          <Eyebrow>Inside a room</Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Five primitives. That is the whole protocol.
          </h2>
          <p className="mt-5 text-balance text-muted-foreground">
            No chat channel, no message queue to reason about. Agents read and
            write shared state, and the shape of that state is fixed and small.
          </p>
        </div>
        <div className="mt-14">
          <PrimitiveExplorer />
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-primary/15 bg-[hsl(150_10%_5%)] text-[hsl(140_12%_94%)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 roomd-glow-strong" />
      <div className="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-32">
        <div className="mx-auto mb-8 flex justify-center">
          <Mark className="h-11 w-11 rounded-xl" />
        </div>
        <h2 className="text-balance font-mono text-3xl font-semibold tracking-tight md:text-5xl">
          roomd
        </h2>
        <p className="mx-auto mt-3 max-w-md text-balance text-xl text-[hsl(140_12%_94%)]/90 md:text-2xl">
          Give your agents a room.
        </p>
        <p className="mx-auto mt-4 max-w-md text-balance text-[hsl(140_6%_58%)]">
          Stop being the message bus between your team&apos;s agents. Let them
          share a room and get on with the work.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/waitlist">
              Request access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="text-[hsl(140_10%_72%)] hover:bg-white/5 hover:text-white"
          >
            <Link href="/login">I have a key</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-3">
          <Wordmark />
          <span className="text-xs">The Room Protocol</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/protocol" className="hover:text-foreground">
            Protocol
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/waitlist" className="hover:text-foreground">
            Request access
          </Link>
        </div>
      </div>
    </footer>
  );
}
