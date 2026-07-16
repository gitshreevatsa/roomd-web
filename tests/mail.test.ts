import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The mail module must never throw when SMTP is unconfigured (invites still
 * succeed and fall back to a copyable message), and must actually call the
 * transporter when it is configured. We mock nodemailer to assert both.
 */

const sendMail = vi.fn().mockResolvedValue({ messageId: "x" });
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
  createTransport: vi.fn(() => ({ sendMail })),
}));

const ENV = { ...process.env };

async function fresh() {
  vi.resetModules();
  return import("@/lib/mail");
}

beforeEach(() => {
  sendMail.mockClear();
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("mailEnabled", () => {
  it("is false without SMTP config", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const mail = await fresh();
    expect(mail.mailEnabled()).toBe(false);
  });

  it("is true with SMTP config", async () => {
    process.env.SMTP_HOST = "smtp.test";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    const mail = await fresh();
    expect(mail.mailEnabled()).toBe(true);
  });
});

describe("sendInviteEmail", () => {
  it("returns { sent: false } and does not throw when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    const mail = await fresh();
    const res = await mail.sendInviteEmail({
      to: "a@example.com",
      key: "sk-123",
      loginUrl: "https://app.roomd.sh/login",
    });
    expect(res.sent).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends the key and login link when SMTP is configured", async () => {
    process.env.SMTP_HOST = "smtp.test";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    process.env.SMTP_FROM = "roomd <invites@roomd.sh>";
    const mail = await fresh();

    const res = await mail.sendInviteEmail({
      to: "a@example.com",
      key: "sk-secret-123",
      loginUrl: "https://app.roomd.sh/login",
    });

    expect(res.sent).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toBe("a@example.com");
    expect(arg.from).toBe("roomd <invites@roomd.sh>");
    expect(arg.text).toContain("sk-secret-123");
    expect(arg.text).toContain("https://app.roomd.sh/login");
    expect(arg.html).toContain("Welcome to roomd");
    expect(arg.html).toContain("sk-secret-123");
    expect(arg.html).toContain("https://app.roomd.sh/login");
    expect(arg.html).toContain("#1a9e48");
  });

  it("reports { sent: false } if the transport throws, without raising", async () => {
    process.env.SMTP_HOST = "smtp.test";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    sendMail.mockRejectedValueOnce(new Error("connection refused"));
    const mail = await fresh();
    const res = await mail.sendInviteEmail({
      to: "a@example.com",
      key: "k",
      loginUrl: "https://x/login",
    });
    expect(res.sent).toBe(false);
  });
});
