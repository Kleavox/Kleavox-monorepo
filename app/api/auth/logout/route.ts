//app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "deauvault_session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, 
  });

  return response;
}
