import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
  it("produces a salted scrypt hash, not a bare digest", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const [scheme, salt, digest] = hash.split("$");

    expect(scheme).toBe("scrypt");
    expect(salt).toHaveLength(32); // 16 bytes, hex
    expect(digest).toHaveLength(128); // 64 bytes, hex
  });

  it("gives two users with the same password different hashes", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("never stores the password itself", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).not.toContain("hunter2");
  });
});

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPassword("s3cret-password", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPassword("s3cret-passworD", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("rejects a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "scrypt$short$short")).toBe(false);
    expect(await verifyPassword("x", "sha256$aa$bb")).toBe(false);
  });

  it("rejects a legacy unsalted sha256 hash", async () => {
    // The old scheme was a bare sha256 hex digest with no scheme prefix.
    const legacy = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
    expect(await verifyPassword("123456", legacy)).toBe(false);
  });
});
