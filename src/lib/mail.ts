import nodemailer, { type Transporter } from "nodemailer";
import { createHash, randomBytes } from "crypto";
import { buildInviteEmailHtml } from "@/lib/email/invite-template";

/**
 * Outbound email via SMTP (nodemailer).
 *
 * Configured entirely by env, so the same code runs locally (unconfigured, a
 * no-op) and in production (configured, sends). When SMTP is not set up,
 * `sendInviteEmail` returns { sent: false } instead of throwing, so an invite
 * still succeeds and the operator can fall back to copying the message by hand.
 *
 *   SMTP_HOST      smtp.example.com
 *   SMTP_PORT      587
 *   SMTP_USER      apikey / username
 *   SMTP_PASS      secret
 *   SMTP_FROM      "roomd <invites@roomd.sh>"
 *   SMTP_REPLY_TO  optional; defaults to SMTP_FROM
 *   SMTP_SECURE    "true" to use TLS on connect (port 465); default false (STARTTLS)
 *
 * Deliverability: SMTP_FROM must use a domain with SPF/DKIM/DMARC aligned to
 * the sending provider (e.g. Resend). Do not send as @roomd.sh through Gmail.
 */

let cached: Transporter | null | undefined;

function transporter(): Transporter | null {
  if (cached !== undefined) return cached;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cached = null;
    return null;
  }

  cached = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  return cached;
}

/** Reset the cached transporter. Only needed by tests that mutate the env. */
export function resetMailer(): void {
  cached = undefined;
}

/** True when SMTP is configured, so the UI can show "we'll email them" vs "copy this". */
export function mailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export interface MailResult {
  sent: boolean;
  reason?: string;
}

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Used for List-Unsubscribe / Message-ID domain. */
  loginUrl?: string;
}

function fromDomain(from: string): string {
  const match = from.match(/@([^>\s]+)/);
  return match?.[1] ?? "roomd.sh";
}

/** Send one email. Never throws for a missing config; returns { sent: false }. */
export async function sendMail({ to, subject, text, html, loginUrl }: SendArgs): Promise<MailResult> {
  const tx = transporter();
  if (!tx) return { sent: false, reason: "SMTP not configured" };

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  const replyTo = process.env.SMTP_REPLY_TO ?? from;
  const site = process.env.NEXTAUTH_URL ?? "https://app.roomd.sh";
  const unsub = loginUrl ?? `${site}/login`;
  const domain = fromDomain(from);
  const messageId = `<${randomBytes(12).toString("hex")}.${Date.now()}@${domain}>`;

  try {
    await tx.sendMail({
      from,
      to,
      replyTo,
      subject,
      text,
      html: html ?? textToHtml(text),
      messageId,
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "X-Entity-Ref-ID": createHash("sha256").update(`${to}:${subject}:${Date.now()}`).digest("hex").slice(0, 32),
        "List-Unsubscribe": `<${unsub}>`,
        Precedence: "bulk",
      },
    });
    return { sent: true };
  } catch (err) {
    console.error("[mail]", err instanceof Error ? err.message : err);
    return { sent: false, reason: "send failed" };
  }
}

/**
 * Compose and send an invite email carrying a sign-in key.
 * Used both when the operator invites an org and when an org invites a teammate.
 */
export async function sendInviteEmail(args: {
  to: string;
  key: string;
  loginUrl: string;
  invitedBy?: string;
  context?: "workspace" | "team";
}): Promise<MailResult> {
  const { to, key, loginUrl, invitedBy, context = "workspace" } = args;
  const who = invitedBy ? `${invitedBy} invited you` : "You have been invited";
  const scope =
    context === "team"
      ? "You will join their team and can work in their rooms."
      : "You get a team workspace and can create rooms.";

  const text =
    `${who} to roomd.\n\n` +
    `Sign in at ${loginUrl} with this key:\n\n${key}\n\n` +
    `${scope} Keep the key somewhere safe.\n\n` +
    `— roomd (https://roomd.sh)`;

  const html = buildInviteEmailHtml({ key, loginUrl, who, scope });

  // Transactional wording — marketing-style subjects land in spam more often.
  return sendMail({
    to,
    subject: "roomd access key",
    text,
    html,
    loginUrl,
  });
}

function textToHtml(text: string): string {
  return text
    .split("\n\n")
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
