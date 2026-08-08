import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Minimal TOTP (RFC 6238) for operator portal MFA.
 * Secret stored as hex on the user record (`totpSecret`).
 * Enforce when `OPERATOR_MFA_REQUIRED=true`.
 */

const STEP = 30;
const DIGITS = 6;

function hotp(key: Buffer, counter: bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const mac = createHmac("sha1", key).update(buf).digest();
  const offset = mac[mac.length - 1]! & 0xf;
  const code =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotpSecret(): string {
  return randomBytes(20).toString("hex");
}

export function verifyTotp(secretHex: string, token: string, window = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const key = Buffer.from(secretHex, "hex");
  const now = BigInt(Math.floor(Date.now() / 1000 / STEP));
  const expected = Buffer.from(token);
  for (let w = -window; w <= window; w++) {
    const code = Buffer.from(hotp(key, now + BigInt(w)));
    if (code.length === expected.length && timingSafeEqual(code, expected)) return true;
  }
  return false;
}

export function totpUri(secretHex: string, email: string, issuer = "roomd"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secretHex}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function operatorMfaRequired(): boolean {
  return process.env.OPERATOR_MFA_REQUIRED === "true";
}
