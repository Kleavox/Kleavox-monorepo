export function randomToken(bytes = 24): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toBase64Url(new Uint8Array(digest));
}

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
  const encoded = toBase64Url(new TextEncoder().encode(payload));
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
      new TextDecoder().decode(fromBase64Url(encoded)),
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
  return toBase64Url(new Uint8Array(signature));
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
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
