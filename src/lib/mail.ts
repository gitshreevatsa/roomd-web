import nodemailer, { type Transporter } from "nodemailer";
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
 *   SMTP_SECURE    "true" to use TLS on connect (port 465); default false (STARTTLS)
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
}

/** Send one email. Never throws for a missing config; returns { sent: false }. */
export async function sendMail({ to, subject, text, html }: SendArgs): Promise<MailResult> {
  const tx = transporter();
  if (!tx) return { sent: false, reason: "SMTP not configured" };

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  try {
    await tx.sendMail({ from, to, subject, text, html: html ?? textToHtml(text) });
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
    `${scope} Keep the key somewhere safe.`;

  const html = buildInviteEmailHtml({ key, loginUrl, who, scope });

  return sendMail({ to, subject: "Your roomd invite", text, html });
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
