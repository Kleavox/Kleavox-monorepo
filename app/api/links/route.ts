//app/api/links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRandomSlug } from "@/lib/slug";
import bcrypt from "bcryptjs";
import { getAuthenticatedUser } from "@/lib/session";
import { sanitizeAndValidateUrl, isValidSlug } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const [total, links] = await prisma.$transaction([
      prisma.shortLink.count({
        where: { userId: user.id },
      }),
      prisma.shortLink.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);
    
    return NextResponse.json({
      data: links,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch {
    return NextResponse.json({ error: "Error fetching links" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const rawUrl = String(body.targetUrl || "").trim();
    let slug = (body.slug ? String(body.slug) : "").trim();
    
    const passwordInput = body.password ? String(body.password) : null;
    const expiresAtInput = body.expiresAt ? new Date(body.expiresAt) : null;

    const cleanUrl = sanitizeAndValidateUrl(rawUrl);
    if (!cleanUrl) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    if (!slug) {
      let attempts = 0;
      const maxRetries = 5;
      
      while (attempts < maxRetries) {
        const candidate = generateRandomSlug(6);
        const existing = await prisma.shortLink.findUnique({ where: { slug: candidate } });
        if (!existing) {
          slug = candidate;
          break;
        }
        attempts++;
      }

      if (!slug) {
         return NextResponse.json({ error: "Failed to generate a unique link. Please try again." }, { status: 500 });
      }

    } else {
      if (!isValidSlug(slug)) {
         return NextResponse.json({ error: "Invalid slug format. Use alphanumeric, '-', or '_' only." }, { status: 400 });
      }
      const exists = await prisma.shortLink.findUnique({ where: { slug } });
      if (exists) return NextResponse.json({ error: "Slug already taken" }, { status: 400 });
    }

    let passwordHash = null;
    if (passwordInput) {
      passwordHash = await bcrypt.hash(passwordInput, 10);
    }

    const link = await prisma.shortLink.create({
      data: { 
        slug, 
        targetUrl: cleanUrl,
        password: passwordHash,
        expiresAt: expiresAtInput,
        userId: user.id
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Create Link Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
