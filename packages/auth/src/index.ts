import { INTERNAL_URLS, SESSION_COOKIE } from "@kleavox/config";
import type { SessionIdentity } from "@kleavox/core";

export { SESSION_COOKIE };

export interface PassBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const key = pair.slice(0, separator).trim();
    if (key !== name) continue;

    return decodeURIComponent(pair.slice(separator + 1).trim());
  }

  return null;
}

export async function verifySession(
  request: Request,
  pass: PassBinding,
): Promise<SessionIdentity | null> {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;

  const response = await pass.fetch(INTERNAL_URLS.SESSION_VERIFY, {
    headers: {
      "x-kleavox-session": sessionId,
    },
  });

  if (!response.ok) return null;
  return response.json<SessionIdentity>();
}
