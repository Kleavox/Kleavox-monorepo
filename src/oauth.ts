// src/oauth.ts

import { generateID, signJWT } from './wasm';
import type { Env } from './index';

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

function oauthSuccessPage(origin: string, cookie: string): Response {
  const safeOrigin = JSON.stringify(origin);
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Login successful</title></head>
<body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'deauone:oauth:done' }, ${safeOrigin});
    }
  } finally {
    window.close();
  }
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8', 'Set-Cookie': cookie },
  });
}

function oauthErrorPage(message: string): Response {
  const safeMsg = JSON.stringify(message);
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Login failed</title></head>
<body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'deauone:oauth:error', error: ${safeMsg} }, '*');
    }
  } finally {
    window.close();
  }
</script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

async function saveState(env: Env, state: string, origin: string): Promise<void> {
  await env.SESSIONS.put(`oauth_state:${state}`, JSON.stringify({ origin }), { expirationTtl: 600 });
}

async function consumeState(env: Env, state: string): Promise<string | null> {
  const raw = await env.SESSIONS.get(`oauth_state:${state}`);
  if (!raw) return null;
  await env.SESSIONS.delete(`oauth_state:${state}`);
  return JSON.parse(raw).origin;
}

async function getGoogleUser(env: Env, code: string): Promise<{ id: string; email: string; name: string }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.BASE_URL}/oauth/callback/google`,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json<{ access_token: string; error?: string }>();
  if (tokenData.error) throw new Error(tokenData.error);

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const user = await userRes.json<{ id: string; email: string; name: string }>();
  return { id: user.id, email: user.email, name: user.name };
}

async function getGitHubUser(env: Env, code: string): Promise<{ id: string; email: string; name: string }> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      redirect_uri: `${env.BASE_URL}/oauth/callback/github`,
    }),
  });

  const tokenData = await tokenRes.json<{ access_token: string; error?: string }>();
  if (tokenData.error) throw new Error(tokenData.error);

  const headers = {
    Authorization: `Bearer ${tokenData.access_token}`,
    'User-Agent': 'DeauOne',
    Accept: 'application/json',
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  const user = await userRes.json<{ id: number; name: string; email: string | null; login: string }>();

  let email = user.email;

  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
    const emails = await emailsRes.json<{ email: string; primary: boolean; verified: boolean }[]>();
    const primary = emails.find(e => e.primary && e.verified);
    if (!primary) throw new Error('could not get email from GitHub account');
    email = primary.email;
  }

  return { id: String(user.id), email, name: user.name || user.login };
}

async function findOrCreateUser(
  env: Env,
  provider: 'google' | 'github',
  providerUser: { id: string; email: string; name: string }
): Promise<{ id: string; email: string; name: string; role: string }> {
  const existing = await env.DB.prepare(
    'SELECT u.id, u.email, u.name, u.role FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id WHERE oa.provider = ? AND oa.provider_id = ?'
  ).bind(provider, providerUser.id).first<{ id: string; email: string; name: string; role: string }>();

  if (existing) return existing;

  const userByEmail = await env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE email = ?'
  ).bind(providerUser.email.toLowerCase()).first<{ id: string; email: string; name: string; role: string }>();

  if (userByEmail) {
    const oauthId = generateID();
    await env.DB.prepare(
      'INSERT INTO oauth_accounts (id, user_id, provider, provider_id) VALUES (?, ?, ?, ?)'
    ).bind(oauthId, userByEmail.id, provider, providerUser.id).run();
    return userByEmail;
  }

  const userId = generateID();
  const oauthId = generateID();

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, email, name, password_hash, role, verified) VALUES (?, ?, ?, NULL, ?, 1)'
    ).bind(userId, providerUser.email.toLowerCase(), providerUser.name, 'USER'),
    env.DB.prepare(
      'INSERT INTO oauth_accounts (id, user_id, provider, provider_id) VALUES (?, ?, ?, ?)'
    ).bind(oauthId, userId, provider, providerUser.id),
  ]);

  return { id: userId, email: providerUser.email.toLowerCase(), name: providerUser.name, role: 'USER' };
}

export async function handleOAuthStart(
  request: Request,
  env: Env,
  provider: 'google' | 'github'
): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.searchParams.get('origin') || env.BASE_URL;

  if (!isAllowedOrigin(origin, env.COOKIE_DOMAIN)) {
    return new Response('origin not allowed', { status: 400 });
  }

  const state = generateID();
  await saveState(env, state, origin);

  let authUrl: string;
  if (provider === 'google') {
    authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.BASE_URL}/oauth/callback/google`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
    });
  } else {
    authUrl = 'https://github.com/login/oauth/authorize?' + new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${env.BASE_URL}/oauth/callback/github`,
      scope: 'user:email',
      state,
    });
  }

  return Response.redirect(authUrl, 302);
}

export async function handleOAuthCallback(
  request: Request,
  env: Env,
  provider: 'google' | 'github'
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code || !state) {
    return oauthErrorPage(error || 'OAuth cancelled');
  }

  const origin = await consumeState(env, state);
  if (!origin) {
    return oauthErrorPage('invalid or expired state, please try again');
  }

  let providerUser: { id: string; email: string; name: string };
  try {
    providerUser = provider === 'google'
      ? await getGoogleUser(env, code)
      : await getGitHubUser(env, code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed to get user data from provider';
    return oauthErrorPage(msg);
  }

  let user: { id: string; email: string; name: string; role: string };
  try {
    user = await findOrCreateUser(env, provider, providerUser);
  } catch {
    return oauthErrorPage('failed to create account, please try again');
  }

  const role = user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() ? 'ADMIN' : user.role;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const token = signJWT(JSON.stringify({
    sub: user.id,
    email: user.email,
    name: user.name,
    role,
    iss: 'deauone',
    exp,
  }), env.DEAUONE_JWT_SECRET);

  await env.SESSIONS.put(`sessions:${token}`, JSON.stringify({ user_id: user.id, expires_at: exp }), {
    expirationTtl: SESSION_TTL,
  });

  const cookie = `sid=${token}; Domain=${env.COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}; Path=/`;
  return oauthSuccessPage(origin, cookie);
}
