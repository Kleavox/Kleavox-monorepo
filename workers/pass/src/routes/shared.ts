import { isReservedSlug } from "@kleavox/core";
import type { Identity } from "@kleavox/core";
import type { Context, Hono } from "hono";
import { z } from "zod";

import type { Env } from "../env";
import { writeAuditEvent } from "../lib/audit";
import { hashAuthVerifier, hashToken, randomToken } from "../lib/crypto";
import type { OAuthProfile, OAuthProvider } from "../lib/oauth";
import { getSession, readSessionToken } from "../lib/session";

export type AppEnv = { Bindings: Env };
type AppContext = Context<AppEnv>;
export type PassApp = Hono<AppEnv>;

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  role: "ADMIN" | "USER";
  email_verified_at: string | null;
  auth_version: number;
  disabled_at: string | null;
  identity_id: string | null;
  password_hash: string | null;
}

interface AccountKeysRow {
  kdf_salt: string;
  auth_verifier_hash: string;
  account_public_key: string;
  wrapped_private_key: string;
}

export interface AccountKeyCredential {
  salt: string;
  authVerifier: string;
  accountPublicKey: string;
  wrappedPrivateKey: string;
}

export interface VerificationRecord {
  scope: "basic" | "fresh";
  issuedAt: number;
  expiresAt: number;
  ip: string;
}

export interface TokenRow {
  id: string;
  user_id: string;
  email: string;
  username: string | null;
  expires_at: string;
  auth_version: number;
}

export const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
export const OAUTH_LINK_TTL_SECONDS = 15 * 60;

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform(normalizeEmail);
const tokenSchema = z.string().min(32).max(256);
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/u,
    "Username must be 3-20 lowercase letters, digits, or underscores.",
  )
  .refine((value) => !isReservedSlug(value), "This username is reserved.");

const accountKeysSchema = z.object({
  salt: z.string().min(16).max(128),
  authVerifier: z.string().min(40).max(128),
  accountPublicKey: z.string().min(40).max(512),
  wrappedPrivateKey: z.string().min(40).max(512),
});

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  keys: accountKeysSchema,
});

export const preloginSchema = z.object({ email: emailSchema });

export const loginSchema = z.object({
  email: emailSchema,
  authVerifier: z.string().min(40).max(128),
});

export const emailActionSchema = z.object({
  email: emailSchema,
});

export const tokenActionSchema = z.object({
  token: tokenSchema,
});

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  keys: accountKeysSchema,
});

export const challengeSchema = z.object({
  token: z.string().min(1).max(4096),
  scope: z.enum(["basic", "fresh"]),
  returnTo: z.string().max(2048).optional(),
});

export const accountUpdateSchema = z.object({
  username: usernameSchema,
});

export const accountSetupSchema = z.object({
  username: usernameSchema,
  keys: accountKeysSchema.optional(),
});

export const oauthLinkSchema = z.object({
  token: tokenSchema,
});

export const accountPasswordSchema = z.object({
  keys: accountKeysSchema,
});

export const accountDeleteSchema = z.object({
  confirmEmail: emailSchema,
});

export function apiError(
  context: AppContext,
  status: 400 | 401 | 403 | 404 | 409 | 415 | 429 | 500 | 502 | 503,
  code: string,
  message: string,
) {
  return context.json({ code, message }, status);
}

function normalizeEmail(value: string): string {
  return value.toLowerCase();
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}

export function sessionClient(request: Request) {
  return {
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("cf-connecting-ip"),
  };
}

export async function usernameTakenBy(
  env: Env,
  username: string,
  excludingUserId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1`,
  )
    .bind(username, excludingUserId)
    .first<{ id: string }>();
  return row !== null;
}

export async function currentSession(context: AppContext) {
  const token = readSessionToken(context.req.raw);
  return token ? await getSession(context.env, token) : null;
}

export async function checkVerification(
  env: Env,
  token: string | null,
  scope: "basic" | "fresh",
): Promise<boolean> {
  if (!token) return false;

  const record = await env.SESSIONS.get<VerificationRecord>(
    `verification:${await hashToken(token)}`,
    "json",
  );
  if (!record || record.expiresAt <= Date.now()) return false;

  return record.scope === "fresh" || record.scope === scope;
}

export function toIdentity(user: UserRow): Identity {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };
}

export async function findUserByEmail(
  env: Env,
  email: string,
): Promise<UserRow | null> {
  return env.DB.prepare(
    `SELECT u.id, u.email, u.username, u.role, u.email_verified_at,
            u.auth_version, u.disabled_at, i.id AS identity_id,
            i.password_hash
     FROM users u
     LEFT JOIN identities i
       ON i.user_id = u.id AND i.provider = 'password'
     WHERE lower(u.email) = ?
     LIMIT 1`,
  )
    .bind(email)
    .first<UserRow>();
}

export async function findAccountKeys(
  env: Env,
  userId: string,
): Promise<AccountKeysRow | null> {
  return env.DB.prepare(
    `SELECT kdf_salt, auth_verifier_hash, account_public_key,
            wrapped_private_key
     FROM account_keys WHERE user_id = ?`,
  )
    .bind(userId)
    .first<AccountKeysRow>();
}

export async function storeAccountKeys(
  env: Env,
  userId: string,
  keys: AccountKeyCredential,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO account_keys
       (user_id, kdf_salt, auth_verifier_hash, account_public_key,
        wrapped_private_key)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       kdf_salt = excluded.kdf_salt,
       auth_verifier_hash = excluded.auth_verifier_hash,
       account_public_key = excluded.account_public_key,
       wrapped_private_key = excluded.wrapped_private_key,
       updated_at = datetime('now')`,
  )
    .bind(
      userId,
      keys.salt,
      await hashAuthVerifier(keys.authVerifier),
      keys.accountPublicKey,
      keys.wrappedPrivateKey,
    )
    .run();
}

type OAuthResolution =
  | { kind: "user"; user: UserRow }
  | { kind: "link_required"; existing: UserRow };

export async function resolveOAuthUser(
  env: Env,
  profile: OAuthProfile,
): Promise<OAuthResolution> {
  const linked = await env.DB.prepare(
    `SELECT u.id, u.email, u.username, u.role, u.email_verified_at,
            u.auth_version, u.disabled_at, i.id AS identity_id,
            i.password_hash
     FROM identities i
     JOIN users u ON u.id = i.user_id
     WHERE i.provider = ? AND i.provider_subject = ?
     LIMIT 1`,
  )
    .bind(profile.provider, profile.subject)
    .first<UserRow>();
  if (linked) return { kind: "user", user: linked };

  const existing = await findUserByEmail(env, profile.email);
  if (existing) {
    return { kind: "link_required", existing };
  }

  const userId = crypto.randomUUID();
  const identityId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, email_verified_at)
       VALUES (?, ?, datetime('now'))`,
    ).bind(userId, profile.email),
    env.DB.prepare(
      `INSERT INTO identities
       (id, user_id, provider, provider_subject, password_hash)
       VALUES (?, ?, ?, ?, NULL)`,
    ).bind(identityId, userId, profile.provider, profile.subject),
  ]);

  return {
    kind: "user",
    user: {
      id: userId,
      email: profile.email,
      username: null,
      role: "USER",
      email_verified_at: new Date().toISOString(),
      auth_version: 1,
      disabled_at: null,
      identity_id: identityId,
      password_hash: null,
    },
  };
}

export function oauthProvider(value: string): OAuthProvider | null {
  return value === "google" || value === "github" ? value : null;
}

export async function createVerificationToken(
  _purpose: "EMAIL" | "PASSWORD_RESET",
  ttlMs: number,
): Promise<{ id: string; raw: string; hash: string; expiresAt: string }> {
  const raw = randomToken();
  return {
    id: crypto.randomUUID(),
    raw,
    hash: await hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export function genericEmailResponse(context: AppContext) {
  return context.json({
    ok: true,
    message: "If the account is eligible, an email has been sent.",
  });
}

export function rateLimitError(context: AppContext, retryAfter: number) {
  context.header("Retry-After", retryAfter.toString());
  return apiError(
    context,
    429,
    "rate_limited",
    "Too many requests. Try again later.",
  );
}

export async function safeAudit(
  env: Env,
  event: Parameters<typeof writeAuditEvent>[1],
): Promise<void> {
  try {
    await writeAuditEvent(env, event);
  } catch (cause) {
    console.error("[pass audit]", cause);
  }
}
