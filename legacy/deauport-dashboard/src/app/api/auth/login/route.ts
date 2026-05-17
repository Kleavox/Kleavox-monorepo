import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}
function days(n: number) {
  return Math.max(1, Math.floor(n)) * 24 * 60 * 60;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const remember = form.get("remember") === "on";

  const expectedHash = process.env.AUTH_PASS_SHA256?.trim() || "";
  if (!expectedHash) {
    return NextResponse.redirect(
      new URL("/login?e=" + encodeURIComponent("Server belum dikonfigurasi (AUTH_PASS_SHA256)."), req.url)
    );
  }

  const providedHash = sha256Hex(password);
  if (providedHash !== expectedHash) {
    return NextResponse.redirect(
      new URL("/login?e=" + encodeURIComponent("Password salah."), req.url)
    );
  }

  const maxAge = remember
    ? days(Number(process.env.REMEMBER_DAYS ?? 30))
    : days(Number(process.env.SESSION_DAYS ?? 7));

  (await cookies()).set("deau_sess", "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return NextResponse.redirect(new URL("/", req.url));
}