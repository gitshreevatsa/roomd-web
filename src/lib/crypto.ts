import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

/**
 * Envelope encryption for the roomd API key held in a user record.
 *
 * roomd stores only a digest of each key, so a dump of its own records
 * yields nothing usable. roomd-web cannot do the same: it has to present the
 * key as a bearer token, so it needs the plaintext. Since both live in the
 * same Redis, storing it raw would hand an attacker with a database dump a set
 * of live, team-wide credentials.
 *
 * Encrypting with a key derived from NEXTAUTH_SECRET means a dump alone is not
 * enough. The attacker also needs the application environment.
 *
 * Rotating NEXTAUTH_SECRET makes every stored key undecryptable. Users would
 * have to sign in with their API key again to repair their record.
 */

const VERSION = "v1";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to encrypt stored API keys");

  cachedKey = scryptSync(secret, "roomd-web:apikey:v1", KEY_LENGTH);
  return cachedKey;
}

/** Reset the derived key. Only needed by tests that change the env. */
export function resetEncryptionKey(): void {
  cachedKey = null;
}

/** Encrypt a secret for storage. Output is `v1.<iv>.<tag>.<ciphertext>`, base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt a stored secret.
 *
 * A value without the version prefix is a plaintext key written before this
 * existed, and is returned as is so old records keep working. They are
 * re-encrypted the next time the user record is written.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(`${VERSION}.`)) return stored;

  // Split by count, not truthiness: the ciphertext of an empty string is "".
  const parts = stored.split(".");
  if (parts.length !== 4) throw new Error("Malformed encrypted secret");
  const [, ivPart, tagPart, dataPart] = parts as [string, string, string, string];

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
