export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PASS: Fetcher;
  ENVIRONMENT: "development" | "preview" | "production";
  PUBLIC_SHORT_ORIGIN: string;
}
