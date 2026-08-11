"use client";

import { useEffect, useRef, useState } from "react";

/** Animated hero visual: teammates' agents meeting in one room. */

type Kind = "join" | "share" | "read" | "wait" | "done";

interface Beat {
  who: Who;
  text: string;
  kind: Kind;
}

type Who = "alex" | "claire" | "jordan";

const PEOPLE: { id: Who; label: string; tint: string }[] = [
  { id: "alex", label: "Alex", tint: "bg-emerald-600" },
  { id: "claire", label: "Claire", tint: "bg-teal-600" },
  { id: "jordan", label: "Jordan", tint: "bg-lime-700" },
];

const SCRIPT: Beat[] = [
  { who: "alex", text: "joined the room", kind: "join" },
  { who: "alex", text: "shared how login should work", kind: "share" },
  { who: "claire", text: "joined the room", kind: "join" },
  { who: "claire", text: "caught up on Alex's notes", kind: "read" },
  { who: "jordan", text: "waiting — needs the /me route", kind: "wait" },
  { who: "alex", text: "added /me to the notes", kind: "share" },
  { who: "claire", text: "finished the login screen", kind: "done" },
];

const KIND_ACCENT: Record<Kind, string> = {
  join: "bg-primary",
  share: "bg-primary",
  read: "bg-teal-500",
  wait: "bg-amber-500",
  done: "bg-primary",
};

interface FeedItem extends Beat {
  id: number;
}

const TICK_MS = 2200;
const DONE_BASE = 4;
const TOTAL_TASKS = 8;

export function RoomDemo() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [online, setOnline] = useState<Set<Who>>(new Set());
  const [done, setDone] = useState(0);
  const stepRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setOnline(new Set<Who>(["alex", "claire", "jordan"]));
      setDone(1);
      setFeed(
        [SCRIPT[3], SCRIPT[4], SCRIPT[5], SCRIPT[6]].map((b, i) => ({ ...b, id: i }))
      );
      return;
    }

    const advance = () => {
      const step = stepRef.current;
      const beat = SCRIPT[step % SCRIPT.length];

      if (step > 0 && step % SCRIPT.length === 0) {
        setOnline(new Set());
        setDone(0);
        setFeed([]);
      }

      idRef.current += 1;
      const item: FeedItem = { ...beat, id: idRef.current };
      setFeed((f) => [item, ...f].slice(0, 4));
      setOnline((prev) => new Set(prev).add(beat.who));
      if (beat.kind === "done") setDone((d) => Math.min(d + 1, TOTAL_TASKS - DONE_BASE));

      stepRef.current = step + 1;
    };

    advance();
    const t = setInterval(advance, TICK_MS);
    return () => clearInterval(t);
  }, []);

  const doneCount = DONE_BASE + done;
  const pct = Math.round((doneCount / TOTAL_TASKS) * 100);

  return (
    <div className="relative mx-auto w-full">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 opacity-90 blur-3xl"
        style={{
          background:
            "radial-gradient(22rem 16rem at 50% 30%, hsl(var(--primary) / 0.2), transparent 70%)",
        }}
      />

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/80 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.35)] backdrop-blur-sm dark:bg-card/80">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Live room
            </p>
            <p
              className="mt-0.5 text-sm font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
            >
              payments-api
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <span className="roomd-live h-1.5 w-1.5 rounded-full bg-primary" />
            online
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-y border-border/60 px-5 py-3">
          {PEOPLE.map((p) => {
            const isOn = online.has(p.id);
            return (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 px-1 py-0.5 text-xs transition-opacity duration-500 ${
                  isOn ? "opacity-100" : "opacity-35"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${p.tint}`}
                >
                  {p.label[0]}
                </span>
                <span className="font-medium">{p.label}</span>
              </span>
            );
          })}
        </div>

        <div className="flex h-[200px] flex-col gap-2.5 overflow-hidden px-4 py-4">
          {feed.length === 0 && (
            <p className="px-1 py-10 text-center text-sm text-muted-foreground">
              Waiting for someone to join…
            </p>
          )}
          {feed.map((item) => {
            const person = PEOPLE.find((p) => p.id === item.who)!;
            return (
              <div key={item.id} className="roomd-enter flex items-start gap-3 px-1 py-1.5">
                <span className={`mt-1.5 h-6 w-0.5 shrink-0 rounded-full ${KIND_ACCENT[item.kind]}`} />
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${person.tint}`}
                >
                  {person.label[0]}
                </span>
                <p className="min-w-0 flex-1 text-left text-sm leading-snug">
                  <span className="font-semibold text-foreground">{person.label}</span>{" "}
                  <span className="text-muted-foreground">{item.text}</span>
                </p>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 px-5 pb-5 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Shared progress</span>
            <span>
              {doneCount} of {TOTAL_TASKS}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
