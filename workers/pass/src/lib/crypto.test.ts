import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, randomToken, verifyPassword } from "./crypto";

describe("password hashing", () => {
  it("verifies the original password and rejects another password", async () => {
    const encoded = await hashPassword("correct horse battery staple");

    await expect(
      verifyPassword(encoded, "correct horse battery staple"),
    ).resolves.toBe(true);
    await expect(verifyPassword(encoded, "incorrect password")).resolves.toBe(
      false,
    );
  });

  it("rejects malformed hashes", async () => {
    await expect(verifyPassword("not-a-hash", "password")).resolves.toBe(false);
  });
});

describe("tokens", () => {
  it("generates URL-safe random values and stable hashes", async () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    await expect(hashToken(token)).resolves.toBe(await hashToken(token));
  });
});
