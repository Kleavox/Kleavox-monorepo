import { describe, expect, it } from "vitest";

import {
  createDownloadGrant,
  hashPassword,
  sha256,
  verifyDownloadGrant,
  verifyPassword,
} from "./crypto";

describe("Drop cryptography", () => {
  it("hashes tokens deterministically without storing the source token", async () => {
    expect(await sha256("drop-token")).toBe(await sha256("drop-token"));
    expect(await sha256("drop-token")).not.toContain("drop-token");
  });

  it("accepts only the original password", async () => {
    const encoded = await hashPassword(
      "correct horse battery staple",
      "password-secret",
    );
    expect(
      await verifyPassword(
        "correct horse battery staple",
        encoded,
        "password-secret",
      ),
    ).toBe(true);
    expect(
      await verifyPassword("incorrect password", encoded, "password-secret"),
    ).toBe(false);
    expect(
      await verifyPassword(
        "correct horse battery staple",
        encoded,
        "different-secret",
      ),
    ).toBe(false);
  });

  it("scopes short-lived grants to a single drop", async () => {
    const grant = await createDownloadGrant("drop-a", "secret", 60);
    expect(await verifyDownloadGrant(grant, "drop-a", "secret")).toBe(true);
    expect(await verifyDownloadGrant(grant, "drop-b", "secret")).toBe(false);
    expect(await verifyDownloadGrant(grant, "drop-a", "wrong")).toBe(false);
  });
});
