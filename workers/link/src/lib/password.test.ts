import { describe, expect, it } from "vitest";

import { hashLinkPassword, verifyLinkPassword } from "./password";

describe("Link passwords", () => {
  it("verifies only the original password", async () => {
    const hash = await hashLinkPassword("a-strong-link-password");
    await expect(
      verifyLinkPassword("a-strong-link-password", hash),
    ).resolves.toBe(true);
    await expect(verifyLinkPassword("another-password", hash)).resolves.toBe(
      false,
    );
  });

  it("rejects malformed hashes", async () => {
    await expect(verifyLinkPassword("password", "invalid")).resolves.toBe(
      false,
    );
  });
});
