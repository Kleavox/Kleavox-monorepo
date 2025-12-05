//app/api/admin/invite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/mail";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.pendingInvite.upsert({
      where: { email },
      update: { token, expiresAt },
      create: {
        email,
        token,
        expiresAt,
        role: "USER"
      }
    });

    await sendInviteEmail(email, token);

    return NextResponse.json({ 
      success: true, 
      message: "Invitation email sent."
    });

  } catch (error) {
    console.error("Invite Error:", error);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}
