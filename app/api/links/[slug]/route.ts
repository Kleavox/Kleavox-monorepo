//app/api/links/[slug]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache"; 
import { getAuthenticatedUser } from "@/lib/session";
import bcrypt from "bcryptjs";
import { sanitizeAndValidateUrl } from "@/lib/validation";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent(rawSlug);

  try {
    const existing = await prisma.shortLink.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
    });

    if (!existing) {
      return NextResponse.json({ error: "Shortlink not found." }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    const isOwner = existing.userId === user.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: you do not own this link." }, { status: 403 });
    }

    await prisma.shortLink.delete({
      where: { id: existing.id },
    });

    revalidateTag(`shortlink:${existing.slug}`, { expire: 0 });

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("Delete Error:", err);
    return NextResponse.json({ error: "Failed to delete link." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug: rawSlug } = await context.params;
    const slug = decodeURIComponent(rawSlug);
    const body = await req.json();

    const existing = await prisma.shortLink.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
    });

    if (!existing) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    const isAdmin = user.role === "ADMIN";
    const isOwner = existing.userId === user.id;

    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updateData: {
        targetUrl?: string;
        password?: string | null;
        expiresAt?: Date | null;
    } = {};

    if (body.targetUrl) {
      const cleanUrl = sanitizeAndValidateUrl(body.targetUrl);
      if (!cleanUrl) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      updateData.targetUrl = cleanUrl;
    }

    if (body.password) {
       updateData.password = await bcrypt.hash(body.password, 10);
    } else if (body.removePassword) {
       updateData.password = null;
    }

    if (body.expiresAt) {
       updateData.expiresAt = new Date(body.expiresAt);
    } else if (body.removeExpiry) {
       updateData.expiresAt = null;
    }

    const updatedLink = await prisma.shortLink.update({
      where: { id: existing.id },
      data: updateData,
    });

    revalidateTag(`shortlink:${existing.slug}`, { expire: 0 });

    return NextResponse.json(updatedLink);

  } catch (err) {
    console.error("Edit Error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
