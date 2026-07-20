import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto", () => {
  it("round-trips a value", () => {
    expect(decrypt(encrypt("access-sandbox-abc123"))).toBe("access-sandbox-abc123");
  });

  it("ciphertext is not the plaintext", () => {
    const enc = encrypt("secret-token");
    expect(enc).not.toContain("secret-token");
  });

  it("uses a random IV so repeats differ", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext", () => {
    const enc = encrypt("tok");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A");
    expect(() => decrypt(tampered)).toThrow();
  });
});
