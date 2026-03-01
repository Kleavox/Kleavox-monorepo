//app/api/logout/route.ts

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifyUserJWT } from "@/lib/auth";
import { deleteSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  // Delete session from Redis if available (no-op in dev)
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const payload = verifyUserJWT(token);
    if (payload?.jti) {
      await deleteSession(payload.jti);
    }
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return res;
}
