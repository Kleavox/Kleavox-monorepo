//app/api/auth/resend-delete-code/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOTP } from "@/lib/auth";
import { getAuthenticatedUser } from "@/lib/session";
import { sendAdminDeletionCodeEmail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthenticatedUser(req);
    if (!payload || payload.role !== 'ADMIN') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit(ip, "resend_delete_code"); 
    if (!limit.ok) {
        return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const newOtp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    await prisma.user.update({
        where: { id: payload.id },
        data: { otpSecret: newOtp, otpExpiresAt }
    });

    await sendAdminDeletionCodeEmail(payload.email, newOtp);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Resend Delete Code Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
