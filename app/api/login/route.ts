//app/api/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signUserJWT, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth";
import { isLoginBlocked, registerFailedLogin } from "@/lib/loginRateLimit";
import { storeSession } from "@/lib/session";
import { createHmac } from "crypto";

const TURNSTILE_COOKIE_NAME = "db-cv";
const TURNSTILE_VALIDITY = 300; 

function signData(data: string) {
    const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-key";
    return createHmac("sha256", secret).update(data).digest("hex");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { email, password } = (body || {}) as { email?: string; password?: string };

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

  const withTurnstileCookie = (res: NextResponse) => {
      const now = Math.floor(Date.now() / 1000);
      const signature = signData(now.toString());
      res.cookies.set(TURNSTILE_COOKIE_NAME, `${now}.${signature}`, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: TURNSTILE_VALIDITY,
      });
      return res;
  };

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

    // Store session in Redis (no-op in dev when REDIS_URL is not set)
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
    
    return withTurnstileCookie(res);

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal Server Error." }, { status: 500 });
  }
}
