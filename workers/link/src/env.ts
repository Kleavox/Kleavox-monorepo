export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PASS: Fetcher;
  DROP: Fetcher;
  ENVIRONMENT: "development" | "preview" | "production";
  PUBLIC_SHORT_ORIGIN: string;
}
