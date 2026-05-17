import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  (await cookies()).delete("deau_sess");

  const res = NextResponse.redirect(new URL("/", req.url), {
    status: 302,
  });

  res.headers.set(
    "Cache-Control",
    "no-cache, no-store, max-age=0, must-revalidate"
  );

  return res;
}

export async function GET(req: Request) {
  return POST(req);
}