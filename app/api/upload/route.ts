//app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cos, BUCKET, REGION } from "@/lib/cos";
import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

const GB = 1024 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { name, type, size } = await req.json();

    if (!name || !type || !size) {
      return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
    }

    const fileSize = Number(size);
    let expiresAt: Date | null = null;

    if (!session) {
      if (fileSize > 1 * GB) {
        return NextResponse.json({ error: "Guest limit: Max 1GB" }, { status: 403 });
      }
      expiresAt = new Date(Date.now() + 60 * 60 * 1000); 
    } 
    else if (session.role === "USER") {
      if (fileSize > 5 * GB) {
        return NextResponse.json({ error: "User limit: Max 5GB" }, { status: 403 });
      }
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } 

    const ext = name.split(".").pop();
    const folder = session ? session.role.toLowerCase() : 'guest';
    const dateStr = new Date().toISOString().split('T')[0];
    const fileKey = `${folder}/${dateStr}/${uuidv4()}.${ext}`;

    const url = await new Promise<string>((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: BUCKET,
          Region: REGION,
          Key: fileKey,
          Method: "PUT",
          Sign: true,
          Expires: 60 * 10,
        },
        (err, data) => {
          if (err) return reject(err);
          const signedUrl = data.Url.startsWith("http") ? data.Url : `https://${data.Url}`;
          resolve(signedUrl);
        }
      );
    });

    return NextResponse.json({
      uploadUrl: url,
      key: fileKey,
      expiresAt: expiresAt?.toISOString() || null,
    });

  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
