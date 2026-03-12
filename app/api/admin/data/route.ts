//app/api/admin/data/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }

    const [reports, publicLinks, totalUsers, totalLinks, totalReports] = await prisma.$transaction([
        prisma.report.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                shortLink: {
                    select: { slug: true, targetUrl: true }
                }
            },
            take: 50
        }),
        prisma.shortLink.findMany({
            where: { userId: null },
            orderBy: { createdAt: "desc" },
            take: 50
        }),
        prisma.user.count(),
        prisma.shortLink.count(),
        prisma.report.count({ where: { status: "PENDING" } }),
    ]);

    return NextResponse.json({
        reports,
        publicLinks,
        stats: {
            totalUsers,
            totalLinks,
            pendingReports: totalReports
        }
    });

  } catch (error) {
    console.error("Admin Data Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
