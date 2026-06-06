export const PRODUCT_NAMES = [
  "web",
  "pass",
  "link",
  "pulse",
  "portfolio",
] as const;

export type ProductName = (typeof PRODUCT_NAMES)[number];

export const RESERVED_SLUGS = [
  "about",
  "account",
  "api",
  "assets",
  "contact",
  "drop",
  "favicon.ico",
  "link",
  "login",
  "pass",
  "port",
  "portfolio",
  "privacy",
  "projects",
  "pulse",
  "robots.txt",
  "sitemap.xml",
  "terms",
] as const;

const reservedSlugSet = new Set<string>(RESERVED_SLUGS);

export function isReservedSlug(value: string): boolean {
  return reservedSlugSet.has(value.trim().toLowerCase());
}

export interface Identity {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
}

export interface SessionIdentity {
  identity: Identity;
  sessionId: string;
  expiresAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
}
