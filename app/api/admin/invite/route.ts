//app/api/admin/invite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "User already exists" }, { status: 400 });

  const tempPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: "USER",
      name: "Invited User"
    }
  });

  return NextResponse.json({ 
    success: true, 
    message: "User invited.",
    debugPassword: tempPassword
  });
}
