import type { Env } from "../env";
import { hashToken, verifyAuthVerifier } from "./crypto";

const TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;

interface OtpRecord {
  codeHash: string;
  attempts: number;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function secretFor(email: string, code: string): string {
  return `${normalize(email)}:${code}`;
}

async function keyFor(email: string): Promise<string> {
  return `otp:${await hashToken(normalize(email))}`;
}

export async function issueOtp(env: Env, email: string): Promise<string> {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0]! % 1000000;
  const code = String(digits).padStart(6, "0");
  const record: OtpRecord = {
    codeHash: await hashToken(secretFor(email, code)),
    attempts: 0,
  };
  await env.SESSIONS.put(await keyFor(email), JSON.stringify(record), {
    expirationTtl: TTL_SECONDS,
  });
  return code;
}

export interface OtpVerification {
  status: "ok" | "wrong" | "expired" | "exhausted";
  attemptsLeft?: number;
}

export async function verifyOtp(
  env: Env,
  email: string,
  code: string,
): Promise<OtpVerification> {
  const key = await keyFor(email);
  const raw = await env.SESSIONS.get(key);
  if (!raw) return { status: "expired" };

  const record = JSON.parse(raw) as OtpRecord;
  if (record.attempts >= MAX_ATTEMPTS) return { status: "exhausted" };

  if (await verifyAuthVerifier(secretFor(email, code), record.codeHash)) {
    await env.SESSIONS.delete(key);
    return { status: "ok" };
  }

  const next: OtpRecord = { ...record, attempts: record.attempts + 1 };
  await env.SESSIONS.put(key, JSON.stringify(next), {
    expirationTtl: TTL_SECONDS,
  });
  const attemptsLeft = MAX_ATTEMPTS - next.attempts;
  return attemptsLeft <= 0
    ? { status: "exhausted" }
    : { status: "wrong", attemptsLeft };
}
