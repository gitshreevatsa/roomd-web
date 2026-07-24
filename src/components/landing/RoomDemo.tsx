"use client";

import { useEffect, useRef, useState } from "react";

/** Animated hero visual: one room, three agents coordinating. */

type Kind = "presence" | "context" | "read" | "blocked" | "done";

interface Beat {
  who: Who;
  text: string;
  kind: Kind;
}

type Who = "alex" | "claire" | "jordan";

const PEOPLE: { id: Who; role: string; tint: string }[] = [
  { id: "alex", role: "backend", tint: "bg-violet-500" },
  { id: "claire", role: "frontend", tint: "bg-sky-500" },
  { id: "jordan", role: "qa", tint: "bg-amber-500" },
];

const SCRIPT: Beat[] = [
  { who: "alex", text: "joined the room", kind: "presence" },
  { who: "alex", text: "wrote api_contract · auth", kind: "context" },
  { who: "claire", text: "joined the room", kind: "presence" },
  { who: "claire", text: "reading alex's contract", kind: "read" },
  { who: "jordan", text: "blocked · needs /me endpoint", kind: "blocked" },
  { who: "alex", text: "added /me → contract v1.1", kind: "context" },
  { who: "claire", text: "login screen → done", kind: "done" },
];

const KIND_ACCENT: Record<Kind, string> = {
  presence: "bg-primary",
  context: "bg-primary",
  read: "bg-sky-500",
  blocked: "bg-amber-500",
  done: "bg-primary",
};

const KIND_LABEL: Record<Kind, string> = {
  presence: "presence",
  context: "context",
  read: "event",
  blocked: "event",
  done: "task",
};

interface FeedItem extends Beat {
  id: number;
}

const TICK_MS = 2100;
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
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] opacity-80 blur-3xl"
        style={{
          background:
            "radial-gradient(20rem 14rem at 55% 20%, hsl(var(--primary) / 0.22), transparent 70%)",
        }}
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/[0.06] ring-1 ring-black/[0.03] dark:shadow-none dark:ring-white/[0.05]">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5">
          <span className="inline-flex items-center gap-2.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary">
              <span className="h-1.5 w-1.5 rounded-[2px] bg-primary-foreground" />
            </span>
            <span className="font-mono text-xs font-medium">payments-api</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <span className="roomd-live h-1.5 w-1.5 rounded-full bg-primary" />
            live
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3.5">
          {PEOPLE.map((p) => {
            const isOn = online.has(p.id);
            return (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all duration-500 ${
                  isOn
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "border-transparent bg-muted/60 text-muted-foreground"
                }`}
                title={`${p.id} · ${p.role}`}
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white ${p.tint} ${
                    isOn ? "opacity-100" : "opacity-40"
                  }`}
                >
                  {p.id[0].toUpperCase()}
                </span>
                <span className="font-mono">{p.id}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
                    isOn ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              </span>
            );
          })}
        </div>

        <div className="flex h-[180px] flex-col gap-2 overflow-hidden px-3 py-3">
          {feed.length === 0 && (
            <p className="px-1 py-8 text-center text-xs text-muted-foreground">
              waiting for agents…
            </p>
          )}
          {feed.map((item) => {
            const person = PEOPLE.find((p) => p.id === item.who)!;
            return (
              <div
                key={item.id}
                className="roomd-enter flex items-center gap-2.5 rounded-xl border border-border/60 bg-background px-3 py-2.5"
              >
                <span className={`h-7 w-0.5 shrink-0 rounded-full ${KIND_ACCENT[item.kind]}`} />
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${person.tint}`}
                >
                  {item.who[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">
                    <span className="font-mono font-medium text-foreground">{item.who}</span>{" "}
                    <span className="text-muted-foreground">{item.text}</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {KIND_LABEL[item.kind]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-border/70 px-4 py-3.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono">plan</span>
            <span>
              {doneCount} of {TOTAL_TASKS} done
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
