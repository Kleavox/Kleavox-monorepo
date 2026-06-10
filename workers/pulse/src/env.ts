export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PASS: Fetcher;
  LINK: Fetcher;
  DROP: Fetcher;
  ENVIRONMENT: "development" | "preview" | "production";
  PUBLIC_ORIGIN: string;
  AGENT_DOWNLOAD_BASE: string;
  FROM_EMAIL: string;
  RESEND_API_KEY?: string;
}
