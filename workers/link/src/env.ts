export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PASS: Fetcher;
  DROP: Fetcher;
  PUBLIC_CREATE_RATE_LIMIT: RateLimit;
  ENVIRONMENT: "development" | "preview" | "production";
  PUBLIC_SHORT_ORIGIN: string;
}
