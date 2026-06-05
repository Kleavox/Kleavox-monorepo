export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  SESSIONS: KVNamespace;
  ENVIRONMENT: "development" | "preview" | "production";
  PUBLIC_ORIGIN: string;
  ROOT_DOMAIN: string;
  FROM_EMAIL: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  IP_HASH_SECRET?: string;
}
