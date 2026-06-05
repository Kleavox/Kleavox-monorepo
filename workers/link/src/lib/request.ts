export function parseTargetUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return null;
  }
}

export function parseExpiration(value?: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return null;
  return new Date(timestamp).toISOString();
}

export function clientContext(request: Request): {
  browser: string | null;
  operatingSystem: string | null;
  deviceType: string | null;
  referrerHost: string | null;
  country: string | null;
} {
  const userAgent = request.headers.get("user-agent") ?? "";
  const cf = (request as Request & { cf?: { country?: string } }).cf;

  return {
    browser: detectBrowser(userAgent),
    operatingSystem: detectOperatingSystem(userAgent),
    deviceType: /mobile|android|iphone|ipad/i.test(userAgent)
      ? /ipad|tablet/i.test(userAgent)
        ? "tablet"
        : "mobile"
      : "desktop",
    referrerHost: hostFromReferrer(request.headers.get("referer")),
    country: cf?.country ?? null,
  };
}

function detectBrowser(userAgent: string): string | null {
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/chrome\//i.test(userAgent)) return "Chrome";
  if (/safari\//i.test(userAgent)) return "Safari";
  return userAgent ? "Other" : null;
}

function detectOperatingSystem(userAgent: string): string | null {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return userAgent ? "Other" : null;
}

function hostFromReferrer(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}
