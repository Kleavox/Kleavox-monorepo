//app/api/files/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cos, BUCKET, REGION } from "@/lib/cos";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { key, name, type, size, expiresAt } = body;

    if (session) {
      const userCheck = await prisma.user.findUnique({ where: { id: session.id } });
      if (!userCheck) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const file = await prisma.file.create({
      data: {
        key, name, type,
        size: BigInt(size),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        userId: session ? session.id : null, 
      },
    });

    return NextResponse.json({ ...file, size: file.size.toString() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    let where = {};
    
    if (session?.role === "USER") where = { userId: session.id };
    else if (!session || session.role !== "ADMIN") return NextResponse.json([], { status: 401 });

    const files = await prisma.file.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } }
    });

    const serialized = files.map(f => ({
      ...f,
      size: f.size.toString(),
      uploadedBy: f.user?.email || "Guest"
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    return NextResponse.json({ error: "Fetch error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const key = searchParams.get("key");

  if (!id || !key) return NextResponse.json({ error: "Missing ID/Key" }, { status: 400 });

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  if (session.role !== "ADMIN" && file.userId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      cos.deleteObject({ Bucket: BUCKET, Region: REGION, Key: key }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await prisma.file.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
