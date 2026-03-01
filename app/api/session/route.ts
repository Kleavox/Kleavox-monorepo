// app/api/session/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  verifyUserJWT,
  signUserJWT,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/auth";
import { validateSession, deleteSession, storeSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const payload = verifyUserJWT(token);
  if (!payload) {
    const res = NextResponse.json({ authenticated: false }, { status: 200 });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // Validate session in Redis (no-op / returns true in dev)
  if (payload.jti) {
    const valid = await validateSession(payload.jti);
    if (!valid) {
      const res = NextResponse.json({ authenticated: false }, { status: 200 });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
    // Rotate: delete old JTI, issue new one
    await deleteSession(payload.jti);
  }

  // Issue a new JWT with a fresh JTI (rolling window)
  const { token: newToken, jti: newJti } = signUserJWT({
    id: payload.id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  });

  await storeSession(newJti, SESSION_MAX_AGE);

  const res = NextResponse.json({
    authenticated: true,
    user: {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    },
  });

  const isProduction = process.env.NODE_ENV === "production";

  res.cookies.set(SESSION_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return res;
}
