//app/api/auth/delete-account/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE_NAME, verifyUserJWT, generateOTP } from "@/lib/auth";
import { sendAccountDeletedEmail, sendAdminDeletionCodeEmail, sendAdminGoodbyeEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyUserJWT(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { password, otp } = await req.json();
    if (!password) return NextResponse.json({ error: "Password is required." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });

    if (user.role === 'ADMIN') {
        
        if (!otp) {
            const newOtp = generateOTP();
            const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await prisma.user.update({
                where: { id: user.id },
                data: { otpSecret: newOtp, otpExpiresAt }
            });
            
            await sendAdminDeletionCodeEmail(user.email, newOtp);
            
            return NextResponse.json({ requireOtp: true, message: "OTP Sent" });
        } 
        else {
            if (user.otpSecret !== otp) {
                return NextResponse.json({ error: "Incorrect confirmation code." }, { status: 400 });
            }

            await prisma.user.delete({ where: { id: user.id } });

            try { await sendAdminGoodbyeEmail(user.email, user.name || "Admin"); } catch {}
        }

    } else {
        await prisma.user.delete({ where: { id: user.id } });
        try { await sendAccountDeletedEmail(user.email, user.name || "User"); } catch {}
    }

    const res = NextResponse.json({ success: true });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;

  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}
