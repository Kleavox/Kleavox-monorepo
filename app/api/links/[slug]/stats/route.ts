// app/api/links/[slug]/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/session";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await context.params;

    const link = await prisma.shortLink.findUnique({
      where: { slug },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (link.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    
    const [
      total,
      clicksByDay,
      browserGroups,
      osGroups,
      countryGroups,
      referrerGroups,
      recentClicks,
    ] = await Promise.all([
      prisma.click.count({ where: { shortLinkId: link.id } }),

      prisma.click.groupBy({
        by: ["clickedAt"],
        where: {
          shortLinkId: link.id,
          clickedAt: { gte: sevenDaysAgo },
        },
        _count: { id: true },
      }),

      prisma.click.groupBy({
        by: ["browser"],
        where: { shortLinkId: link.id },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      prisma.click.groupBy({
        by: ["os"],
        where: { shortLinkId: link.id },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      prisma.click.groupBy({
        by: ["country"],
        where: { shortLinkId: link.id },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      prisma.click.groupBy({
        by: ["referrer"],
        where: { shortLinkId: link.id },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      prisma.click.findMany({
        where: { shortLinkId: link.id },
        select: {
          clickedAt: true,
          browser: true,
          os: true,
          country: true,
          city: true,
          referrer: true,
        },
        orderBy: { clickedAt: "desc" },
        take: 10,
      }),
    ]);

    
    const last7Days = new Array(7).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });

    const dayCountMap: Record<string, number> = {};
    clicksByDay.forEach((row) => {
      const day = new Date(row.clickedAt).toISOString().split("T")[0];
      dayCountMap[day] = (dayCountMap[day] || 0) + row._count.id;
    });

    const chartData = last7Days.map((date) => ({
      date,
      count: dayCountMap[date] || 0,
    }));

    const cleanReferrer = (url: string | null) => {
      if (!url || url.includes("Direct")) return "Direct / Unknown";
      try {
        return new URL(url).hostname.replace("www.", "");
      } catch {
        return url;
      }
    };

    return NextResponse.json({
      total,
      chartData,
      topBrowsers: browserGroups.map((r) => ({ name: r.browser || "Unknown", value: r._count.id })),
      topOS: osGroups.map((r) => ({ name: r.os || "Unknown", value: r._count.id })),
      topCountries: countryGroups.map((r) => ({ name: r.country || "Unknown", value: r._count.id })),
      topReferrers: referrerGroups.map((r) => ({ name: cleanReferrer(r.referrer), value: r._count.id })),
      recentClicks,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
