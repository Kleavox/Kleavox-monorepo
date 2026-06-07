const encoder = new TextEncoder();
const PASSWORD_ALGORITHM = "PBKDF2";
const PASSWORD_DIGEST = "SHA-256";
const PASSWORD_ITERATIONS = 600_000;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return encodeBase64Url(value);
}

export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function hashPassword(
  password: string,
  iterations = PASSWORD_ITERATIONS,
): Promise<string> {
  const salt = new Uint8Array(PASSWORD_SALT_BYTES);
  crypto.getRandomValues(salt);
  const derived = await derivePassword(password, salt, iterations);

  return [
    "pbkdf2-sha256",
    iterations.toString(),
    encodeBase64Url(salt),
    encodeBase64Url(derived),
  ].join("$");
}

export async function verifyPassword(
  encoded: string,
  password: string,
): Promise<boolean> {
  const [algorithm, iterationsValue, saltValue, hashValue] = encoded.split("$");
  const iterations = Number(iterationsValue);

  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }

  try {
    const expected = decodeBase64Url(hashValue);
    const actual = await derivePassword(
      password,
      decodeBase64Url(saltValue),
      iterations,
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function hashAuditIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return encodeBase64Url(new Uint8Array(signature));
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const saltBuffer = salt.slice().buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    PASSWORD_ALGORITHM,
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: PASSWORD_ALGORITHM,
      hash: PASSWORD_DIGEST,
      salt: saltBuffer,
      iterations,
    },
    key,
    PASSWORD_KEY_BYTES * 8,
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

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

