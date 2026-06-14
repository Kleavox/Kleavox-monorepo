import { verifySession, type PassBinding } from "@kleavox/auth";
import type { SessionIdentity } from "@kleavox/core";
import type { MiddlewareHandler } from "hono";

type SessionEnv = {
  Bindings: { PASS: PassBinding };
  Variables: { session: SessionIdentity };
};

export function securityHeaders(options: {
  referrerPolicy: string;
  csp?: string;
}): MiddlewareHandler {
  return async (context, next) => {
    await next();
    context.header("Referrer-Policy", options.referrerPolicy);
    context.header("X-Content-Type-Options", "nosniff");
    context.header("X-Frame-Options", "DENY");
    context.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (options.csp) {
      const type = context.res.headers.get("content-type") ?? "";
      if (
        type.includes("text/html") &&
        !context.res.headers.has("content-security-policy")
      ) {
        context.header("Content-Security-Policy", options.csp);
      }
    }
  };
}

export function requireSession<
  E extends SessionEnv = SessionEnv,
>(): MiddlewareHandler<E> {
  return async (context, next) => {
    const session = await verifySession(context.req.raw, context.env.PASS);
    if (!session) {
      return context.json(
        { code: "UNAUTHORIZED", message: "Sign in with Kleavox Pass." },
        401,
      );
    }
    context.set("session", session);
    await next();
  };
}

export function requireRole<E extends SessionEnv = SessionEnv>(
  role: string,
  forbiddenMessage: string,
): MiddlewareHandler<E> {
  return async (context, next) => {
    const session = await verifySession(context.req.raw, context.env.PASS);
    if (!session) {
      return context.json(
        { code: "UNAUTHORIZED", message: "Sign in with Kleavox Pass." },
        401,
      );
    }
    if (session.identity.role !== role) {
      return context.json(
        { code: "FORBIDDEN", message: forbiddenMessage },
        403,
      );
    }
    context.set("session", session);
    await next();
  };
}
