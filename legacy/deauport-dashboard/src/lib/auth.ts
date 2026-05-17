import { cookies } from "next/headers";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET!;
const PASS_SHA256 = (process.env.AUTH_PASS_SHA256 ?? "").toLowerCase();
const ADMIN_EMAIL = process.env.AUTH_ADMIN_EMAIL ?? "admin@example.com";
const TTL = process.env.AUTH_SESSION_TTL ?? "7d";

const COOKIE_NAME = "deauport.sid";

function msFromTTL(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  return u === "s" ? n * 1000 : u === "m" ? n * 60_000 : u === "h" ? n * 3_600_000 : n * 86_400_000;
}

function sign(data: string) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

export function makeToken(ttlMsOverride?: number): string {
  const exp = Date.now() + (ttlMsOverride ?? msFromTTL(TTL));
  const payload = JSON.stringify({ sub: "admin", exp });
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

export async function setSessionCookie(ttlMsOverride?: number) {
  const token = makeToken(ttlMsOverride);
  const maxAge = Math.floor(((ttlMsOverride ?? msFromTTL(TTL)) / 1000));
  (await cookies()).set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export function verifyToken(t: string | undefined | null): boolean {
  if (!t) return false;
  const [b64, sig] = t.split(".");
  if (!b64 || !sig) return false;
  if (sign(b64) !== sig) return false;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { exp: number };
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch { return false; }
}

export async function clearSessionCookie() {
  (await cookies()).set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function isAuthed(): Promise<boolean> {
  const c = (await cookies()).get(COOKIE_NAME)?.value;
  return verifyToken(c);
}

export function validPassword(passPlain: string): boolean {
  const sha = crypto.createHash("sha256").update(passPlain, "utf8").digest("hex").toLowerCase();
  const a = Buffer.from(sha);
  const b = Buffer.from(PASS_SHA256);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const adminEmail = ADMIN_EMAIL;