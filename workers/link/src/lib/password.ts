import {
  hashPassword as rustHashPassword,
  verifyPassword as rustVerifyPassword,
} from "@kleavox/crypto";

export async function hashLinkPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return rustHashPassword(password, toBase64Url(salt));
}

export async function verifyLinkPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  if (encoded.startsWith("pbkdf2-sha256$")) {
    return verifyLegacyPassword(password, encoded);
  }
  try {
    return await rustVerifyPassword(password, encoded);
  } catch {
    return false;
  }
}

async function verifyLegacyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, iterationText, saltText, hashText] = encoded.split("$");
  const iterations = Number(iterationText);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isSafeInteger(iterations) ||
    !saltText ||
    !hashText
  ) {
    return false;
  }

  const expected = fromBase64Url(hashText);
  const actual = await derive(password, fromBase64Url(saltText), iterations);
  return timingSafeEqual(actual, expected);
}

const KEY_LENGTH = 32;

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const saltBuffer = new Uint8Array(salt).buffer;
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    KEY_LENGTH * 8,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function toBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
