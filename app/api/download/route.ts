//app/api/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; 
import { cos, BUCKET, REGION } from "@/lib/cos";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) return NextResponse.json({ error: "No key provided" }, { status: 400 });

  try {
    const file = await prisma.file.findUnique({
      where: { key },
      select: { id: true } 
    });

    if (!file) {
      return NextResponse.json({ error: "File not found or expired" }, { status: 404 });
    }

    await prisma.file.update({
      where: { id: file.id },
      data: { downloads: { increment: 1 } }
    });

    const url = await new Promise<string>((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: BUCKET,
          Region: REGION,
          Key: key,
          Sign: true,
          Expires: 60 * 60,
        },
        (err, data) => {
          if (err) return reject(err);
          const signedUrl = data.Url.startsWith("http") 
            ? data.Url 
            : `https://${data.Url}`;
          resolve(signedUrl);
        }
      );
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Download URL Error:", error);
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }
}
