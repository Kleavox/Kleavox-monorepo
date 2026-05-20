// src/index.ts

import { initWasm, signJWT, verifyJWT, hashPassword, verifyPassword, generateOTP, generateID } from './wasm';
import { handleOAuthStart, handleOAuthCallback } from './oauth';

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  DEAUONE_JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  SERVICE_SECRET: string;
  ADMIN_EMAIL: string;
  ENVIRONMENT: string;
  BASE_URL: string;
  COOKIE_DOMAIN: string;
  FROM_EMAIL: string;
}

const COOKIE_NAME = 'sid';
const SESSION_TTL = 60 * 60 * 24 * 7;

function isAllowedOrigin(origin: string, cookieDomain: string): boolean {
  try {
    const url = new URL(origin);
    const base = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
    return url.hostname === base || url.hostname.endsWith(cookieDomain);
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await initWasm();

    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const requestOrigin = request.headers.get('Origin') ?? '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin(requestOrigin, env.COOKIE_DOMAIN) ? requestOrigin : '',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Service-Key',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (method === 'GET' && path === '/') {
        return json({ service: 'deauone', status: 'ok' }, 200, corsHeaders);
      }
      if (method === 'POST' && path === '/auth/login') {
        return handleLogin(request, env, corsHeaders);
      }
      if (method === 'POST' && path === '/auth/register') {
        return handleRegister(request, env, corsHeaders);
      }
      if (method === 'POST' && path === '/auth/verify') {
        return handleVerify(request, env, corsHeaders);
      }
      if (method === 'POST' && path === '/auth/logout') {
        return handleLogout(request, env, corsHeaders);
      }
      if (method === 'GET' && path === '/auth/me') {
        return handleMe(request, env, corsHeaders);
      }
      if (method === 'GET' && path === '/auth/verify-token') {
        return handleVerifyToken(request, env, corsHeaders);
      }
      if (method === 'POST' && path === '/auth/forgot-password') {
        return handleForgotPassword(request, env, corsHeaders);
      }
      if (method === 'POST' && path === '/auth/reset-password') {
        return handleResetPassword(request, env, corsHeaders);
      }
      if (method === 'GET' && path === '/oauth/google') {
        return handleOAuthStart(request, env, 'google');
      }
      if (method === 'GET' && path === '/oauth/github') {
        return handleOAuthStart(request, env, 'github');
      }
      if (method === 'GET' && path === '/oauth/callback/google') {
        return handleOAuthCallback(request, env, 'google');
      }
      if (method === 'GET' && path === '/oauth/callback/github') {
        return handleOAuthCallback(request, env, 'github');
      }
      if (method === 'POST' && path === '/email/send') {
        return handleEmailSend(request, env, corsHeaders);
      }

      return json({ error: 'not found' }, 404, corsHeaders);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'internal error';
      return json({ error: msg }, 500, corsHeaders);
    }
  },
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function parseCookie(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent) as [string, string])
  );
}

function makeSessionCookie(token: string, domain: string): string {
  return `${COOKIE_NAME}=${token}; Domain=${domain}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}; Path=/`;
}

function clearSessionCookie(domain: string): string {
  return `${COOKIE_NAME}=; Domain=${domain}; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`;
}

function getTokenFromRequest(request: Request): string | null {
  const cookie = parseCookie(request.headers.get('Cookie'));
  return cookie[COOKIE_NAME] ?? request.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
}

function resolveRole(email: string, dbRole: string, adminEmail: string): string {
  return email.toLowerCase() === adminEmail.toLowerCase() ? 'ADMIN' : dbRole;
}

function buildJWTPayload(user: { id: string; email: string; name: string; role: string }, exp: number): string {
  return JSON.stringify({ sub: user.id, email: user.email, name: user.name, role: user.role, iss: 'deauone', exp });
}

async function handleLogin(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = await request.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return json({ error: 'email and password are required' }, 400, cors);
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, role, password_hash, verified FROM users WHERE email = ?'
  ).bind(body.email.toLowerCase()).first<{
    id: string; email: string; name: string; role: string; password_hash: string; verified: number;
  }>();

  if (!user) {
    return json({ error: 'invalid email or password' }, 401, cors);
  }

  if (!user.password_hash) {
    return json({ error: 'this account uses OAuth login' }, 403, cors);
  }

  if (!verifyPassword(user.password_hash, body.password)) {
    return json({ error: 'invalid email or password' }, 401, cors);
  }

  if (!user.verified) {
    return json({ error: 'account not verified' }, 403, cors);
  }

  const role = resolveRole(user.email, user.role, env.ADMIN_EMAIL);
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const token = signJWT(buildJWTPayload({ ...user, role }, exp), env.DEAUONE_JWT_SECRET);

  await env.SESSIONS.put(`sessions:${token}`, JSON.stringify({ user_id: user.id, expires_at: exp }), {
    expirationTtl: SESSION_TTL,
  });

  return new Response(JSON.stringify({ ok: true, user: { id: user.id, email: user.email, name: user.name, role } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': makeSessionCookie(token, env.COOKIE_DOMAIN), ...cors },
  });
}

async function handleRegister(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = await request.json<{ email: string; name: string; password: string }>();

  if (!body.email || !body.name || !body.password) {
    return json({ error: 'all fields are required' }, 400, cors);
  }

  if (body.password.length < 8) {
    return json({ error: 'password must be at least 8 characters' }, 400, cors);
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase()).first();

  if (existing) {
    return json({ error: 'email already registered' }, 409, cors);
  }

  const id = generateID();
  const hash = await hashPassword(body.password);
  const otpCode = generateOTP();
  const otpId = generateID();
  const otpExp = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, email, name, password_hash, role, verified) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, body.email.toLowerCase(), body.name, hash, 'USER', 0),
    env.DB.prepare(
      'INSERT INTO otp_tokens (id, user_id, code, type, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(otpId, id, otpCode, 'verify', otpExp),
  ]);

  await sendOTPEmail(env, body.email, body.name, otpCode, 'verify');

  return json({ ok: true }, 201, cors);
}

async function handleVerify(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = await request.json<{ email: string; code: string }>();

  if (!body.email || !body.code) {
    return json({ error: 'email and code are required' }, 400, cors);
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase()).first<{ id: string }>();

  if (!user) {
    return json({ error: 'user not found' }, 404, cors);
  }

  const otp = await env.DB.prepare(
    "SELECT id FROM otp_tokens WHERE user_id = ? AND code = ? AND type = 'verify' AND expires_at > datetime('now')"
  ).bind(user.id, body.code).first<{ id: string }>();

  if (!otp) {
    return json({ error: 'invalid code' }, 400, cors);
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET verified = 1 WHERE id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM otp_tokens WHERE id = ?').bind(otp.id),
  ]);

  return json({ ok: true }, 200, cors);
}

async function handleLogout(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const token = getTokenFromRequest(request);

  if (token) {
    await env.SESSIONS.delete(`sessions:${token}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie(env.COOKIE_DOMAIN), ...cors },
  });
}

async function handleMe(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const token = getTokenFromRequest(request);
  if (!token) return json({ error: 'unauthorized' }, 401, cors);

  const session = await env.SESSIONS.get(`sessions:${token}`);
  if (!session) return json({ error: 'unauthorized' }, 401, cors);

  try {
    const payload = JSON.parse(verifyJWT(token, env.DEAUONE_JWT_SECRET));
    return json({ ok: true, user: { id: payload.sub, email: payload.email, name: payload.name, role: payload.role } }, 200, cors);
  } catch {
    return json({ error: 'unauthorized' }, 401, cors);
  }
}

async function handleVerifyToken(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const token = getTokenFromRequest(request);
  if (!token) return json({ valid: false }, 401, cors);

  const session = await env.SESSIONS.get(`sessions:${token}`);
  if (!session) return json({ valid: false }, 401, cors);

  try {
    const payload = JSON.parse(verifyJWT(token, env.DEAUONE_JWT_SECRET));
    return json({ valid: true, payload }, 200, cors);
  } catch {
    return json({ valid: false }, 401, cors);
  }
}

async function handleForgotPassword(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = await request.json<{ email: string }>();

  if (!body.email) {
    return json({ error: 'email is required' }, 400, cors);
  }

  const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?')
    .bind(body.email.toLowerCase()).first<{ id: string; name: string }>();

  if (!user) {
    return json({ ok: true }, 200, cors);
  }

  await env.DB.prepare("DELETE FROM otp_tokens WHERE user_id = ? AND type = 'reset'").bind(user.id).run();

  const otpCode = generateOTP();
  const otpId = generateID();
  const otpExp = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await env.DB.prepare(
    'INSERT INTO otp_tokens (id, user_id, code, type, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(otpId, user.id, otpCode, 'reset', otpExp).run();

  await sendOTPEmail(env, body.email, user.name, otpCode, 'reset');

  return json({ ok: true }, 200, cors);
}

async function handleResetPassword(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = await request.json<{ email: string; code: string; password: string }>();

  if (!body.email || !body.code || !body.password) {
    return json({ error: 'all fields are required' }, 400, cors);
  }

  if (body.password.length < 8) {
    return json({ error: 'password must be at least 8 characters' }, 400, cors);
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase()).first<{ id: string }>();

  if (!user) {
    return json({ error: 'invalid code' }, 400, cors);
  }

  const otp = await env.DB.prepare(
    "SELECT id FROM otp_tokens WHERE user_id = ? AND code = ? AND type = 'reset' AND expires_at > datetime('now')"
  ).bind(user.id, body.code).first<{ id: string }>();

  if (!otp) {
    return json({ error: 'invalid code' }, 400, cors);
  }

  const newHash = await hashPassword(body.password);

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, user.id),
    env.DB.prepare('DELETE FROM otp_tokens WHERE id = ?').bind(otp.id),
  ]);

  const sessionList = await env.SESSIONS.list({ prefix: 'sessions:' });
  for (const key of sessionList.keys) {
    const val = await env.SESSIONS.get(key.name);
    if (val) {
      const session = JSON.parse(val);
      if (session.user_id === user.id) {
        await env.SESSIONS.delete(key.name);
      }
    }
  }

  return json({ ok: true }, 200, cors);
}

async function sendEmail(env: Env, to: string | string[], subject: string, html: string, from?: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from ?? env.FROM_EMAIL, to, subject, html }),
  });
}

async function sendOTPEmail(env: Env, to: string, name: string, code: string, type: 'verify' | 'reset'): Promise<void> {
  const subject = type === 'verify' ? 'Verify your account' : 'Reset your password';
  const html = type === 'verify'
    ? `<p>Hi ${name},</p><p>Your verification code: <strong>${code}</strong></p><p>Valid for 15 minutes.</p>`
    : `<p>Hi ${name},</p><p>Your password reset code: <strong>${code}</strong></p><p>Valid for 15 minutes.</p>`;
  await sendEmail(env, to, subject, html);
}

async function handleEmailSend(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const serviceKey = request.headers.get('X-Service-Key');
  if (!serviceKey || serviceKey !== env.SERVICE_SECRET) {
    return json({ error: 'unauthorized' }, 401, cors);
  }

  const body = await request.json<{ to: string | string[]; subject: string; html: string; from?: string }>();

  if (!body.to || !body.subject || !body.html) {
    return json({ error: 'missing required fields' }, 400, cors);
  }

  await sendEmail(env, body.to, body.subject, body.html, body.from);

  return json({ ok: true }, 200, cors);
}
