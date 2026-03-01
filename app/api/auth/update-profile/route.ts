//app/api/auth/update-profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE_NAME, verifyUserJWT } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const payload = verifyUserJWT(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, oldPassword, newPassword } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updateData: any = {};

    if (name) {
        updateData.name = name;
    }

    if (newPassword) {
        if (!oldPassword) {
            return NextResponse.json({ error: "Current password is required to change your password." }, { status: 400 });
        }
        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
        }
        updateData.password = await bcrypt.hash(newPassword, 10);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: updateData
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}