import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const SECRET = "sk-live-a3x1b2c3d4e5f6g7h8i9j0k1l2m3n4o5";

describe("encryptSecret", () => {
  it("round-trips through decryptSecret", () => {
    expect(decryptSecret(encryptSecret(SECRET))).toBe(SECRET);
  });

  it("never leaves the plaintext in the stored value", () => {
    const stored = encryptSecret(SECRET);
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain(SECRET.slice(0, 12));
  });

  it("produces a different ciphertext each time, so equal keys are not linkable", () => {
    expect(encryptSecret(SECRET)).not.toBe(encryptSecret(SECRET));
  });

  it("tags the value with a version so the format can change later", () => {
    expect(encryptSecret(SECRET).startsWith("v1.")).toBe(true);
  });

  it("handles an empty string", () => {
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });
});

describe("decryptSecret", () => {
  it("rejects a tampered ciphertext rather than returning garbage", () => {
    const stored = encryptSecret(SECRET);
    const [v, iv, tag, data] = stored.split(".");

    // Flip a bit in the decoded bytes. Editing the base64url text directly is
    // unreliable: the trailing character can carry padding bits, so a different
    // character may decode to the same byte and leave the ciphertext untouched.
    const bytes = Buffer.from(data, "base64url");
    bytes[0] ^= 0x01;

    expect(() =>
      decryptSecret([v, iv, tag, bytes.toString("base64url")].join("."))
    ).toThrow();
  });

  it("rejects a swapped auth tag", () => {
    const [v, iv, , data] = encryptSecret(SECRET).split(".");
    const otherTag = encryptSecret("different").split(".")[2];
    expect(() => decryptSecret([v, iv, otherTag, data].join("."))).toThrow();
  });

  it("throws on a malformed encrypted value", () => {
    expect(() => decryptSecret("v1.only-one-part")).toThrow("Malformed encrypted secret");
  });

  it("passes through an unprefixed legacy plaintext key unchanged", () => {
    // Records written before encryption existed must keep working.
    expect(decryptSecret(SECRET)).toBe(SECRET);
  });
});
