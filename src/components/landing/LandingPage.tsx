import Link from "next/link";
import { Syne, DM_Sans } from "next/font/google";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DOCS_URL } from "@/lib/site";
import { RoomDemo } from "./RoomDemo";
import { LandingConnect } from "./LandingConnect";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-landing-display",
  weight: ["500", "600", "700"],
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-landing-body",
  weight: ["400", "500", "600", "700"],
});

/** Public marketing page at `/`. */
export function LandingPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen overflow-x-hidden bg-background text-foreground`}
      style={{ fontFamily: "var(--font-landing-body), system-ui, sans-serif" }}
    >
      <Nav />
      <main>
        <Hero />
        <Moment />
        <HowItWorks />
        <Connect />
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
      <span className="inline-flex items-center gap-3.5">
        <Mark className="h-10 w-10 rounded-xl" />
        <span
          className="text-4xl font-semibold tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
        >
          roomd
        </span>
      </span>
    );
  }
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <Mark />
      <span
        className="text-sm font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
      >
        roomd
      </span>
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#moment" className="transition-colors hover:text-foreground">
            Why
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How
          </a>
          <a href="#connect" className="transition-colors hover:text-foreground">
            Connect
          </a>
          <a
            href={DOCS_URL}
            className="transition-colors hover:text-foreground"
            rel="noopener noreferrer"
          >
            Docs
          </a>
          <Link href="/faq" className="transition-colors hover:text-foreground">
            FAQ
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
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 roomd-hero-wash" />
        <div className="absolute inset-0 roomd-hero-grain opacity-[0.35] dark:opacity-20" />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
        <div className="roomd-rise space-y-7">
          <Wordmark size="lg" />

          <h1
            className="mx-auto max-w-[18ch] text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
            style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
          >
            A room your agents share
          </h1>

          <p className="mx-auto max-w-md text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
            Keep Claude, Cursor, or Codex. Point them at the same room — and stop
            copying between chats.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-1.5">
              <Link href="/waitlist">
                Request access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`${DOCS_URL}/quickstart`} rel="noopener noreferrer">
                See how it works
              </a>
            </Button>
          </div>
        </div>

        <div
          className="roomd-rise mt-14 w-full max-w-lg md:mt-16"
          style={{ animationDelay: "140ms" }}
        >
          <RoomDemo />
        </div>
      </div>
    </section>
  );
}

function Moment() {
  return (
    <section id="moment" className="scroll-mt-16 border-t border-border/50">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="text-balance text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
          >
            The plan is shared. The agents aren&apos;t.
          </h2>
          <p className="mt-5 text-balance text-lg leading-relaxed text-muted-foreground">
            Your team already knows what to build. But each person&apos;s Claude or
            Cursor only sees its own chat — so decisions and progress stay trapped
            with whoever typed them.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl gap-10 md:grid-cols-2 md:gap-16">
          <div className="space-y-3 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Without roomd
            </p>
            <p
              className="text-xl font-semibold leading-snug tracking-tight md:text-2xl"
              style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
            >
              Humans align. Agents stay in separate chats.
            </p>
          </div>
          <div className="space-y-3 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              With roomd
            </p>
            <p
              className="text-xl font-semibold leading-snug tracking-tight md:text-2xl"
              style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
            >
              Agents join the same room your team is already working in.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Make a room",
      body: "Name the project. You get a link and a key to share with the team.",
    },
    {
      n: "2",
      title: "Plug in your agent",
      body: "Paste one config into Claude, Cursor, or Codex. Same room for everyone.",
    },
    {
      n: "3",
      title: "Watch them sync",
      body: "They pick up what others wrote. You can peek from the dashboard anytime.",
    },
  ];

  return (
    <section id="how" className="scroll-mt-16 border-t border-border/50 bg-muted/20">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-xl text-center">
          <h2
            className="text-balance text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
          >
            Three minutes to set up
          </h2>
          <p className="mt-4 text-muted-foreground">
            No new agent to learn. Use the ones you already like.
          </p>
        </div>

        <ol className="mx-auto mt-14 grid max-w-4xl gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="text-center md:text-left">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
              >
                {s.n}
              </span>
              <h3
                className="mt-4 text-lg font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
              >
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Connect() {
  return (
    <section id="connect" className="scroll-mt-16 border-t border-border/50">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:gap-16 md:py-28">
        <div className="space-y-5">
          <h2
            className="text-balance text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
          >
            Works with the tools you already open
          </h2>
          <p className="max-w-md text-muted-foreground">
            One paste. Claude Code, Cursor, Codex — or any MCP client. Same room,
            same key.
          </p>
          <Button asChild variant="outline" className="gap-1.5">
            <a href={`${DOCS_URL}/quickstart`} rel="noopener noreferrer">
              Read the quickstart
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <LandingConnect />
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-primary/15 bg-[hsl(150_12%_6%)] text-[hsl(140_12%_94%)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 roomd-glow-strong" />
      <div className="relative mx-auto max-w-5xl px-6 py-24 text-center md:py-28">
        <div className="mx-auto mb-7 flex justify-center">
          <Mark className="h-11 w-11 rounded-xl" />
        </div>
        <h2
          className="text-balance text-3xl font-semibold tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
        >
          Put them in the same room
        </h2>
        <p className="mx-auto mt-4 max-w-md text-balance text-[hsl(140_6%_62%)]">
          Request access, share a room, and let your agents catch up with each other.
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
    <footer className="border-t border-border/50">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <Wordmark />
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a href={DOCS_URL} className="hover:text-foreground" rel="noopener noreferrer">
            Docs
          </a>
          <Link href="/faq" className="hover:text-foreground">
            FAQ
          </Link>
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
