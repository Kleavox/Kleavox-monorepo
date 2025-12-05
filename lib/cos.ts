//lib/cos.ts

import COS from "cos-nodejs-sdk-v5";

if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
  throw new Error("Missing Tencent COS credentials in .env");
}

export const cos = new COS({
  SecretId: process.env.TENCENT_SECRET_ID,
  SecretKey: process.env.TENCENT_SECRET_KEY,
});

export const BUCKET = process.env.TENCENT_BUCKET || "";
export const REGION = process.env.TENCENT_REGION || "";

if (!BUCKET || !REGION) {
  throw new Error("Missing Tencent Bucket/Region config");
}