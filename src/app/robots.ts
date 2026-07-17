import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const disallowApp = [
  "/dashboard",
  "/admin",
  "/owner",
  "/rooms",
  "/login",
  "/register",
  "/api/",
];

const allowMarketing = [
  "/",
  "/protocol",
  "/waitlist",
  "/faq",
  "/llms.txt",
  "/llms-full.txt",
];

/** Common AI / answer-engine crawlers — explicitly allowed for GEO. */
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: allowMarketing,
        disallow: disallowApp,
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: allowMarketing,
        disallow: disallowApp,
      })),
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, "https://www.roomd.sh/sitemap.xml"],
    host: SITE_URL,
  };
}
