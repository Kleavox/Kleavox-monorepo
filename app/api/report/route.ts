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

    const slug = urlObj.pathname.replace(/^\