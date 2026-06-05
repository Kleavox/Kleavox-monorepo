export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PASS: Fetcher;
  ENVIRONMENT: "development" | "preview" | "production";
  PUBLIC_ORIGIN: string;
  AGENT_DOWNLOAD_BASE: string;
}
