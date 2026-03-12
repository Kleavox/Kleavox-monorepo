//app/api/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signUserJWT, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth";
import { isLoginBlocked, registerFailedLogin } from "@/lib/loginRateLimit";
import { storeSession } from "@/lib/session";
import { verifyTurnstileWithCookie } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { email, password, cfTurnstile } = (body || {}) as { email?: string; password?: string; cfTurnstile?: string };

  const turnstileCheck = await verifyTurnstileWithCookie(req, cfTurnstile);
  if (!turnstileCheck.success) {
      return NextResponse.json({ error: "Security check failed (Captcha)." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await isLoginBlocked(ip);
  
  if (rate.blocked) {
    const retrySeconds = rate.retryAfter || 60;
    return NextResponse.json(
      { error: `Too many attempts. Please wait ${retrySeconds} seconds.`, retryAfter: retrySeconds },
      { status: 429 }
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      await registerFailedLogin(ip);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await registerFailedLogin(ip);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.verifiedAt) {
      return NextResponse.json({ error: "Account not verified. Please check your email." }, { status: 403 });
    }

    const { token, jti } = signUserJWT({
      id: user.id,
      email: user.email,
      name: user.name || "",
      role: user.role
    });

    await storeSession(jti, SESSION_MAX_AGE);

    const res = NextResponse.json({ ok: true });

    const isProduction = process.env.NODE_ENV === "production";
    
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    
    if (turnstileCheck.cookieAction) {
        return turnstileCheck.cookieAction(res);
    }
    return res;

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal Server Error." }, { status: 500 });
  }
}
