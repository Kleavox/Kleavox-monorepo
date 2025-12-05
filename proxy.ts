//proxy.ts

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "deauvault_session";

const PUBLIC_PATHS = [
  "/",
  "/api/auth/login",
  "/api/cron/cleanup",
  "/api/download",
  "/api/upload",
  "/api/files",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

export default function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/public") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = !!token;


  if (isAuthenticated && pathname === "/") {
    return NextResponse.redirect(new URL("/dash", req.url));
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
