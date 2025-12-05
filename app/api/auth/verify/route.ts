//app/api/auth/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendCredentialsEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const invite = await prisma.pendingInvite.findUnique({ where: { token } });

    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    if (new Date() > invite.expiresAt) {
      await prisma.pendingInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ error: "Invitation expired" }, { status: 400 });
    }

    const rawPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invite.email,
          password: hashedPassword,
          role: invite.role,
          name: "User"
        }
      }),
      prisma.pendingInvite.delete({ where: { id: invite.id } })
    ]);

    await sendCredentialsEmail(invite.email, rawPassword);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
