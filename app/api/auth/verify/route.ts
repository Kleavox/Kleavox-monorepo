//app/api/auth/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail, sendAdminWelcomeEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.otpSecret !== otp) {
      return NextResponse.json({ error: "Incorrect verification code." }, { status: 401 });
    }

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
    }

    await prisma.user.update({
      where: { email },
      data: { verifiedAt: new Date(), otpSecret: null, otpExpiresAt: null },
    });

    try {
        if (user.role === "ADMIN") {
            await sendAdminWelcomeEmail(user.email, user.name || "Admin");
        } else {
            await sendWelcomeEmail(user.email, user.name || "User");
        }
    } catch (e) {
        console.error("Failed to send welcome email:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
