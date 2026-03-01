//lib/auth.ts

import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { randomInt, randomUUID } from "crypto";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/constants";

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error("JWT_SECRET is not set");
}
const JWT_SECRET: Secret = rawSecret;

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE };

export interface UserJwtPayload extends JwtPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  // jti (JWT ID) is inherited from JwtPayload — used for Redis session tracking
}

export function signUserJWT(
  payload: { id: string; email: string; name: string; role: string },
  jti?: string
): { token: string; jti: string } {
  const sessionId = jti ?? randomUUID();
  const token = jwt.sign({ ...payload, jti: sessionId }, JWT_SECRET, {
    expiresIn: SESSION_MAX_AGE,
  });
  return { token, jti: sessionId };
}

export function verifyUserJWT(token: string): UserJwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserJwtPayload;
    if (!decoded.id || !decoded.email) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function generateOTP(length: number = 6): string {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += randomInt(0, 10).toString();
  }
  return otp;
}
