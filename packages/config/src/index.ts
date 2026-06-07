export const SESSION_COOKIE = "__Secure-kleavox_session";

export const INTERNAL_HOSTS = {
  PASS: "pass.internal",
  LINK: "link.internal",
  DROP: "drop.internal",
  PULSE: "pulse.internal",
} as const;

export const INTERNAL_URLS = {
  SESSION_VERIFY: `http://${INTERNAL_HOSTS.PASS}/internal/session`,
} as const;

export function getPublicOrigin(rootOrigin: string, subdomain?: string): string {
  const url = new URL(rootOrigin);
  if (!subdomain) return url.origin;
  
  // If we are on localhost, we might use different ports instead of subdomains
  // But for production, it's always subdomain.domain.tld
  if (url.hostname === "localhost") {
    const ports: Record<string, string> = {
      pass: "3001",
      link: "3002",
      pulse: "3003",
      port: "3004",
    };
    return `http://localhost:${ports[subdomain] || url.port}`;
  }

  return `https://${subdomain}.${url.host}`;
}
