import { describe, expect, it } from "vitest";

import {
  dropKeyFromHash,
  dropKeyStorageKey,
  encryptedShareUrl,
  generateDropKey,
} from "./e2e";

describe("drop end-to-end key plumbing", () => {
  it("generates a 256-bit url-safe key", () => {
    const key = generateDropKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateDropKey()).not.toBe(key);
  });

  it("round-trips the key through the share-link fragment", () => {
    const key = generateDropKey();
    const url = encryptedShareUrl("https://kleavox.xyz/abc123", key);
    expect(url).toBe(`https://kleavox.xyz/abc123#${key}`);
    expect(dropKeyFromHash(new URL(url).hash)).toBe(key);
  });

  it("treats a missing fragment as an empty key", () => {
    expect(dropKeyFromHash("")).toBe("");
    expect(dropKeyFromHash("#")).toBe("");
  });

  it("namespaces the local key cache by public token", () => {
    expect(dropKeyStorageKey("abc123")).toBe("kleavox_drop_key:abc123");
  });
});
