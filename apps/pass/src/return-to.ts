const PASS_LABEL = "pass.";

function rootDomain(hostname: string): string {
  return hostname.startsWith(PASS_LABEL)
    ? hostname.slice(PASS_LABEL.length)
    : hostname;
}

export function safeReturnTo(
  value: string | null,
  here: { hostname: string; origin: string },
): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value, here.origin);
  } catch {
    return null;
  }
  const hostname = here.hostname.toLowerCase();
  const root = rootDomain(hostname);
  const host = url.hostname.toLowerCase();
  if (host !== root && !host.endsWith(`.${root}`)) return null;
  if (url.protocol === "https:") return url.toString();
  if (url.protocol === "http:" && host === hostname) return url.toString();
  return null;
}
