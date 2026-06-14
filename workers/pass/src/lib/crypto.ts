import {
  decodeBase64Url,
  encodeBase64Url,
  hashPassword as rustHashPassword,
  timingSafeEqual,
  verifyPassword as rustVerifyPassword,
} from "@kleavox/crypto";

export { randomToken, sha256Base64Url as hashToken } from "@kleavox/crypto";

const encoder = new TextEncoder();
const PASSWORD_SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(PASSWORD_SALT_BYTES);
  crypto.getRandomValues(salt);
  return rustHashPassword(password, encodeBase64Url(salt));
}

export async function verifyPassword(
  encoded: string,
  password: string,
): Promise<boolean> {
  if (encoded.startsWith("pbkdf2-sha256$")) {
    return verifyLegacyPassword(encoded, password);
  }
  try {
    const result = await rustVerifyPassword(password, encoded);
    return result;
  } catch {
    return false;
  }
}

async function verifyLegacyPassword(
  encoded: string,
  password: string,
): Promise<boolean> {
  const [algorithm, iterationsValue, saltValue, hashValue] = encoded.split("$");
  const iterations = Number(iterationsValue);

  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isSafeInteger(iterations) ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }

  try {
    const expected = decodeBase64Url(hashValue);
    const actual = await derivePBKDF2(
      password,
      decodeBase64Url(saltValue),
      iterations,
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function derivePBKDF2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const saltBuffer = salt.slice().buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBuffer,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
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
