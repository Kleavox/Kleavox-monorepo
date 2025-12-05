//app/api/admin/stats/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const aggregate = await prisma.file.aggregate({
    _sum: { size: true }
  });

  const totalBytes = Number(aggregate._sum.size || 0);
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  const limitGB = Number(process.env.MAX_STORAGE_LIMIT_GB || 50);
  
  const userCount = await prisma.user.count();
  const fileCount = await prisma.file.count();

  return NextResponse.json({
    storage: {
      usedBytes: totalBytes,
      usedGB: totalGB.toFixed(2),
      limitGB: limitGB,
      percent: ((totalGB / limitGB) * 100).toFixed(1)
    },
    counts: {
      users: userCount,
      files: fileCount
    }
  });
}
