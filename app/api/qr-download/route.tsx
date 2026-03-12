// app/api/qr-download/route.tsx

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) return new Response("Missing URL", { status: 400 });

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=0&data=${encodeURIComponent(url)}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          border: "32px solid #000",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "20px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} width={450} height={450} alt="QR Code" />
        </div>
      </div>
    ),
    {
      width: 600,
      height: 600,
    }
  );
}
