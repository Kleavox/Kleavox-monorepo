import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/env";
import loginRoutes from "./routes/login";
import authRoutes from "./routes/auth";
import linkRoutes from "./routes/links";
import publicRoutes from "./routes/public";
import adminRoutes from "./routes/admin";
import setupRoutes from "./routes/setup";
import redirectRoutes from "./routes/redirect";
import { handleCron } from "./routes/cron";

const app = new Hono<{ Bindings: Env }>();

// ─── Global error handler ─────────────────────────────────────
app.onError((err, c) => {
  console.error("[worker error]", err);
  return c.json({ error: "Internal server error" }, 500);
});

// ─── CORS (same domain, but allow credentials for cookies) ───
app.use("*", cors({
  origin: (origin, c) => {
    const allowed = [
      `https://${c.env.APP_HOST}`,
      `https://${c.env.SHORT_HOST}`,
      "http://localhost:3000",
    ];
    return allowed.includes(origin) ? origin : allowed[0];
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// ─── API Routes ──────────────────────────────────────
app.route("/", loginRoutes);                // /api/login, /api/logout, /api/session
app.route("/api/auth", authRoutes);         // /api/auth/*
app.route("/api/links", linkRoutes);        // /api/links/*
app.route("/", publicRoutes);              // /api/public-links, /api/report
app.route("/api/admin", adminRoutes);      // /api/admin/*
app.route("/api/setup", setupRoutes);      // /api/setup/*

// ─── QR Download ─────────────────────────────────────
// (Client-side QR generation used in Next.js — no server QR needed)
// If you want server-side QR, install `qrcode` npm package and add route here.

// ─── Root redirect (deau.site → portfolio) ───────────
app.get("/", (c) => {
  const host = c.req.header("host") ?? "";
  if (host === c.env.SHORT_HOST) {
    return c.redirect(`https://${c.env.REDIRECT_HOST}`, 301);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

// ─── Shortlink Redirect ───────────────────────────────
app.route("/", redirectRoutes);            // /:slug

// ─── Fallback ─────────────────────────────────────────
app.all("*", async (c) => {
  const host = c.req.header("host") ?? "";
  if (host === c.env.SHORT_HOST) {
    // On deau.site: redirect everything non-slug to app domain
    const url = new URL(c.req.url);
    url.hostname = c.env.APP_HOST;
    url.protocol = "https:";
    return c.redirect(url.toString(), 301);
  }
  // On bit.deau.site: serve static assets
  return c.env.ASSETS.fetch(c.req.raw);
});

// ─── Export (Workers + Cron) ─────────────────────────
export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
};
