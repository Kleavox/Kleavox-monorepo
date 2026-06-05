import type { Env } from "../env";

interface TurnstileResponse {
  success: boolean;
}

export async function verifyTurnstile(
  env: Env,
  token: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    return env.ENVIRONMENT !== "production";
  }
  if (!token) return false;

  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!response.ok) return false;

  const result = await response.json<TurnstileResponse>();
  return result.success;
}
