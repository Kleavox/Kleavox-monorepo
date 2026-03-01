// app/api/auth/resend-otp/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail, sendAdminVerificationEmail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateOTP } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  
  const limit = await checkRateLimit(ip, "resend_otp");

  if (!limit.ok) {
    return NextResponse.json(
      { error: `Please wait ${Math.ceil((limit.retryAfter || 60) / 60)} minute(s) before requesting again.` },
      { status: 429 }
    );
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.verifiedAt) {
      return NextResponse.json({ error: "Account is already verified." }, { status: 400 });
    }

    const newOtp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otpSecret: newOtp, otpExpiresAt },
    });

    if (user.role === "ADMIN") {
        await sendAdminVerificationEmail(email, newOtp);
    } else {
        await sendVerificationEmail(email, newOtp);
    }

    return NextResponse.json({ message: "New code sent." }, { status: 200 });

  } catch (error) {
    console.error("Resend OTP Error:", error);
    return NextResponse.json({ error: "Failed to resend code." }, { status: 500 });
  }
}
