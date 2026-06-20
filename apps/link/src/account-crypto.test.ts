import { describe, expect, it } from "vitest";

import {
  createAccountCredential,
  decodeBase64Url,
  deriveLoginKeys,
  encodeBase64Url,
  sealToPublicKey,
  unlockAccount,
  unsealWithPrivateKey,
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

  it("deriveLoginKeys reproduces the credential verifier for the same salt", async () => {
    const password = "login password";
    const credential = await createAccountCredential(password);
    const keys = await deriveLoginKeys(password, credential.salt);
    expect(keys.authVerifier).toBe(credential.authVerifier);
    const other = await deriveLoginKeys("other password", credential.salt);
    expect(other.authVerifier).not.toBe(credential.authVerifier);
  });

  it("seals a key to a public key that only the matching private key opens", async () => {
    const recipient = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const recipientPublicKey = encodeBase64Url(
      new Uint8Array(await crypto.subtle.exportKey("raw", recipient.publicKey)),
    );
    const fileKey = crypto.getRandomValues(new Uint8Array(32));

    const sealed = await sealToPublicKey(fileKey, recipientPublicKey);
    const opened = await unsealWithPrivateKey(sealed, recipient.privateKey);
    expect(Array.from(opened)).toEqual(Array.from(fileKey));

    const intruder = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    await expect(
      unsealWithPrivateKey(sealed, intruder.privateKey),
    ).rejects.toBeDefined();
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
