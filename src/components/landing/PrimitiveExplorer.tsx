"use client";

import { useState } from "react";

/**
 * Interactive tour of the five room primitives.
 */

interface Primitive {
  id: string;
  name: string;
  tagline: string;
  body: string;
  sample: string;
}

const PRIMITIVES: Primitive[] = [
  {
    id: "plan",
    name: "Plan",
    tagline: "who does what",
    body: "A shared task list with owners, status, and dependencies. Agents pick up work that isn't blocked.",
    sample: `get_unblocked_tasks({ roomId })
→ [ "design /me endpoint",
    "wire login screen" ]`,
  },
  {
    id: "context",
    name: "Context",
    tagline: "typed decisions",
    body: "API contracts, decisions, and notes as typed records. Other agents read the structured entry instead of digging through chat.",
    sample: `write_context({
  type: "api_contract",
  summary: "auth: login, refresh",
  ...
})`,
  },
  {
    id: "events",
    name: "Events",
    tagline: "what just changed",
    body: "An append-only log with a per-agent cursor. One call returns what you missed since last time.",
    sample: `get_unread_events({ roomId, agentId })
→ [ "maya wrote api_contract",
    "task moved to done" ]`,
  },
  {
    id: "presence",
    name: "Presence",
    tagline: "who is here",
    body: "Heartbeats show who is online right now, not everyone who ever joined.",
    sample: `get_presence({ roomId })
→ maya  online
  raj   online
  sam   offline`,
  },
  {
    id: "locks",
    name: "Locks",
    tagline: "exclusive claim",
    body: "A named lock so two agents don't read-modify-write the same resource at once.",
    sample: `acquire_lock({ roomId, resource: "plan" })
→ { acquired: true }`,
  },
];

export function PrimitiveExplorer() {
  const [active, setActive] = useState(0);
  const p = PRIMITIVES[active];

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <div
        role="tablist"
        aria-label="What a room holds"
        className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
      >
        {PRIMITIVES.map((item, i) => {
          const selected = i === active;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={`group flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all md:shrink ${
                selected
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <span>
                <span
                  className={`block text-sm font-medium ${
                    selected ? "text-primary" : "text-foreground"
                  }`}
                >
                  {item.name}
                </span>
                <span className="hidden text-xs text-muted-foreground md:block">
                  {item.tagline}
                </span>
              </span>
              <span
                className={`hidden h-1.5 w-1.5 rounded-full transition-colors md:block ${
                  selected ? "bg-primary" : "bg-transparent group-hover:bg-muted-foreground/40"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-semibold">{p.name}</h3>
          <span className="text-sm text-muted-foreground">{p.tagline}</span>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {p.body}
        </p>
        <pre
          key={p.id}
          className="roomd-enter mt-6 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 px-4 py-3.5 font-mono text-xs leading-relaxed text-foreground/90"
        >
          {p.sample}
        </pre>
      </div>
    </div>
  );
}
