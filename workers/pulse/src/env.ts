import type { DeployEnvironment } from "@kleavox/core";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PASS: Fetcher;
  LINK: Fetcher;
  ENVIRONMENT: DeployEnvironment;
  PUBLIC_ORIGIN: string;
  FROM_EMAIL: string;
  RESEND_API_KEY?: string;
}
