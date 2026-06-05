import type { Identity } from "@zarkiv/core";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Env } from "./env";
import { writeAuditEvent } from "./lib/audit";
import { clearSessionCookie, makeSessionCookie } from "./lib/cookies";
import {
  hashPassword,
  hashToken,
  randomToken,
  verifyPassword,
} from "./lib/crypto";
import { sendPasswordResetEmail, sendVerificationEmail } from "./lib/mail";
import { rateLimit } from "./lib/rate-limit";
import {
  createSession,
  deleteSession,
  getSession,
  invalidateUserSessions,
  readSessionToken,
} from "./lib/session";
import { verifyTurnstile } from "./lib/turnstile";

type AppEnv = { Bindings: Env };
type AppContext = Context<AppEnv>;

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  email_verified_at: string | null;
  auth_version: number;
  disabled_at: string | null;
  identity_id: string | null;
  password_hash: string | null;
}

interface TokenRow {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  expires_at: string;
  auth_version: number;
}

const DUMMY_PASSWORD_HASH =
  "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform(normalizeEmail);
const passwordSchema = z.string().min(12).max(128);
const tokenSchema = z.string().min(32).max(256);

const registerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(80),
  password: passwordSchema,
  turnstileToken: z.string().max(4096).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const emailActionSchema = z.object({
  email: emailSchema,
  turnstileToken: z.string().max(4096).optional(),
});

const tokenActionSchema = z.object({
  token: tokenSchema,
});

const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

const app = new Hono<AppEnv>();

app.onError((cause, context) => {
  console.error("[pass]", cause);
  return context.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    500,
  );
});

app.use("*", async (context, next) => {
  await next();
  context.header("Referrer-Policy", "same-origin");
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
});

app.use("/api/*", async (context, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(context.req.method)) {
    return next();
  }

  const contentType = context.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return apiError(
      context,
      415,
      "unsupported_media_type",
      "Use application/json.",
    );
  }

  const origin = context.req.header("origin");
  const requestOrigin = new URL(context.req.url).origin;
  const trustedOrigins = new Set([context.env.PUBLIC_ORIGIN, requestOrigin]);
  if (
    (origin && !trustedOrigins.has(origin)) ||
    (!origin && context.env.ENVIRONMENT === "production")
  ) {
    return apiError(context, 403, "invalid_origin", "Request origin rejected.");
  }

  return next();
});

app.get("/health", (context) =>
  context.json({ service: "pass", status: "ok" }),
);

app.post("/api/register", async (context) => {
  const body = registerSchema.safeParse(await context.req.json());
  if (!body.success) {
    return apiError(context, 400, "invalid_input", firstIssue(body.error));
  }

  const ip = clientIp(context.req.raw);
  const ipLimit = await rateLimit(context.env, "register-ip", ip, 5, 3600);
  const emailLimit = await rateLimit(
    context.env,
    "register-email",
    body.data.email,
    3,
    3600,
  );
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return rateLimitError(
      context,
      Math.max(ipLimit.retryAfter, emailLimit.retryAfter),
    );
  }

  if (!(await verifyTurnstile(context.env, body.data.turnstileToken, ip))) {
    return apiError(
      context,
      400,
      "challenge_failed",
      "Security challenge failed.",
    );
  }

  const existing = await findUserByEmail(context.env, body.data.email);
  if (existing?.email_verified_at) {
    return apiError(
      context,
      409,
      "account_exists",
      "An account already exists for this email.",
    );
  }

  const userId = existing?.id ?? crypto.randomUUID();
  const identityId = existing?.identity_id ?? crypto.randomUUID();
  const passwordHash = await hashPassword(body.data.password);
  const verification = await createVerificationToken(
    "EMAIL",
    EMAIL_VERIFICATION_TTL_MS,
  );

  const statements: D1PreparedStatement[] = [];
  if (existing) {
    statements.push(
      context.env.DB.prepare(
        `UPDATE users
         SET name = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).bind(body.data.name, userId),
    );
    if (existing.identity_id) {
      statements.push(
        context.env.DB.prepare(
          `UPDATE identities
           SET password_hash = ?, provider_subject = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
        ).bind(passwordHash, body.data.email, identityId),
      );
    } else {
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO identities (
             id, user_id, provider, provider_subject, password_hash
           ) VALUES (?, ?, 'password', ?, ?)`,
        ).bind(identityId, userId, body.data.email, passwordHash),
      );
    }
  } else {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO users (id, email, name)
         VALUES (?, ?, ?)`,
      ).bind(userId, body.data.email, body.data.name),
      context.env.DB.prepare(
        `INSERT INTO identities (
           id, user_id, provider, provider_subject, password_hash
         ) VALUES (?, ?, 'password', ?, ?)`,
      ).bind(identityId, userId, body.data.email, passwordHash),
    );
  }

  statements.push(
    context.env.DB.prepare(
      `DELETE FROM verification_tokens
       WHERE user_id = ? AND purpose = 'EMAIL' AND consumed_at IS NULL`,
    ).bind(userId),
    context.env.DB.prepare(
      `INSERT INTO verification_tokens (
         id, user_id, purpose, token_hash, expires_at
       ) VALUES (?, ?, 'EMAIL', ?, ?)`,
    ).bind(verification.id, userId, verification.hash, verification.expiresAt),
  );

  await context.env.DB.batch(statements);
  await sendVerificationEmail(
    context.env,
    body.data.email,
    body.data.name,
    verification.raw,
  );
  await safeAudit(context.env, {
    userId,
    type: existing ? "registration_restarted" : "registration_created",
    request: context.req.raw,
  });

  return context.json(
    {
      ok: true,
      message: "Check your email to verify the account.",
    },
    201,
  );
});

app.post("/api/verification/resend", async (context) => {
  const body = emailActionSchema.safeParse(await context.req.json());
  if (!body.success) {
    return apiError(context, 400, "invalid_input", firstIssue(body.error));
  }

  const ip = clientIp(context.req.raw);
  const limit = await rateLimit(
    context.env,
    "verification-resend",
    `${ip}:${body.data.email}`,
    3,
    3600,
  );
  if (!limit.allowed) return rateLimitError(context, limit.retryAfter);

  if (!(await verifyTurnstile(context.env, body.data.turnstileToken, ip))) {
    return apiError(
      context,
      400,
      "challenge_failed",
      "Security challenge failed.",
    );
  }

  const user = await findUserByEmail(context.env, body.data.email);
  if (user && !user.email_verified_at && user.identity_id) {
    const verification = await createVerificationToken(
      "EMAIL",
      EMAIL_VERIFICATION_TTL_MS,
    );
    await context.env.DB.batch([
      context.env.DB.prepare(
        `DELETE FROM verification_tokens
         WHERE user_id = ? AND purpose = 'EMAIL' AND consumed_at IS NULL`,
      ).bind(user.id),
      context.env.DB.prepare(
        `INSERT INTO verification_tokens (
           id, user_id, purpose, token_hash, expires_at
         ) VALUES (?, ?, 'EMAIL', ?, ?)`,
      ).bind(
        verification.id,
        user.id,
        verification.hash,
        verification.expiresAt,
      ),
    ]);
    await sendVerificationEmail(
      context.env,
      user.email,
      user.name ?? "there",
      verification.raw,
    );
    await safeAudit(context.env, {
      userId: user.id,
      type: "verification_resent",
      request: context.req.raw,
    });
  }

  return genericEmailResponse(context);
});

app.post("/api/verify-email", async (context) => {
  const body = tokenActionSchema.safeParse(await context.req.json());
  if (!body.success) {
    return apiError(context, 400, "invalid_input", firstIssue(body.error));
  }

  const limit = await rateLimit(
    context.env,
    "verify-email",
    clientIp(context.req.raw),
    10,
    3600,
  );
  if (!limit.allowed) return rateLimitError(context, limit.retryAfter);

  const tokenHash = await hashToken(body.data.token);
  const token = await context.env.DB.prepare(
    `SELECT vt.id, vt.user_id, vt.expires_at, u.email, u.name,
            u.auth_version
     FROM verification_tokens vt
     JOIN users u ON u.id = vt.user_id
     WHERE vt.token_hash = ? AND vt.purpose = 'EMAIL'
       AND vt.consumed_at IS NULL
     LIMIT 1`,
  )
    .bind(tokenHash)
    .first<TokenRow>();

  if (!token || Date.parse(token.expires_at) <= Date.now()) {
    return apiError(
      context,
      400,
      "invalid_token",
      "Verification link is invalid or expired.",
    );
  }

  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE users
       SET email_verified_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
    ).bind(token.user_id),
    context.env.DB.prepare(
      `UPDATE verification_tokens
       SET consumed_at = datetime('now')
       WHERE id = ?`,
    ).bind(token.id),
    context.env.DB.prepare(
      `DELETE FROM verification_tokens
       WHERE user_id = ? AND purpose = 'EMAIL' AND id != ?`,
    ).bind(token.user_id, token.id),
  ]);
  await safeAudit(context.env, {
    userId: token.user_id,
    type: "email_verified",
    request: context.req.raw,
  });

  return context.json({ ok: true });
});

app.post("/api/login", async (context) => {
  const body = loginSchema.safeParse(await context.req.json());
  if (!body.success) {
    return apiError(context, 400, "invalid_input", firstIssue(body.error));
  }

  const ip = clientIp(context.req.raw);
  const ipLimit = await rateLimit(context.env, "login-ip", ip, 20, 900);
  const emailLimit = await rateLimit(
    context.env,
    "login-email",
    body.data.email,
    10,
    900,
  );
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return rateLimitError(
      context,
      Math.max(ipLimit.retryAfter, emailLimit.retryAfter),
    );
  }

  const user = await findUserByEmail(context.env, body.data.email);
  const passwordHash = user?.password_hash ?? DUMMY_PASSWORD_HASH;
  const passwordValid = await verifyPassword(passwordHash, body.data.password);

  if (!user || !user.identity_id || !passwordValid || user.disabled_at) {
    await safeAudit(context.env, {
      userId: user?.id,
      type: "login_failed",
      request: context.req.raw,
    });
    return apiError(
      context,
      401,
      "invalid_credentials",
      "Email or password is incorrect.",
    );
  }
  if (!user.email_verified_at) {
    return apiError(
      context,
      403,
      "email_unverified",
      "Verify your email before signing in.",
    );
  }

  const identity = toIdentity(user);
  const created = await createSession(context.env, identity, user.auth_version);
  await context.env.DB.prepare(
    `UPDATE users
     SET last_login_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(user.id)
    .run();
  await safeAudit(context.env, {
    userId: user.id,
    type: "login_succeeded",
    request: context.req.raw,
  });

  context.header(
    "Set-Cookie",
    makeSessionCookie(context.req.raw, context.env, created.token),
  );
  return context.json({ authenticated: true, user: identity });
});

app.post("/api/logout", async (context) => {
  const token = readSessionToken(context.req.raw);
  const session = token ? await getSession(context.env, token) : null;
  if (token) await deleteSession(context.env, token);

  context.header(
    "Set-Cookie",
    clearSessionCookie(context.req.raw, context.env),
  );
  if (session) {
    await safeAudit(context.env, {
      userId: session.identity.id,
      type: "logout",
      request: context.req.raw,
    });
  }
  return context.json({ ok: true });
});

app.get("/api/session", async (context) => {
  const token = readSessionToken(context.req.raw);
  const session = token ? await getSession(context.env, token) : null;
  if (!session) return context.json({ authenticated: false });

  return context.json({
    authenticated: true,
    user: session.identity,
    expiresAt: session.expiresAt,
  });
});

app.post("/api/password/forgot", async (context) => {
  const body = emailActionSchema.safeParse(await context.req.json());
  if (!body.success) {
    return apiError(context, 400, "invalid_input", firstIssue(body.error));
  }

  const ip = clientIp(context.req.raw);
  const limit = await rateLimit(
    context.env,
    "password-forgot",
    `${ip}:${body.data.email}`,
    5,
    3600,
  );
  if (!limit.allowed) return rateLimitError(context, limit.retryAfter);

  if (!(await verifyTurnstile(context.env, body.data.turnstileToken, ip))) {
    return apiError(
      context,
      400,
      "challenge_failed",
      "Security challenge failed.",
    );
  }

  const user = await findUserByEmail(context.env, body.data.email);
  if (user?.email_verified_at && user.identity_id) {
    const reset = await createVerificationToken(
      "PASSWORD_RESET",
      PASSWORD_RESET_TTL_MS,
    );
    await context.env.DB.batch([
      context.env.DB.prepare(
        `DELETE FROM verification_tokens
         WHERE user_id = ? AND purpose = 'PASSWORD_RESET'
           AND consumed_at IS NULL`,
      ).bind(user.id),
      context.env.DB.prepare(
        `INSERT INTO verification_tokens (
           id, user_id, purpose, token_hash, expires_at
         ) VALUES (?, ?, 'PASSWORD_RESET', ?, ?)`,
      ).bind(reset.id, user.id, reset.hash, reset.expiresAt),
    ]);
    await sendPasswordResetEmail(
      context.env,
      user.email,
      user.name ?? "there",
      reset.raw,
    );
    await safeAudit(context.env, {
      userId: user.id,
      type: "password_reset_requested",
      request: context.req.raw,
    });
  }

  return genericEmailResponse(context);
});

app.post("/api/password/reset", async (context) => {
  const body = resetPasswordSchema.safeParse(await context.req.json());
  if (!body.success) {
    return apiError(context, 400, "invalid_input", firstIssue(body.error));
  }

  const limit = await rateLimit(
    context.env,
    "password-reset",
    clientIp(context.req.raw),
    10,
    3600,
  );
  if (!limit.allowed) return rateLimitError(context, limit.retryAfter);

  const tokenHash = await hashToken(body.data.token);
  const token = await context.env.DB.prepare(
    `SELECT vt.id, vt.user_id, vt.expires_at, u.email, u.name,
            u.auth_version
     FROM verification_tokens vt
     JOIN users u ON u.id = vt.user_id
     WHERE vt.token_hash = ? AND vt.purpose = 'PASSWORD_RESET'
       AND vt.consumed_at IS NULL
     LIMIT 1`,
  )
    .bind(tokenHash)
    .first<TokenRow>();

  if (!token || Date.parse(token.expires_at) <= Date.now()) {
    return apiError(
      context,
      400,
      "invalid_token",
      "Password reset link is invalid or expired.",
    );
  }

  const passwordHash = await hashPassword(body.data.password);
  const nextAuthVersion = token.auth_version + 1;
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE identities
       SET password_hash = ?, updated_at = datetime('now')
       WHERE user_id = ? AND provider = 'password'`,
    ).bind(passwordHash, token.user_id),
    context.env.DB.prepare(
      `UPDATE users
       SET auth_version = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).bind(nextAuthVersion, token.user_id),
    context.env.DB.prepare(
      `UPDATE verification_tokens
       SET consumed_at = datetime('now')
       WHERE id = ?`,
    ).bind(token.id),
    context.env.DB.prepare(
      `DELETE FROM verification_tokens
       WHERE user_id = ? AND purpose = 'PASSWORD_RESET' AND id != ?`,
    ).bind(token.user_id, token.id),
  ]);
  await invalidateUserSessions(context.env, token.user_id, nextAuthVersion);
  await safeAudit(context.env, {
    userId: token.user_id,
    type: "password_reset_completed",
    request: context.req.raw,
  });

  context.header(
    "Set-Cookie",
    clearSessionCookie(context.req.raw, context.env),
  );
  return context.json({ ok: true });
});

app.post("/api/sessions/revoke-all", async (context) => {
  const rawToken = readSessionToken(context.req.raw);
  const session = rawToken ? await getSession(context.env, rawToken) : null;
  if (!session) {
    return apiError(context, 401, "unauthorized", "Sign in to continue.");
  }

  const row = await context.env.DB.prepare(
    `UPDATE users
     SET auth_version = auth_version + 1, updated_at = datetime('now')
     WHERE id = ?
     RETURNING auth_version`,
  )
    .bind(session.identity.id)
    .first<{ auth_version: number }>();

  if (!row) {
    return apiError(context, 401, "unauthorized", "Sign in to continue.");
  }

  await invalidateUserSessions(
    context.env,
    session.identity.id,
    row.auth_version,
  );
  context.header(
    "Set-Cookie",
    clearSessionCookie(context.req.raw, context.env),
  );
  await safeAudit(context.env, {
    userId: session.identity.id,
    type: "sessions_revoked",
    request: context.req.raw,
  });
  return context.json({ ok: true });
});

app.get("/internal/session", async (context) => {
  if (new URL(context.req.url).hostname !== "pass.internal") {
    return context.body(null, 404);
  }

  const token = context.req.header("x-zarkiv-session");
  if (!token) return context.json({ error: "unauthorized" }, 401);

  const session = await getSession(context.env, token);
  if (!session) return context.json({ error: "unauthorized" }, 401);
  return context.json(session);
});

app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

function normalizeEmail(value: string): string {
  return value.toLowerCase();
}

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}

function toIdentity(user: UserRow): Identity {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

async function findUserByEmail(
  env: Env,
  email: string,
): Promise<UserRow | null> {
  return env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.email_verified_at,
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

async function createVerificationToken(
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

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function genericEmailResponse(context: AppContext) {
  return context.json({
    ok: true,
    message: "If the account is eligible, an email has been sent.",
  });
}

function rateLimitError(context: AppContext, retryAfter: number) {
  context.header("Retry-After", retryAfter.toString());
  return apiError(
    context,
    429,
    "rate_limited",
    "Too many requests. Try again later.",
  );
}

function apiError(
  context: AppContext,
  status: 400 | 401 | 403 | 404 | 409 | 415 | 429 | 500,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status);
}

async function safeAudit(
  env: Env,
  event: Parameters<typeof writeAuditEvent>[1],
): Promise<void> {
  try {
    await writeAuditEvent(env, event);
  } catch (cause) {
    console.error("[pass audit]", cause);
  }
}

export default app;
