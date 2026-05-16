// Cloudflare Workers environment bindings type

export interface Env {
  // Bindings
  DB: D1Database;
  SESSION: KVNamespace;
  ASSETS: Fetcher;

  // Variables
  APP_HOST: string;
  PROTOCOL: string;
  SHORT_HOST: string;
  REDIRECT_HOST: string;
  TURNSTILE_SITE_KEY: string;

  // Secrets
  JWT_SECRET: string;
  TURNSTILE_SECRET_KEY: string;

  // Resend email
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
}
