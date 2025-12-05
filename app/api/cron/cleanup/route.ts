//app/api/cron/cleanup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cos, BUCKET, REGION } from "@/lib/cos";

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const expiredFiles = await prisma.file.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
      select: { id: true, key: true },
      take: 100,
    });

    if (expiredFiles.length === 0) {
      return NextResponse.json({ message: "No expired files found", count: 0 });
    }

    const objectsToDelete = expiredFiles.map((f) => ({ Key: f.key }));
    
    await new Promise<void>((resolve, reject) => {
      cos.deleteMultipleObject({
        Bucket: BUCKET,
        Region: REGION,
        Objects: objectsToDelete
      }, (err, data) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const deletedIds = expiredFiles.map((f) => f.id);
    await prisma.file.deleteMany({
      where: {
        id: { in: deletedIds },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedIds.length} files.`,
      deletedKeys: objectsToDelete.map(o => o.Key)
    });

  } catch (error) {
    console.error("Cleanup Error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
