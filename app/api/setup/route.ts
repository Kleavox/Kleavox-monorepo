//app/api/setup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendAdminVerificationEmail } from "@/lib/mail";
import { generateOTP } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount > 0) {
      return NextResponse.json({ error: "Setup already completed." }, { status: 403 });
    }

    const { email, password, name } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Data incomplete." }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || "Administrator",
        role: "ADMIN",
        verifiedAt: null,
        otpSecret: otp,
        otpExpiresAt,
      },
    });

    try {
        await sendAdminVerificationEmail(email, otp);
    } catch (e) {
        console.error("Mail Error:", e);
    }

    return NextResponse.json({ success: true, message: "OTP sent to email." });
  } catch {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
