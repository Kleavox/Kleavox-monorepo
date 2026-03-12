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
  