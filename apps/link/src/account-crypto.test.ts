import { describe, expect, it } from "vitest";

import {
  createAccountCredential,
  decodeBase64Url,
  deriveAuthVerifier,
  unlockAccount,
} from "@kleavox/crypto";

describe("zero-knowledge account credential", () => {
  it("unlock reproduces the verifier and recovers a usable private key", async () => {
    const password = "correct horse battery staple";
    const credential = await createAccountCredential(password);

    expect(credential.authVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(credential.salt).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(credential.accountPublicKey).toMatch(/^[A-Za-z0-9_-]+$/);

    const unlocked = await unlockAccount(
      password,
      credential.salt,
      credential.wrappedPrivateKey,
    );
    expect(unlocked.authVerifier).toBe(credential.authVerifier);

    const publicKey = await crypto.subtle.importKey(
      "raw",
      decodeBase64Url(credential.accountPublicKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const shared = await crypto.subtle.deriveBits(
      { name: "ECDH", public: publicKey },
      unlocked.privateKey,
      256,
    );
    expect(shared.byteLength).toBe(32);
  });

  it("deriveAuthVerifier reproduces the credential verifier for the same salt", async () => {
    const password = "login password";
    const credential = await createAccountCredential(password);
    await expect(deriveAuthVerifier(password, credential.salt)).resolves.toBe(
      credential.authVerifier,
    );
    await expect(
      deriveAuthVerifier("other password", credential.salt),
    ).resolves.not.toBe(credential.authVerifier);
  });

  it("a wrong password cannot reproduce the verifier or unwrap the key", async () => {
    const credential = await createAccountCredential("right password");
    const sameSalt = await unlockAccount(
      "wrong password",
      credential.salt,
      credential.wrappedPrivateKey,
    ).catch(() => null);
    expect(sameSalt).toBeNull();
  });
});
