//app/api/admin/delete/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    const { token, slug } = await req.json();

    if (!token || !slug) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { action: string; slug: string };
        if (decoded.action !== 'delete_abuse' || decoded.slug !== slug) {
            throw new Error("Invalid token claim");
        }
    } catch {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }

    const existing = await prisma.shortLink.findUnique({
        where: { slug }
    });

    if (!existing) {
        return NextResponse.json({ error: "Link not found (maybe already deleted)" }, { status: 404 });
    }

    await prisma.shortLink.delete({
        where: { id: existing.id }
    });

    revalidateTag(`shortlink:${slug}`, { expire: 0 });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Admin Delete Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
