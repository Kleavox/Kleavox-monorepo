import {
  decodeBase64Url,
  encodeBase64Url,
  randomToken,
  sha256Base64Url,
  timingSafeEqual,
} from "@kleavox/crypto";

export { randomToken, sha256Base64Url as sha256 };

export function readBearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export async function hashPassword(
  password: string,
  secret: string,
): Promise<string> {
  return `hmac-sha256$${await sign(password, secret)}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
  secret: string,
): Promise<boolean> {
  const [algorithm, expectedText] = encoded.split("$");
  if (algorithm !== "hmac-sha256" || !expectedText) return false;
  const actualText = await sign(password, secret);
  return timingSafeEqual(
    new TextEncoder().encode(actualText),
    new TextEncoder().encode(expectedText),
  );
}

export async function actorHash(
  secret: string,
  request: Request,
): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 160);
  return sign(`${ip}|${userAgent}`, secret);
}

export async function createDownloadGrant(
  dropId: string,
  secret: string,
  ttlSeconds = 300,
): Promise<string> {
  const payload = JSON.stringify({
    dropId,
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: randomToken(8),
  });
  const encoded = encodeBase64Url(new TextEncoder().encode(payload));
  return `${encoded}.${await sign(encoded, secret)}`;
}

export async function verifyDownloadGrant(
  token: string,
  dropId: string,
  secret: string,
): Promise<boolean> {
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = await sign(encoded, secret);
  if (
    !timingSafeEqual(
      new TextEncoder().encode(signature),
      new TextEncoder().encode(expected),
    )
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encoded)),
    ) as { dropId?: string; expiresAt?: number };
    return (
      payload.dropId === dropId &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt >= Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return encodeBase64Url(new Uint8Array(signature));
}
