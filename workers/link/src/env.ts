export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  PASS: Fetcher;
  PULSE: Fetcher;
  PUBLIC_CREATE_RATE_LIMIT: RateLimit;
  REPORT_RATE_LIMIT: RateLimit;
  CREATE_RATE_LIMIT: RateLimit;
  DOWNLOAD_RATE_LIMIT: RateLimit;
  FILE_REPORT_RATE_LIMIT: RateLimit;
  ENVIRONMENT: "development" | "preview" | "production";
  PUBLIC_SHORT_ORIGIN: string;
  TURNSTILE_SECRET_KEY?: string;
  GUEST_HASH_SECRET?: string;
  DOWNLOAD_SIGNING_SECRET?: string;
  PASSWORD_HASH_SECRET?: string;
}
