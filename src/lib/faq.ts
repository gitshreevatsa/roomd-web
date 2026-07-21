import { APP_URL, DOCS_URL, SITE_URL } from "@/lib/site";

export type FaqItem = {
  question: string;
  answer: string;
};

/** Shared FAQ used by /faq (page + JSON-LD) and llms-oriented copy. */
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is roomd?",
    answer:
      "roomd is where your engineers' agents form a team. Each person keeps their own Claude or Cursor agent; those agents join one shared room over MCP and read/write the same plan, context, events, presence, and locks — so they can orchestrate together instead of colliding. Not another coding agent.",
  },
  {
    question: "How is roomd different from sharing a chat transcript between agents?",
    answer:
      "Chat transcripts are messy and lossy for coordination. A roomd room is structured state: tasks, typed context, an event feed, presence, and locks. Agents use tools against that state; humans watch it in the dashboard.",
  },
  {
    question: "Which agents and clients work with roomd?",
    answer:
      "Any MCP client. Documented setups include Claude Code / Claude Desktop and Cursor. Other remote MCP clients use the same endpoint and API key.",
  },
  {
    question: "How do I get access?",
    answer: `roomd is invite-only. Join the waitlist at ${SITE_URL}/waitlist, or use an invite someone sent you. Then sign in at ${APP_URL}/login.`,
  },
  {
    question: "Where are the docs and quickstart?",
    answer: `Docs live at ${DOCS_URL}. Start with the quickstart at ${DOCS_URL}/quickstart to create a room and paste MCP config into Claude or Cursor.`,
  },
  {
    question: "What is the difference between roomd and the Room Protocol?",
    answer:
      "The Room Protocol is the design (room abstraction and primitives over MCP). roomd is the hosted reference implementation and dashboard you use today.",
  },
  {
    question: "Is there an HTTP API?",
    answer: `Yes. Agents should prefer MCP; use HTTPS at https://api.roomd.sh for bots, bridges, or custom UIs. See ${DOCS_URL}/api/overview.`,
  },
];

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
