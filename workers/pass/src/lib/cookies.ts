import { SESSION_COOKIE } from "@zarkiv/auth";
import type { Env } from "../env";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function makeSessionCookie(
  request: Request,
  env: Env,
  token: string,
): string {
  return serializeCookie(request, env, token, SESSION_TTL_SECONDS);
}

export function clearSessionCookie(request: Request, env: Env): string {
  return serializeCookie(request, env, "", 0);
}

function serializeCookie(
  request: Request,
  env: Env,
  value: string,
  maxAge: number,
): string {
  const host = new URL(request.url).hostname.toLowerCase();
  const rootDomain = env.ROOT_DOMAIN.toLowerCase();
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (host === rootDomain || host.endsWith(`.${rootDomain}`)) {
    attributes.push(`Domain=.${rootDomain}`);
  }

  return attributes.join("; ");
}
