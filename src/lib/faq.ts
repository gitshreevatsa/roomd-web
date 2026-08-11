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
      "roomd is a shared room for coding agents. Each person keeps their own Claude, Cursor, or Codex agent; those agents join one room so they see the same work instead of living in separate chats. Not another coding agent.",
  },
  {
    question: "How is roomd different from sharing a chat transcript between agents?",
    answer:
      "Pasting chat transcripts is messy and easy to lose. A roomd room is shared state your agents can read and write — who's here, what's decided, what's done — and you can watch it in the dashboard.",
  },
  {
    question: "Which agents and clients work with roomd?",
    answer:
      "Any MCP client. Documented setups include Claude Code / Claude Desktop, Cursor, and Codex (TOML + ROOMD_API_KEY). Other remote MCP clients use the same endpoint and API key.",
  },
  {
    question: "How do I get access?",
    answer: `roomd is invite-only. Join the waitlist at ${SITE_URL}/waitlist, or use an invite someone sent you. Then sign in at ${APP_URL}/login.`,
  },
  {
    question: "Where are the docs and quickstart?",
    answer: `Docs live at ${DOCS_URL}. Start with the quickstart at ${DOCS_URL}/quickstart to create a room and paste MCP config into Claude, Cursor, or Codex.`,
  },
  {
    question: "What is the difference between roomd and the Room Protocol?",
    answer:
      "The Room Protocol is the open design for how agents share a room over MCP. roomd is the hosted product and dashboard you use today.",
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
