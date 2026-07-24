import { readFile } from "node:fs/promises";
import { initCrypto } from "@kleavox/crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { hashLinkPassword, verifyLinkPassword } from "./password";

beforeAll(async () => {
  const wasm = await readFile(
    new URL(
      "../../../../packages/crypto/pkg/kleavox_crypto_bg.wasm",
      import.meta.url,
    ),
  );
  await initCrypto(new Uint8Array(wasm).slice().buffer);
});

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
