//app/api/report/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAbuseReportEmail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rateLimit";
import { sanitizeAndValidateUrl, sanitizeInput } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  
  const limit = await checkRateLimit(ip, "report_abuse"); 
  
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { linkUrl, reason, details, contact } = body;

    if (!linkUrl || !reason) {
        return NextResponse.json({ error: "Link and Reason are required." }, { status: 400 });
    }

    const validUrl = sanitizeAndValidateUrl(linkUrl);
    if (!validUrl) {
        return NextResponse.json({ error: "Invalid URL format." }, { status: 400 });
    }

    const urlObj = new URL(validUrl);
    const appHost = process.env.NEXT_PUBLIC_APP_HOST?.split(":")[0];
    const shortHost = process.env.NEXT_PUBLIC_SHORT_HOST?.split(":")[0];
    const reportedHost = urlObj.hostname;

    if (appHost && shortHost && !reportedHost.includes(appHost) && !reportedHost.includes(shortHost)) {
        return NextResponse.json({ error: "URL does not belong to a valid domain." }, { status: 400 });
    }

    const slug = urlObj.pathname.replace(/^\//, "");

    if (!slug) {
        return NextResponse.json({ error: "No slug found in URL." }, { status: 400 });
    }

    const shortLink = await prisma.shortLink.findUnique({
        where: { slug }
    });

    if (!shortLink) {
        return NextResponse.json({ error: "Link not found in our system." }, { status: 404 });
    }

    await prisma.report.create({
        data: {
            shortLinkId: shortLink.id,
            reason: sanitizeInput(reason),
            details: sanitizeInput(details || ""),
            contact: sanitizeInput(contact || ""),
            status: "PENDING"
        }
    });

    const adminUser = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { email: true }
    });

    if (adminUser?.email) {
        await sendAbuseReportEmail({
            linkUrl: validUrl,
            reason: sanitizeInput(reason),
            details: sanitizeInput(details || ""),
            reporter: sanitizeInput(contact || ""),
            adminEmail: adminUser.email
        });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Report Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
