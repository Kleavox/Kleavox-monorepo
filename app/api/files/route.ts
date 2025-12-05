// app/api/files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { key, name, type, size, expiresAt } = body;

    if (!key || !name || !size) {
      return NextResponse.json({ error: "Missing file data" }, { status: 400 });
    }

    const file = await prisma.file.create({
      data: {
        key,
        name,
        type,
        size: BigInt(size),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        userId: session ? session.id : null, 
      },
    });

    const serializedFile = {
      ...file,
      size: file.size.toString(),
    };

    return NextResponse.json(serializedFile, { status: 201 });

  } catch (error) {
    console.error("Save File Error:", error);
    return NextResponse.json({ error: "Failed to save file data" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    
    let whereCondition = {};
    
    if (session?.role === "ADMIN") {
      whereCondition = {}; // Semua file
    } else if (session?.role === "USER") {
      whereCondition = { userId: session.id };
    } else {
      whereCondition = { userId: null };
    }

    const files = await prisma.file.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
    });

    const serializedFiles = files.map(f => ({
      ...f,
      size: f.size.toString(),
    }));

    return NextResponse.json(serializedFiles);
  } catch (error) {
    console.error("Fetch Files Error:", error);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}
