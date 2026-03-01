//app/api/links/[slug]/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { password } = await req.json();

    const link = await prisma.shortLink.findUnique({
      where: { slug },
    });
    
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (!link.password) {
      return NextResponse.json({ targetUrl: link.targetUrl });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const isValid = await bcrypt.compare(password, link.password);
    
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    return NextResponse.json({ targetUrl: link.targetUrl });

  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
